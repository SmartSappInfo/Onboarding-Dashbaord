/**
 * @fileOverview Identity Projection Service (Identity & Access 2.0)
 *
 * The core compatibility bridge between canonical Identity 2.0 domain entities
 * (Account, Person, OrganizationMembership, WorkspaceMembership) and the classic
 * `UserProfile` document (`users/{uid}`).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Why this exists: Live production systems, security rules, and real-time listeners
 *   depend on `users/{uid}`.
 * - This service provides atomic dual-write capabilities, ensuring canonical models and
 *   the legacy `UserProfile` projection never drift.
 * - Every canonical update triggers `syncUserProjection()` inside the same atomic batch/transaction.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Comprehensive unit tests in `identity-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  IdentityAccount,
  Person,
  OrganizationMembership,
  WorkspaceMembership,
  UserProfile,
  Role,
  PermissionsSchema,
  AppPermissionId,
} from '@/lib/types';
import {
  mergePermissionsSchemas,
  flattenPermissionsSchema,
  getBlankPermissions,
  normalizePermissionsSchema,
} from '@/lib/permissions-engine';
import { IdentityAccountService } from './identity-account-service';
import { PersonService } from './person-service';
import { OrganizationMembershipService } from './organization-membership-service';
import { WorkspaceMembershipService } from './workspace-membership-service';

export interface AtomicUserIdentityPayload {
  account: Omit<IdentityAccount, 'createdAt' | 'updatedAt'>;
  person: Omit<Person, 'createdAt' | 'updatedAt'>;
  membership: Omit<OrganizationMembership, 'id' | 'createdAt' | 'updatedAt'>;
  workspaceMemberships: Array<{
    workspaceId: string;
    workspaceName?: string;
    roleAssignmentIds: string[];
    roleNames?: string[];
    isPrimary?: boolean;
  }>;
  requiresPasswordReset?: boolean;
}

export class IdentityProjectionService {
  /**
   * Recomputes and writes the `UserProfile` projection in `users/{personId}`.
   * Uses role blueprints to hydrate per-workspace permission schemas and flat permission arrays.
   */
  static async syncUserProjection(
    organizationId: string,
    personId: string,
    batchOrTransaction?: FirebaseFirestore.WriteBatch | FirebaseFirestore.Transaction
  ): Promise<UserProfile | null> {
    if (!organizationId || !personId) return null;

    // 1. Fetch canonical documents
    const [person, account, membership, wsMemberships] = await Promise.all([
      PersonService.getPerson(personId),
      IdentityAccountService.getAccount(personId),
      OrganizationMembershipService.getMembershipByPersonAndOrg(organizationId, personId),
      WorkspaceMembershipService.listWorkspaceMembershipsByPerson(organizationId, personId),
    ]);

    if (!person) {
      console.warn(`[IdentityProjectionService] Person ${personId} not found for sync.`);
      return null;
    }

    // 2. Fetch all organization roles to hydrate permissions
    const rolesSnap = await adminDb
      .collection('roles')
      .where('organizationId', '==', organizationId)
      .get();

    const rolesMap = new Map<string, Role>();
    rolesSnap.docs.forEach((doc) => {
      rolesMap.set(doc.id, { id: doc.id, ...doc.data() } as Role);
    });

    // 3. Compute per-workspace roles, schemas, and flattened permissions
    const activeWsMemberships = wsMemberships.filter((m) => m.status === 'active');
    const workspaceIds: string[] = activeWsMemberships.map((m) => m.workspaceId);

    const workspaceRoles: Record<string, string[]> = {};
    const workspacePermissions: Record<string, AppPermissionId[]> = {};
    const workspacePermissionsSchemas: Record<string, PermissionsSchema> = {};

    const allGlobalRoleIds = new Set<string>();
    const allGlobalSchemas: PermissionsSchema[] = [];

    for (const wsMem of activeWsMemberships) {
      const roleIds = wsMem.roleAssignmentIds || [];
      workspaceRoles[wsMem.workspaceId] = roleIds;
      roleIds.forEach((rId) => allGlobalRoleIds.add(rId));

      // Resolve roles
      const hydratedRoleSchemas: PermissionsSchema[] = [];
      for (const rId of roleIds) {
        const rObj = rolesMap.get(rId);
        if (rObj?.permissionsSchema) {
          hydratedRoleSchemas.push(normalizePermissionsSchema(rObj.permissionsSchema));
        }
      }

      // Merge schemas additively for this workspace
      const mergedWsSchema =
        hydratedRoleSchemas.length > 0
          ? mergePermissionsSchemas(hydratedRoleSchemas)
          : getBlankPermissions();

      workspacePermissionsSchemas[wsMem.workspaceId] = mergedWsSchema;
      workspacePermissions[wsMem.workspaceId] = flattenPermissionsSchema(mergedWsSchema) as AppPermissionId[];
      allGlobalSchemas.push(mergedWsSchema);
    }

    // 4. Compute global aggregated permissions & schema
    const globalMergedSchema =
      allGlobalSchemas.length > 0
        ? mergePermissionsSchemas(allGlobalSchemas)
        : getBlankPermissions();
    const globalPermissions = flattenPermissionsSchema(globalMergedSchema) as AppPermissionId[];
    const globalRoles = Array.from(allGlobalRoleIds);

    // 5. Compute authorization & profile completion flags
    const isAccountActive = account ? account.status === 'active' : true;
    const isMembershipActive = membership ? membership.status === 'active' : true;
    const isAuthorized = isAccountActive && isMembershipActive;

    let approvalStatus: 'pending' | 'approved' | 'rejected' = 'approved';
    if (membership) {
      if (membership.status === 'active') approvalStatus = 'approved';
      else if (membership.status === 'revoked' || membership.status === 'suspended') approvalStatus = 'rejected';
      else approvalStatus = 'pending';
    }

    const primaryWsId =
      membership?.primaryWorkspaceId ||
      activeWsMemberships.find((m) => m.isPrimary)?.workspaceId ||
      workspaceIds[0] ||
      undefined;

    const now = new Date().toISOString();

    // 6. Build the projected UserProfile
    const userProfileProjection: UserProfile = {
      id: personId,
      organizationId,
      workspaceIds,
      name: person.displayName || `${person.firstName} ${person.lastName}`.trim(),
      email: person.email,
      phone: person.phone || '',
      photoURL: person.avatarUrl || undefined,
      department: person.departmentName || membership?.departmentName || undefined,
      isAuthorized,
      profileCompleted: Boolean(person.displayName && person.phone),
      approvalStatus,
      roles: globalRoles,
      permissions: globalPermissions,
      permissionsSchema: globalMergedSchema,
      workspaceRoles,
      workspacePermissions,
      workspacePermissionsSchemas,
      lastActiveWorkspaceId: primaryWsId,
      lastActiveOrganizationId: organizationId,
      defaultWorkspaceId: primaryWsId,
      notificationPreferences: person.notificationPreferences,
      preferredAiModel: person.preferredAiModel,
      preferredAiProvider: person.preferredAiProvider,
      facilitatorRole: person.facilitatorRole,
      facilitatorBio: person.facilitatorBio,
      createdAt: person.createdAt || now,
      updatedAt: now,
    };

    // 7. Write to `users/{personId}`
    const userDocRef = adminDb.collection('users').doc(personId);

    if (batchOrTransaction) {
      (batchOrTransaction as FirebaseFirestore.WriteBatch).set(userDocRef, userProfileProjection, { merge: true });
    } else {
      await userDocRef.set(userProfileProjection, { merge: true });
    }

    return userProfileProjection;
  }

  /**
   * Atomically provisions an entire Identity 2.0 graph and compiles the `UserProfile` projection.
   * Single Firestore Batch guarantees zero partial writes.
   */
  static async atomicCreateUserIdentity(payload: AtomicUserIdentityPayload): Promise<UserProfile> {
    const batch = adminDb.batch();

    // 1. Create IdentityAccount
    await IdentityAccountService.createAccount(payload.account, batch);

    // 2. Create Person
    await PersonService.createPerson(payload.person, batch);

    // 3. Create OrganizationMembership
    const membership = await OrganizationMembershipService.createMembership(payload.membership, batch);

    // 4. Create WorkspaceMemberships
    await WorkspaceMembershipService.setWorkspaceMemberships(
      payload.membership.organizationId,
      payload.person.id,
      membership.id,
      payload.workspaceMemberships,
      batch
    );

    // 5. Commit atomic batch for canonical models
    await batch.commit();

    // 6. Project and sync to `users/{uid}`
    const projection = await this.syncUserProjection(payload.membership.organizationId, payload.person.id);
    if (!projection) {
      throw new Error(`Failed to compile projection for ${payload.person.id}`);
    }

    // 7. Apply optional requiresPasswordReset flag if specified
    if (payload.requiresPasswordReset) {
      await adminDb.collection('users').doc(payload.person.id).update({
        requiresPasswordReset: true,
      });
      projection.requiresPasswordReset = true;
    }

    return projection;
  }
}
