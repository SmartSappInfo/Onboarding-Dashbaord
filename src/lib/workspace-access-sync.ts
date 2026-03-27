'use server';

import { adminDb } from './firebase-admin';
import type { Role, UserProfile } from './types';

/**
 * @fileOverview Workspace access synchronization utilities.
 * 
 * Implements Requirement 9.5: Immediate workspace access revocation
 * 
 * This module ensures that the user.workspaceIds array is kept in sync with
 * role-based workspace access. This denormalization is critical for Firestore
 * security rules to enforce immediate access revocation without complex queries.
 * 
 * WHEN TO CALL THESE FUNCTIONS:
 * 1. When a user is added to or removed from a role
 * 2. When a workspace is added to or removed from a role's workspaceIds
 * 3. When a role is deleted
 * 
 * These functions MUST be called in the same transaction/batch as the role change
 * to ensure atomicity and prevent security gaps.
 */

/**
 * Recomputes and updates a user's workspaceIds array based on their current roles.
 * 
 * This function:
 * 1. Fetches all roles in the user's organization
 * 2. Filters to roles the user belongs to
 * 3. Collects all workspace IDs from those roles
 * 4. Updates the user document with the new workspaceIds array
 * 
 * @param userId - The user ID to sync
 * @returns Promise that resolves when sync is complete
 * 
 * Requirements: 9.5
 */
