'use server';

import { adminAuth, adminDb } from '../firebase-admin';
import { evaluateBackofficePermission } from './backoffice-rbac';
import { BackofficeAuthError } from './backoffice-errors';
import type {
  AuditActor,
  BackofficeRole,
  BackofficeModule,
  BackofficeAction,
} from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Authorization Primitive
// The single source of truth for identity + RBAC in
// every backoffice server action (server-auth-actions).
//
// Server Actions are public endpoints: each one must
// verify the caller's Firebase ID token and enforce the
// ROLE_MATRIX before mutating or reading platform data.
// Never trust a client-supplied AuditActor.
// ─────────────────────────────────────────────────

/** Narrow view of the users/{uid} profile fields we trust for authz. */
interface BackofficeUserProfile {
  email?: string;
  name?: string;
  displayName?: string;
  permissions?: string[];
  backofficeRoles?: BackofficeRole[];
}

/** Main-app system admins are implicitly backoffice super admins. */
function resolveRoles(profile: BackofficeUserProfile): BackofficeRole[] {
  if (profile.permissions?.includes('system_admin')) return ['super_admin'];
  return profile.backofficeRoles ?? [];
}

/**
 * Verifies the Firebase ID token cryptographically and resolves the
 * trusted actor + full role list from Firestore (never from the client).
 *
 * Performs NO RBAC check — use `authorizeBackoffice` in actions.
 *
 * @throws BackofficeAuthError('unauthenticated') if the profile is missing.
 * @throws Error if the token is invalid.
 */
export async function resolveBackofficeActor(
  idToken: string
): Promise<{ actor: AuditActor; roles: BackofficeRole[] }> {
  const decoded = await adminAuth.verifyIdToken(idToken);

  const snap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!snap.exists) {
    throw new BackofficeAuthError('Authenticated user profile not found.', 'unauthenticated');
  }

  const profile = snap.data() as BackofficeUserProfile;
  const roles = resolveRoles(profile);
  const email = profile.email ?? decoded.email ?? '';

  const actor: AuditActor = {
    userId: decoded.uid,
    name: profile.name ?? profile.displayName ?? email,
    email,
    role: roles[0] ?? 'readonly_auditor',
  };

  return { actor, roles };
}

/**
 * Verifies the ID token AND enforces RBAC for (module, action).
 * Call this at the top of every backoffice server action, before
 * any read or mutation (validate → authenticate → authorize → act).
 *
 * @returns the trusted AuditActor for audit logging and updatedBy fields.
 * @throws BackofficeAuthError('forbidden') when the role matrix denies access.
 */
export async function authorizeBackoffice(
  idToken: string,
  module: BackofficeModule,
  action: BackofficeAction = 'view'
): Promise<AuditActor> {
  const { actor, roles } = await resolveBackofficeActor(idToken);

  if (roles.length === 0) {
    throw new BackofficeAuthError('User does not have backoffice access.', 'forbidden');
  }

  if (!evaluateBackofficePermission(roles, module, action)) {
    throw new BackofficeAuthError(`Forbidden: ${module}:${action}`, 'forbidden');
  }

  return actor;
}

/**
 * Session-cookie variant of {@link authorizeBackoffice} (audit F2, Phase 4).
 *
 * Identical trust model and identical role matrix — the only difference is where the
 * identity comes from. `authorizeBackoffice` takes an ID token the client passes
 * explicitly; this reads the `httpOnly` `__session` cookie established in Phase 3, so
 * an action needs no identity argument at all and the caller has nothing to forge.
 *
 * Prefer this in new actions. The token-based function remains for the existing call
 * sites that already thread an `idToken` through.
 *
 * IMPORTANT: authorises against the backoffice ROLE_MATRIX, not `system_admin`.
 * Operators holding `backofficeRoles` but not `system_admin` legitimately run these
 * tools, and gating on system admin alone would lock them out.
 *
 * @returns the trusted AuditActor for audit logging and `executedBy` fields.
 * @throws BackofficeAuthError('unauthenticated') when there is no usable session.
 * @throws BackofficeAuthError('forbidden') when the role matrix denies access.
 */
export async function authorizeBackofficeSession(
  module: BackofficeModule,
  action: BackofficeAction = 'view'
): Promise<AuditActor> {
  const { requireAuth, UnauthorizedError, ForbiddenError } = await import('@/lib/auth/require-auth');

  let uid: string;
  let profile: BackofficeUserProfile;
  try {
    const ctx = await requireAuth();
    uid = ctx.uid;
    profile = ctx.profile as BackofficeUserProfile;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw new BackofficeAuthError(error.message, 'unauthenticated');
    }
    if (error instanceof ForbiddenError) {
      throw new BackofficeAuthError(error.message, 'forbidden');
    }
    throw error;
  }

  const roles = resolveRoles(profile);
  if (roles.length === 0) {
    throw new BackofficeAuthError('User does not have backoffice access.', 'forbidden');
  }
  if (!evaluateBackofficePermission(roles, module, action)) {
    throw new BackofficeAuthError(`Forbidden: ${module}:${action}`, 'forbidden');
  }

  const email = profile.email ?? '';
  return {
    userId: uid,
    name: profile.name ?? profile.displayName ?? email,
    email,
    role: roles[0] ?? 'readonly_auditor',
  };
}

/**
 * Allow either a member of the workspace, or a backoffice operator acting on it.
 *
 * Several actions are reachable from two places: the tenant-facing admin UI, where the
 * caller belongs to the workspace, and the backoffice, where an operator legitimately
 * acts on a workspace they are not a member of. Requiring membership alone would break
 * the backoffice; requiring backoffice roles alone would break the tenant UI.
 *
 * @returns the resolved uid, plus whether it was reached via backoffice authority.
 */
export async function authorizeWorkspaceOrBackoffice(
  workspaceId: string,
  module: BackofficeModule,
  action: BackofficeAction = 'view'
): Promise<{ uid: string; viaBackoffice: boolean }> {
  const { requireWorkspace } = await import('@/lib/auth/require-auth');

  try {
    const ctx = await requireWorkspace(workspaceId);
    return { uid: ctx.uid, viaBackoffice: false };
  } catch (workspaceError) {
    try {
      const actor = await authorizeBackofficeSession(module, action);
      return { uid: actor.userId, viaBackoffice: true };
    } catch {
      // Surface the tenant-path failure: it is the one the typical caller hit.
      throw workspaceError;
    }
  }
}
