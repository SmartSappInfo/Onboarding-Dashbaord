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
