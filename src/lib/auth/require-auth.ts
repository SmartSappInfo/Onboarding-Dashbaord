/**
 * @fileOverview Server-side identity for Server Actions and route handlers (audit F14).
 *
 * Server Actions are public HTTP endpoints. Anything reachable through one must
 * establish who is calling *on the server*, from the session cookie — never from a
 * `userId` / `actorId` / `performedBy` parameter, which the caller controls (audit F2).
 *
 * This is the function Phase 4 migrates the remaining action files onto, so the shape
 * here is deliberately small: one call, no options, throws on failure.
 *
 * Node runtime only — `firebase-admin` is unavailable on the Edge runtime, which is
 * why `proxy.ts` checks only for the cookie's presence and this does the real work.
 */
import { cookies } from 'next/headers';
import type { UserProfile } from '@/lib/types';

export interface AuthContext {
  uid: string;
  profile: UserProfile;
  isSystemAdmin: boolean;
}

/** No usable session: the caller is not signed in, or the session is expired/revoked. */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = 'Not signed in.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** Signed in, but not permitted. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = 'Not permitted.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export const SESSION_COOKIE_NAME = '__session';

/**
 * Resolve the caller's verified identity from the session cookie.
 *
 * @throws {UnauthorizedError} No cookie, or the session is expired or revoked, or the
 *         account has no user profile.
 * @throws {ForbiddenError} The account exists but is not yet approved.
 */
export async function requireAuth(): Promise<AuthContext> {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) throw new UnauthorizedError('Not signed in.');

  // Imported lazily so that merely importing this module does not pull firebase-admin
  // into a bundle that may be built for the Edge runtime.
  const { adminAuth, adminDb } = await import('@/lib/firebase-admin');

  let uid: string;
  try {
    // checkRevoked: true — costs a lookup, but means disabling an account takes effect
    // immediately instead of at cookie expiry, up to five days later.
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    uid = decoded.uid;
  } catch {
    throw new UnauthorizedError('Session expired or revoked.');
  }

  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) throw new UnauthorizedError('No user profile.');

  const profile = { id: snap.id, ...snap.data() } as UserProfile;

  // Signup is public, so an account existing proves nothing. Approval is the gate.
  if (!profile.isAuthorized) throw new ForbiddenError('Account pending approval.');

  return {
    uid,
    profile,
    isSystemAdmin: Boolean(profile.permissions?.includes('system_admin')),
  };
}

/**
 * Verified identity plus a workspace membership check.
 *
 * System admins bypass the membership test, matching the Firestore rules helper of the
 * same shape (`canAccessWorkspace`).
 */
export async function requireWorkspace(workspaceId: string): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.isSystemAdmin) return ctx;
  if (!(ctx.profile.workspaceIds ?? []).includes(workspaceId)) {
    throw new ForbiddenError('No access to this workspace.');
  }
  return ctx;
}

/**
 * Verified identity plus a platform system-admin check.
 */
export async function requireSystemAdmin(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.isSystemAdmin) {
    throw new ForbiddenError('Platform system administrator privileges required.');
  }
  return ctx;
}

/**
 * Verified identity plus an organization scope.
 *
 * Many actions take an optional `organizationId` and fall back to a platform-wide
 * default when it is omitted — which, unauthenticated, lets a caller operate against
 * another tenant's configuration or against the platform's own provider credentials.
 *
 * @param organizationId When given, the caller must belong to it (system admins bypass).
 *        When omitted, the caller's own organization is returned.
 * @returns The auth context plus the organization id the caller may actually act on.
 */
export async function requireOrganization(
  organizationId?: string
): Promise<AuthContext & { organizationId: string }> {
  const ctx = await requireAuth();

  if (!organizationId) {
    const own = ctx.profile.organizationId;
    if (!own) throw new ForbiddenError('Account is not attached to an organization.');
    return { ...ctx, organizationId: own };
  }

  if (!ctx.isSystemAdmin && ctx.profile.organizationId !== organizationId) {
    throw new ForbiddenError('No access to this organization.');
  }

  return { ...ctx, organizationId };
}
