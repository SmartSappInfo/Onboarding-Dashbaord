// NOTE: intentionally NOT 'use server' (audit F2).
//
// These are permission *helpers*: they answer "does user X hold permission Y" and are
// called by Server Actions that have already verified the caller. The uid parameter is
// correct here — it is the subject of the question, not a claim of identity.
//
// The directive was removed because it made every helper a public HTTP endpoint. No
// client component imports this module, so nothing depends on the directive; the only
// thing it added was reachability.

import { adminDb } from './firebase-admin';
import type { AppPermissionId, UserProfile } from './types';

/**
 * Checks whether a user has a specific permission.
 * Permissions are stored directly on the user document (flattened from roles).
 * System admins (system_admin permission) bypass all checks.
 * Requirements: FR7.2.1, FR7.2.2
 */
export async function userHasTagPermission(
  userId: string,
  permission: AppPermissionId
): Promise<boolean> {
  try {
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) return false;

    const user = userSnap.data() as UserProfile;
    const permissions: AppPermissionId[] = user.permissions || [];

    // System admins bypass all permission checks
    if (permissions.includes('system_admin')) return true;

    return permissions.includes(permission);
  } catch {
    return false;
  }
}
