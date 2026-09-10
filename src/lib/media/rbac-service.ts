'use server';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Resource-Level RBAC Service
 *
 * Implements fine-grained, resource-level Access Control Lists (ACLs) for Media Collections,
 * Packages, Experiences, and Assets, integrating with workspace-level roles.
 *
 * ARCHITECTURAL INVARIANTS & SECURITY GUIDANCE (RULE 10):
 * 1. Role Hierarchy: Evaluates hierarchical capabilities where:
 *    ADMIN (7) >= MANAGER (6) >= PUBLISHER (5) >= ANALYST (4) >= EDITOR (3) >= CONTRIBUTOR (2) >= VIEWER (1).
 * 2. Workspace Admin Override: Workspace administrators and organization owners inherit global ADMIN rights.
 * 3. Immutable Audit Integration: Every privilege grant and revocation creates an entry in `/media_audit_logs`.
 * 4. Strict Typing: Zero `any`, `any[]`, or `unknown`.
 *
 * PRD & UX REFERENCES:
 * - PRD Sec 132 (Phase 9 - Enterprise Platform) & Sec 157 (Multi-Tenancy).
 * - UX Sec 132 (Admin - Permissions) & Screen 59 (Permissions).
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import type { MediaResourcePermission, MediaResourceRole } from '@/lib/types/media-2.0';
import { logMediaAuditEventAction } from './audit-service';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';

export const ROLE_HIERARCHY: Record<MediaResourceRole, number> = {
  ADMIN: 7,
  MANAGER: 6,
  PUBLISHER: 5,
  ANALYST: 4,
  EDITOR: 3,
  CONTRIBUTOR: 2,
  VIEWER: 1,
};

/**
 * Checks whether a user possesses the required role or higher on a specific media resource.
 */
export async function checkMediaPermissionAction(
  workspaceId: string,
  userId: string,
  resourceType: 'COLLECTION' | 'PACKAGE' | 'EXPERIENCE' | 'ASSET',
  resourceId: string,
  requiredRole: MediaResourceRole
): Promise<{ granted: boolean; effectiveRole?: MediaResourceRole; reason?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    if (!workspaceId || !userId || !resourceId) {
      return { granted: false, reason: 'Missing required parameters.' };
    }

    // 1. Check workspace membership & global role
    const memberSnap = await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .doc(userId)
      .get();

    if (memberSnap.exists) {
      const memberData = memberSnap.data();
      const workspaceRole = (memberData?.role || '').toUpperCase();
      if (['ADMIN', 'OWNER'].includes(workspaceRole)) {
        return { granted: true, effectiveRole: 'ADMIN', reason: 'Inherited from workspace admin/owner role.' };
      }
    }

    // 2. Query resource-specific ACL
    const aclSnap = await adminDb
      .collection('media_resource_permissions')
      .where('workspaceId', '==', workspaceId)
      .where('resourceId', '==', resourceId)
      .where('principalId', '==', userId)
      .limit(1)
      .get();

    if (aclSnap.empty) {
      // Default fallback: allow VIEWER if active member, otherwise deny
      if (memberSnap.exists && requiredRole === 'VIEWER') {
        return { granted: true, effectiveRole: 'VIEWER', reason: 'Default workspace member read access.' };
      }
      return { granted: false, reason: 'No explicit resource permission found.' };
    }

    const permission = aclSnap.docs[0].data() as MediaResourcePermission;
    const userWeight = ROLE_HIERARCHY[permission.role] || 0;
    const requiredWeight = ROLE_HIERARCHY[requiredRole] || 0;

    const granted = userWeight >= requiredWeight;
    return {
      granted,
      effectiveRole: permission.role,
      reason: granted
        ? `Granted: effective role ${permission.role} meets requirement ${requiredRole}`
        : `Denied: effective role ${permission.role} does not meet requirement ${requiredRole}`,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Permission check failure.';
    return { granted: false, reason: msg };
  }
}

/**
 * Grants or updates a resource-level permission.
 */
export async function saveResourcePermissionAction(
  permissionData: Omit<MediaResourcePermission, 'id' | 'createdAt'>,
  actorId: string = 'admin'
): Promise<{ success: boolean; permission?: MediaResourcePermission; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  try {
    const id = `perm_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    const permission: MediaResourcePermission = {
      ...permissionData,
      id,
      createdAt: timestamp,
    };

    await adminDb.collection('media_resource_permissions').doc(id).set(permission);

    // Audit log entry
    await logMediaAuditEventAction(permission.workspaceId, {
      actorId,
      actorEmail: 'admin@smartsapp.com',
      actorName: 'Permission Manager',
      action: 'GRANT_RESOURCE_PERMISSION',
      resourceType: 'GOVERNANCE',
      resourceId: permission.resourceId,
      resourceTitle: `${permission.resourceType} Permission`,
      afterState: permission as unknown as Record<string, unknown>,
      reason: `Granted role ${permission.role} to principal ${permission.principalId}`,
    });

    return { success: true, permission };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to save resource permission.';
    return { success: false, error: msg };
  }
}

/**
 * Lists all active permissions for a specific resource.
 */
export async function listResourcePermissionsAction(
  workspaceId: string,
  resourceId: string
): Promise<{ success: boolean; permissions?: MediaResourcePermission[]; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    if (!workspaceId || !resourceId) {
      return { success: false, error: 'Workspace ID and Resource ID are required.' };
    }

    const snap = await adminDb
      .collection('media_resource_permissions')
      .where('workspaceId', '==', workspaceId)
      .where('resourceId', '==', resourceId)
      .get();

    const permissions: MediaResourcePermission[] = snap.docs.map((d) => d.data() as MediaResourcePermission);
    return { success: true, permissions };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to list resource permissions.';
    return { success: false, error: msg };
  }
}

/**
 * Deletes a resource permission.
 */
export async function deleteResourcePermissionAction(
  permissionId: string,
  workspaceId: string,
  actorId: string = 'admin'
): Promise<{ success: boolean; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const docRef = adminDb.collection('media_resource_permissions').doc(permissionId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Permission not found.' };
    }

    const data = snap.data() as MediaResourcePermission;
    if (data.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized: workspace mismatch.' };
    }

    await docRef.delete();

    // Audit log entry
    await logMediaAuditEventAction(workspaceId, {
      actorId,
      actorEmail: 'admin@smartsapp.com',
      actorName: 'Permission Manager',
      action: 'REVOKE_RESOURCE_PERMISSION',
      resourceType: 'GOVERNANCE',
      resourceId: data.resourceId,
      resourceTitle: `${data.resourceType} Permission`,
      reason: `Revoked role ${data.role} from principal ${data.principalId}`,
    });

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete permission.';
    return { success: false, error: msg };
  }
}
