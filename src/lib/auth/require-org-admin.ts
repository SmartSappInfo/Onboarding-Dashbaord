/**
 * @fileOverview Authorization guard for organization-admin server actions.
 *
 * Server Actions are public endpoints — auth MUST be verified inside the action,
 * not just by page/layout guards (spec R1, `vercel:server-auth-actions`). The
 * codebase's pattern is: client passes a Firebase ID token → the action verifies
 * it with `adminAuth.verifyIdToken` → load `users/{uid}` → check permissions
 * (see backoffice-job-actions.ts).
 *
 * The pure {@link canManageOrgIntegrations} decision is split out so it is
 * unit-testable without Firebase; `requireOrgAdmin` wraps it with token
 * verification and profile loading (firebase-admin is imported lazily so this
 * module stays client-unbundlable and importable in pure tests).
 */

import { evaluatePermission } from '@/lib/permissions-engine';
import type { UserProfile } from '@/lib/types';

/**
 * Whether a profile may manage this org's integrations/credentials. Mirrors how
 * `/admin/settings` is gated: management → systemSettings (edit).
 *
 * A platform `system_admin` is a cross-tenant operator (tenant-switching in
 * TenantContext, the backoffice control plane) so it may manage ANY org's
 * integrations. Everyone else is bound to their own org and needs the
 * systemSettings edit permission there.
 */
export function canManageOrgIntegrations(
  profile: UserProfile | undefined,
  organizationId: string,
): boolean {
  if (!profile?.isAuthorized) return false;
  if (profile.permissions?.includes('system_admin')) return true;
  if (profile.organizationId !== organizationId) return false;
  return evaluatePermission(profile.permissionsSchema, 'management', 'systemSettings', 'edit');
}

/**
 * Platform-level system admin (control plane). Used by the backoffice WhatsApp
 * registry, which spans all organizations — so it is NOT org-scoped.
 */
export function isSystemAdmin(profile: UserProfile | undefined): boolean {
  if (!profile?.isAuthorized) return false;
  return !!profile.permissions?.includes('system_admin');
}

export interface OrgAdminContext {
  uid: string;
  profile: UserProfile;
}

/**
 * Verify the caller is an admin of `organizationId`. Throws `Unauthorized` /
 * `Forbidden` on failure — call at the top of every WhatsApp credential action.
 */
export async function requireOrgAdmin(
  idToken: string,
  organizationId: string,
): Promise<OrgAdminContext> {
  if (!idToken) throw new Error('Unauthorized: missing credentials.');

  // Lazy import keeps firebase-admin out of the module graph for pure tests
  // and client bundles, matching the messaging-engine dynamic-import pattern.
  const { adminAuth, adminDb } = await import('@/lib/firebase-admin');

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    throw new Error('Unauthorized: invalid session.');
  }

  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) throw new Error('Unauthorized: no user profile.');
  const profile = snap.data() as UserProfile;

  if (!canManageOrgIntegrations(profile, organizationId)) {
    throw new Error('Forbidden: requires organization admin (systemSettings).');
  }

  return { uid, profile };
}

/** Verify the caller is a platform system admin (backoffice control plane). */
export async function requireSystemAdmin(idToken: string): Promise<OrgAdminContext> {
  if (!idToken) throw new Error('Unauthorized: missing credentials.');
  const { adminAuth, adminDb } = await import('@/lib/firebase-admin');

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    throw new Error('Unauthorized: invalid session.');
  }

  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) throw new Error('Unauthorized: no user profile.');
  const profile = snap.data() as UserProfile;

  if (!isSystemAdmin(profile)) {
    throw new Error('Forbidden: requires platform system admin.');
  }
  return { uid, profile };
}