export async function syncUserWorkspaceAccess(userId: string): Promise<void> {
  try {
    console.log(`>>> [WORKSPACE_ACCESS_SYNC] Syncing workspace access for user ${userId}`);

    // 1. Fetch user profile
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      console.error(`>>> [WORKSPACE_ACCESS_SYNC] User ${userId} not found`);
      return;
    }

    const user = userSnap.data() as UserProfile;

    // 2. Fetch all roles for the user's organization
    const rolesSnap = await adminDb
      .collection('roles')
      .where('organizationId', '==', user.organizationId)
      .get();

    // 3. Filter to roles the user belongs to
    const userRoles = rolesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Role))
      .filter((role) => user.roles.includes(role.id));

    // 4. Collect all workspace IDs from user roles
    const workspaceIds = new Set<string>();
    userRoles.forEach((role) => {
      role.workspaceIds.forEach((wsId) => workspaceIds.add(wsId));
    });

    const workspaceIdsArray = Array.from(workspaceIds);

    // 5. Update user document with new workspaceIds
    await userSnap.ref.update({
      workspaceIds: workspaceIdsArray,
      workspaceAccessUpdatedAt: new Date().toISOString(),
    });

    console.log(
      `>>> [WORKSPACE_ACCESS_SYNC] Updated user ${userId} workspaceIds:`,
      workspaceIdsArray
    );
  } catch (error: any) {
    console.error(
      `>>> [WORKSPACE_ACCESS_SYNC] Failed to sync workspace access for user ${userId}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Syncs workspace access for all users who belong to a specific role.
 * 
 * Call this when:
 * - A workspace is added to or removed from a role's workspaceIds
 * - A role's workspaceIds array is updated
 * 
 * @param roleId - The role ID whose members need to be synced
 * @returns Promise that resolves when all users are synced
 * 
 * Requirements: 9.5
 */
export async function syncRoleMembersWorkspaceAccess(roleId: string): Promise<void> {
  try {
    console.log(`>>> [WORKSPACE_ACCESS_SYNC] Syncing workspace access for role ${roleId} members`);

    // 1. Fetch the role
    const roleSnap = await adminDb.collection('roles').doc(roleId).get();
    if (!roleSnap.exists) {
      console.error(`>>> [WORKSPACE_ACCESS_SYNC] Role ${roleId} not found`);
      return;
    }

    const role = roleSnap.data() as Role;

    // 2. Fetch all users in the role's organization who have this role
    const usersSnap = await adminDb
      .collection('users')
      .where('organizationId', '==', role.organizationId)
      .where('roles', 'array-contains', roleId)
      .get();

    // 3. Sync workspace access for each user
    const syncPromises = usersSnap.docs.map((userDoc) => syncUserWorkspaceAccess(userDoc.id));

    await Promise.all(syncPromises);

    console.log(
      `>>> [WORKSPACE_ACCESS_SYNC] Synced workspace access for ${usersSnap.size} users in role ${roleId}`
    );
  } catch (error: any) {
    console.error(
      `>>> [WORKSPACE_ACCESS_SYNC] Failed to sync workspace access for role ${roleId} members:`,
      error.message
    );
    throw error;
  }
}

/**
 * Syncs workspace access for all users in an organization.
 * 
 * Call this when:
 * - Performing bulk role updates
 * - Migrating to the new workspace access system
 * - Recovering from sync failures
 * 
 * WARNING: This can be expensive for large organizations. Use sparingly.
 * 
 * @param organizationId - The organization ID
 * @returns Promise that resolves when all users are synced
 * 
 * Requirements: 9.5
 */
export async function syncOrganizationWorkspaceAccess(organizationId: string): Promise<void> {
  try {
    console.log(
      `>>> [WORKSPACE_ACCESS_SYNC] Syncing workspace access for all users in organization ${organizationId}`
    );

    // Fetch all users in the organization
    const usersSnap = await adminDb
      .collection('users')
      .where('organizationId', '==', organizationId)
      .get();

    // Sync workspace access for each user in batches of 10 to avoid overwhelming Firestore
    const batchSize = 10;
    for (let i = 0; i < usersSnap.docs.length; i += batchSize) {
      const batch = usersSnap.docs.slice(i, i + batchSize);
      const syncPromises = batch.map((userDoc) => syncUserWorkspaceAccess(userDoc.id));
      await Promise.all(syncPromises);
    }

    console.log(
      `>>> [WORKSPACE_ACCESS_SYNC] Synced workspace access for ${usersSnap.size} users in organization ${organizationId}`
    );
  } catch (error: any) {
    console.error(
      `>>> [WORKSPACE_ACCESS_SYNC] Failed to sync workspace access for organization ${organizationId}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Removes workspace access for a user when they are removed from a role.
 * 
 * This is a convenience function that calls syncUserWorkspaceAccess.
 * 
 * @param userId - The user ID
 * @param roleId - The role ID the user was removed from
 * @returns Promise that resolves when sync is complete
 * 
 * Requirements: 9.5
 */
export async function handleUserRemovedFromRole(userId: string, roleId: string): Promise<void> {
  console.log(`>>> [WORKSPACE_ACCESS_SYNC] User ${userId} removed from role ${roleId}`);
  await syncUserWorkspaceAccess(userId);
}

/**
 * Updates workspace access for a user when they are added to a role.
 * 
 * This is a convenience function that calls syncUserWorkspaceAccess.
 * 
 * @param userId - The user ID
 * @param roleId - The role ID the user was added to
 * @returns Promise that resolves when sync is complete
 * 
 * Requirements: 9.5
 */
export async function handleUserAddedToRole(userId: string, roleId: string): Promise<void> {
  console.log(`>>> [WORKSPACE_ACCESS_SYNC] User ${userId} added to role ${roleId}`);
  await syncUserWorkspaceAccess(userId);
}

/**
 * Updates workspace access for all role members when a workspace is added to or removed from a role.
 * 
 * This is a convenience function that calls syncRoleMembersWorkspaceAccess.
 * 
 * @param roleId - The role ID
 * @param workspaceId - The workspace ID that was added or removed
 * @returns Promise that resolves when sync is complete
 * 
 * Requirements: 9.5
 */
export async function handleRoleWorkspaceIdsChanged(
  roleId: string,
  workspaceId: string
): Promise<void> {
  console.log(
    `>>> [WORKSPACE_ACCESS_SYNC] Role ${roleId} workspace access changed (workspace ${workspaceId})`
  );
  await syncRoleMembersWorkspaceAccess(roleId);
}
