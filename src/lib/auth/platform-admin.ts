/**
 * @fileOverview Platform super-admin identification (audit F8).
 *
 * Authority used to be `email === 'admin@smartsapp.com'`, compared in 20 places in the
 * application and 43 in `firestore.rules`. That is fragile in three distinct ways:
 *
 *   1. **An email address is not a credential.** Anyone who can create or take over that
 *      mailbox — or an auth provider that lets an unverified address be claimed — becomes
 *      platform administrator. Nothing in the rules required `email_verified`.
 *   2. **It bootstrapped a profile that did not exist.** Both `api-auth-guard` and the
 *      identity actions fabricated a full system-admin profile for a token bearing that
 *      address even when the account had no Firestore record at all, so account
 *      deactivation could not revoke it.
 *   3. **It could not be revoked or rotated.** Removing access meant editing code.
 *
 * Authority is now a Firebase custom claim, `admin: true`, set with
 * `adminAuth.setCustomUserClaims()`. Claims are signed into the ID token, readable by
 * Firestore rules as `request.auth.token.admin`, and revocable without a deploy.
 */
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { UserProfile } from '@/lib/types';

/** Reads the platform-admin custom claim from a verified token. */
export function hasPlatformAdminClaim(token: Pick<DecodedIdToken, 'admin'> | Record<string, unknown> | null | undefined): boolean {
  if (!token) return false;
  return (token as Record<string, unknown>).admin === true;
}

/**
 * Whether the caller is a platform system administrator.
 *
 * Either the signed custom claim, or `system_admin` in the stored profile. Both are
 * server-controlled; neither can be asserted by the caller.
 */
export function isPlatformSystemAdmin(
  token: Record<string, unknown> | null | undefined,
  profile: Pick<UserProfile, 'permissions'> | null | undefined
): boolean {
  if (hasPlatformAdminClaim(token)) return true;
  return Boolean(profile?.permissions?.includes('system_admin'));
}

/**
 * Grant or revoke the platform-admin claim.
 *
 * The user must sign out and back in (or refresh their ID token) before the change is
 * visible to Firestore rules, since claims travel in the token.
 */
export async function setPlatformAdminClaim(uid: string, isAdmin: boolean): Promise<void> {
  const { adminAuth } = await import('@/lib/firebase-admin');
  const user = await adminAuth.getUser(uid);
  const claims = { ...(user.customClaims || {}) };
  if (isAdmin) claims.admin = true;
  else delete claims.admin;
  await adminAuth.setCustomUserClaims(uid, claims);
}
