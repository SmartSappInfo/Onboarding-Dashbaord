/**
 * @fileOverview Invite scope check shared by every path that grants workspaces or roles to a new
 * person: `inviteUserAction` (direct account creation) and `dispatchInvitationsAction`
 * (invitation links, applied later by `InvitationLifecycleService.acceptInvitation`).
 *
 * WHY: workspace and role ids arrive from the request. Without this check an authorized manager
 * could attach another tenant's workspaces or roles, or a role carrying `system_admin`, to the
 * account they create, which escalates privileges across tenants or to the platform.
 *
 * Server-only (Admin SDK). Not a 'use server' module: exporting it from one would make it a
 * public endpoint.
 */

import { adminDb } from '@/lib/firebase-admin';

interface ScopedSnapshot {
  exists: boolean;
  data(): { organizationId?: unknown; permissions?: unknown } | undefined;
}

/**
 * Throws unless every workspace and role belongs to `organizationId`, and a role carrying
 * `system_admin` is granted only by a platform system admin. Reads one document per id; callers
 * pass the handful of ids a single invite carries.
 */
export async function assertInviteScope(params: {
  organizationId: string;
  workspaceIds: readonly string[];
  roleIds: readonly string[];
  callerIsSystemAdmin: boolean;
}): Promise<void> {
  const [workspaceSnaps, roleSnaps] = await Promise.all([
    Promise.all(params.workspaceIds.map((id) => adminDb.collection('workspaces').doc(id).get())),
    Promise.all(params.roleIds.map((id) => adminDb.collection('roles').doc(id).get())),
  ]);
  const inOrganization = (snap: ScopedSnapshot) =>
    snap.exists && snap.data()?.organizationId === params.organizationId;

  if (!workspaceSnaps.every(inOrganization)) {
    throw new Error('Forbidden: every workspace must belong to this organization.');
  }
  if (!roleSnaps.every(inOrganization)) {
    throw new Error('Forbidden: every role must belong to this organization.');
  }
  const grantsSystemAdmin = roleSnaps.some((snap: ScopedSnapshot) => {
    const permissions = snap.data()?.permissions;
    return Array.isArray(permissions) && permissions.includes('system_admin');
  });
  if (grantsSystemAdmin && !params.callerIsSystemAdmin) {
    throw new Error('Forbidden: only a platform administrator can grant platform administrator access.');
  }
}
