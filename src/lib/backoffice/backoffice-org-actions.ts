'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';

import type { AuditActor } from './backoffice-types';
import type { Organization } from '../types';

// ─────────────────────────────────────────────────
// Backoffice Organization Server Actions
// Extends existing organization-actions.ts with
// backoffice-specific operations and audit logging.
// ─────────────────────────────────────────────────

/**
 * Lists all organizations with computed stats.
 */
export async function listAllOrganizations(): Promise<{
  success: boolean;
  data?: (Organization & {
    workspaceCount: number;
    userCount: number;
    activeUsers: number;
  })[];
  error?: string;
}> {
  try {
    const [orgsSnap, workspacesSnap, usersSnap] = await Promise.all([
      adminDb.collection('organizations').orderBy('name', 'asc').get(),
      adminDb.collection('workspaces').get(),
      adminDb.collection('users').get(),
    ]);

    const orgs = orgsSnap.docs.map((doc) => {
      const data = doc.data() as Organization;
      const orgId = doc.id;

      // Count workspaces and users for this org
      const workspaceCount = workspacesSnap.docs.filter(
        (w) => w.data().organizationId === orgId
      ).length;

      const orgUsers = usersSnap.docs.filter(
        (u) => u.data().organizationId === orgId
      );
      const userCount = orgUsers.length;
      const activeUsers = orgUsers.filter(
        (u) => u.data().isAuthorized !== false
      ).length;

      return {
        ...data,
        id: orgId,
        workspaceCount,
        userCount,
        activeUsers,
      };
    });

    return { success: true, data: orgs };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] listAllOrganizations failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets detailed information about a single organization.
 */
export async function getOrganizationDetail(orgId: string): Promise<{
  success: boolean;
  data?: Organization & {
    workspaceCount: number;
    userCount: number;
    activeUsers: number;
    entityCount: number;
  };
  error?: string;
}> {
  try {
    const [orgSnap, workspacesSnap, usersSnap, entitiesSnap] = await Promise.all([
      adminDb.collection('organizations').doc(orgId).get(),
      adminDb.collection('workspaces').where('organizationId', '==', orgId).get(),
      adminDb.collection('users').where('organizationId', '==', orgId).get(),
      adminDb.collection('entities').where('organizationId', '==', orgId).get(),
    ]);

    if (!orgSnap.exists) {
      return { success: false, error: 'Organization not found' };
    }

    const data = orgSnap.data() as Organization;
    const orgUsers = usersSnap.docs;

    return {
      success: true,
      data: {
        ...data,
        id: orgId,
        workspaceCount: workspacesSnap.size,
        userCount: orgUsers.length,
        activeUsers: orgUsers.filter((u) => u.data().isAuthorized !== false).length,
        entityCount: entitiesSnap.size,
      },
    };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] getOrganizationDetail failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Suspends an organization — all workspace access is blocked.
 * Requires elevated confirmation (dangerous action).
 */
export async function suspendOrganization(
  orgId: string,
  reason: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) {
      return { success: false, error: 'Organization not found' };
    }

    const before = createAuditSnapshot(orgSnap.data() as Record<string, unknown>);

    await adminDb.collection('organizations').doc(orgId).update({
      status: 'suspended',
      suspendedAt: new Date().toISOString(),
      suspendedBy: actor.userId,
      suspensionReason: reason,
      updatedAt: new Date().toISOString(),
    });

    const afterSnap = await adminDb.collection('organizations').doc(orgId).get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'organization.suspend', 'organization', orgId, {
      scope: 'organization',
      scopeId: orgId,
      before,
      after,
      metadata: { reason },
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] suspendOrganization failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Restores a suspended organization.
 */
export async function restoreOrganization(
  orgId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) {
      return { success: false, error: 'Organization not found' };
    }

    const before = createAuditSnapshot(orgSnap.data() as Record<string, unknown>);

    await adminDb.collection('organizations').doc(orgId).update({
      status: 'active',
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
      updatedAt: new Date().toISOString(),
    });

    const afterSnap = await adminDb.collection('organizations').doc(orgId).get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'organization.restore', 'organization', orgId, {
      scope: 'organization',
      scopeId: orgId,
      before,
      after,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] restoreOrganization failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates organization details from the backoffice.
 * Wraps the update with audit logging.
 */
export async function updateOrganizationFromBackoffice(
  orgId: string,
  updates: Partial<Organization>,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) {
      return { success: false, error: 'Organization not found' };
    }

    const before = createAuditSnapshot(orgSnap.data() as Record<string, unknown>);

    await adminDb.collection('organizations').doc(orgId).update({
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    });

    const afterSnap = await adminDb.collection('organizations').doc(orgId).get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'organization.update', 'organization', orgId, {
      scope: 'organization',
      scopeId: orgId,
      before,
      after,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] updateOrganizationFromBackoffice failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets diagnostic information for an organization.
 * Used for health checks and support troubleshooting.
 */
export async function getOrganizationDiagnostics(orgId: string): Promise<{
  success: boolean;
  data?: {
    orgId: string;
    status: string;
    workspaces: { id: string; name: string; status: string; scope: string }[];
    userCount: number;
    entityCount: number;
    featureOverrides: Record<string, boolean>;
    hasCustomRoles: boolean;
    createdAt: string;
  };
  error?: string;
}> {
  try {
    const [orgSnap, workspacesSnap, usersSnap, entitiesSnap, rolesSnap] = await Promise.all([
      adminDb.collection('organizations').doc(orgId).get(),
      adminDb.collection('workspaces').where('organizationId', '==', orgId).get(),
      adminDb.collection('users').where('organizationId', '==', orgId).get(),
      adminDb.collection('entities').where('organizationId', '==', orgId).get(),
      adminDb.collection('roles').where('organizationId', '==', orgId).get(),
    ]);

    if (!orgSnap.exists) {
      return { success: false, error: 'Organization not found' };
    }

    const orgData = orgSnap.data() as Organization;

    return {
      success: true,
      data: {
        orgId,
        status: orgData.status || 'active',
        workspaces: workspacesSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          status: d.data().status,
          scope: d.data().contactScope || 'unknown',
        })),
        userCount: usersSnap.size,
        entityCount: entitiesSnap.size,
        featureOverrides: orgData.enabledFeatures || {},
        hasCustomRoles: rolesSnap.docs.some((d) => !d.data().isDefault),
        createdAt: orgData.createdAt,
      },
    };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] getOrganizationDiagnostics failed:', error);
    return { success: false, error: error.message };
  }
}
