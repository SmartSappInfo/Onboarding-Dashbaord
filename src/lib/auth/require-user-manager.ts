/**
 * @fileOverview Guard for server actions that manage OTHER users: invite, change access,
 * remove from the organization, decline a join request, reset a password.
 *
 * Server Actions are public endpoints, so identity comes from the session cookie
 * (`requireOrganization` / `requireAuth`), never from parameters such as an "admin user id".
 * `canManageUsers` is the one permission test these actions share.
 *
 * Platform system admins are protected from organization managers: a manager may not reset,
 * disable or remove a system admin, because a returned temporary password (or a disabled
 * account) would hand over or lock the platform control plane.
 */

import type { UserProfile } from '@/lib/types';
import { requireOrganization, requireSystemAdmin, ForbiddenError, type AuthContext } from './require-auth';

/**
 * The profile fields that decide user-management rights. A `UserProfile` satisfies it; the
 * permission lists are plain strings because stored profiles can carry legacy ids
 * (`users_manage`, `management_users`) that the `AppPermissionId` union no longer lists.
 */
export interface UserManagementGrants {
  permissions?: readonly string[];
  roles?: readonly string[];
  permissionsSchema?: { management?: { features?: { users?: { edit?: boolean; create?: boolean } } } };
}

/**
 * Whether a profile may manage users in its organization. Accepts every form in which the app
 * grants this: platform system admin, the legacy `users_manage` / `management_users`
 * permissions, the RBAC schema (management → users: create or edit), and the legacy
 * `administrator` role that the remove and decline actions honoured before.
 */
export function canManageUsers(profile: UserManagementGrants): boolean {
  const permissions: readonly string[] = profile.permissions ?? [];
  const usersFeature = profile.permissionsSchema?.management?.features?.users;
  return (
    permissions.includes('system_admin') ||
    permissions.includes('users_manage') ||
    permissions.includes('management_users') ||
    Boolean(usersFeature?.edit) ||
    Boolean(usersFeature?.create) ||
    (profile.roles ?? []).includes('administrator')
  );
}

export type UserManagerContext = AuthContext & { organizationId: string };

/**
 * Verified caller who may manage users in `organizationId`.
 *
 * @throws {UnauthorizedError} Not signed in.
 * @throws {ForbiddenError} Outside the organization, or without user-management permission.
 */
export async function requireUserManager(organizationId: string): Promise<UserManagerContext> {
  if (!organizationId) throw new ForbiddenError('An organization is required.');
  const ctx = await requireOrganization(organizationId);
  if (!ctx.isSystemAdmin && !canManageUsers(ctx.profile)) {
    throw new ForbiddenError('You do not have permission to manage users in this organization.');
  }
  return ctx;
}

/**
 * Verified caller who may manage the user `userId`: a user manager in that user's organization,
 * or a platform system admin for a user not attached to an organization yet. Only a system admin
 * may act on another system admin.
 *
 * @returns The caller's context and the target's profile.
 */
export async function requireUserManagerForUser(
  userId: string
): Promise<{ caller: AuthContext; target: UserProfile }> {
  if (!userId) throw new ForbiddenError('A user is required.');

  // Imported lazily, like require-auth, so importing this module does not pull firebase-admin
  // into a bundle built for the Edge runtime.
  const { adminDb } = await import('@/lib/firebase-admin');
  const snap = await adminDb.collection('users').doc(userId).get();
  if (!snap.exists) throw new ForbiddenError('User not found.');
  const target = { id: snap.id, ...snap.data() } as UserProfile;

  const caller: AuthContext = target.organizationId
    ? await requireUserManager(target.organizationId)
    : await requireSystemAdmin();

  if (!caller.isSystemAdmin && (target.permissions ?? []).includes('system_admin')) {
    throw new ForbiddenError('Only a platform administrator can manage a platform administrator.');
  }
  return { caller, target };
}
