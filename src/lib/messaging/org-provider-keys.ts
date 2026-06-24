/**
 * @fileOverview Single source of truth for resolving an organization's custom
 * messaging provider credentials (mNotify SMS key, Resend email key + domain).
 *
 * Previously this logic was duplicated inline in `sendMessage`, `sendRawMessage`,
 * and absent entirely from the bulk-email path (which silently used the platform
 * Resend key — a tenant-isolation hole). Centralizing it keeps every send path
 * using the SAME org-scoped credentials.
 *
 * The pure {@link pickOrgProviderKeys} mapping is unit-tested without Firestore;
 * {@link resolveOrgProviderKeys} wraps it with a lazy admin read.
 */

export interface OrgProviderKeys {
  mnotifyKey?: string;
  resendKey?: string;
  resendDomain?: string;
}

/** Shape of the org fields this resolver reads (loose, mapped from Firestore). */
export interface OrgKeyFields {
  smsKeyMode?: string;
  mnotifyApiKey?: string;
  emailKeyMode?: string;
  resendApiKey?: string;
  resendDomain?: string;
}

/**
 * Pure mapping from org credential fields to the keys to use. Custom keys apply
 * only when the corresponding `*KeyMode` is `'custom'` AND the key is present;
 * otherwise the platform default is used (represented by `undefined`).
 */
export function pickOrgProviderKeys(org: OrgKeyFields | undefined): OrgProviderKeys {
  const keys: OrgProviderKeys = {};
  if (!org) return keys;
  if (org.smsKeyMode === 'custom' && org.mnotifyApiKey) {
    keys.mnotifyKey = org.mnotifyApiKey;
  }
  if (org.emailKeyMode === 'custom' && org.resendApiKey) {
    keys.resendKey = org.resendApiKey;
    keys.resendDomain = org.resendDomain;
  }
  return keys;
}

/**
 * Load an org's custom provider keys. Returns empty (platform defaults) when the
 * org id is falsy, the doc is missing, or a read fails — never throws.
 */
export async function resolveOrgProviderKeys(orgId: string | undefined | null): Promise<OrgProviderKeys> {
  if (!orgId) return {};
  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection('organizations').doc(orgId).get();
    if (!snap.exists) return {};
    const data = snap.data();
    return pickOrgProviderKeys({
      smsKeyMode: typeof data?.smsKeyMode === 'string' ? data.smsKeyMode : undefined,
      mnotifyApiKey: typeof data?.mnotifyApiKey === 'string' ? data.mnotifyApiKey : undefined,
      emailKeyMode: typeof data?.emailKeyMode === 'string' ? data.emailKeyMode : undefined,
      resendApiKey: typeof data?.resendApiKey === 'string' ? data.resendApiKey : undefined,
      resendDomain: typeof data?.resendDomain === 'string' ? data.resendDomain : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ORG-KEYS] Failed to resolve org provider keys (using platform defaults):', message);
    return {};
  }
}
