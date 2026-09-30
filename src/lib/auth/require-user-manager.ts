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

/** Legacy role names that mean "organization administrator" (compared case-insensitively). */
const ADMIN_ROLE_NAMES: ReadonlySet<string> = new Set(['admin', 'administrator', 'org_admin', 'super_admin']);

/**
 * Whether a profile may manage users and the workforce (departments, teams, invitations, access
 * requests, bulk role changes) in its organization. The ONE shared test: user-invite-actions,
 * identity-actions and workforce-actions all use it, so they cannot drift apart again.
 *
 * Accepts every legitimate form in which the app grants this: platform system admin; the legacy
 * `users_manage` / `management_users` ids and their dotted forms `management.users.edit|create`;
 * the RBAC schema (management → users: create or edit); and the legacy admin role names.
 *
 * CAUTION: never accept `isAuthorized` (every approved staff member has it) or a `.view`
 * permission (read-only). workforce-actions once did both, which let any staff member assign
 * themselves roles. Tests: src/lib/auth/__tests__/require-user-manager.test.ts.
 */
export function canManageUsers(profile: UserManagementGrants): boolean {
  const permissions: readonly string[] = profile.permissions ?? [];
  const usersFeature = profile.permissionsSchema?.management?.features?.users;
  return (
    permissions.includes('system_admin') ||
    permissions.includes('users_manage') ||
    permissions.includes('management_users') ||
    permissions.includes('management.users.edit') ||
    permissions.includes('management.users.create') ||
    Boolean(usersFeature?.edit) ||
    Boolean(usersFeature?.create) ||
    (profile.roles ?? []).some((role) => ADMIN_ROLE_NAMES.has(role.toLowerCase()))
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
