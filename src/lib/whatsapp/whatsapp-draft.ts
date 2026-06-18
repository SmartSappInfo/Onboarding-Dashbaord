/**
 * @fileOverview Versioned (de)serialization for the unsaved WhatsApp credential
 * draft kept in the browser. Per `client-localstorage-schema`: carry a `v`
 * schema version so a future field change can't deserialize stale/garbage into
 * the form, and store only the minimal non-secret fields.
 *
 * The System User access token is DELIBERATELY excluded — it never persists in
 * localStorage. `parseDraft` also strips any unexpected keys (defensive), so an
 * older payload that smuggled a token can't resurrect it.
 */

export const DRAFT_VERSION = 1;

/** The non-secret fields safe to keep until the connection is saved. */
export interface CredentialDraft {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  businessName: string;
  appSecret: string;
}

interface VersionedDraft extends CredentialDraft {
  v: number;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function serializeDraft(draft: CredentialDraft): string {
  const payload: VersionedDraft = {
    v: DRAFT_VERSION,
    wabaId: draft.wabaId,
    phoneNumberId: draft.phoneNumberId,
    displayPhoneNumber: draft.displayPhoneNumber,
    businessName: draft.businessName,
    appSecret: draft.appSecret,
  };
  return JSON.stringify(payload);
}

/** Parse a stored draft, or `null` if absent, malformed, or a different version. */
export function parseDraft(raw: string | null): CredentialDraft | null {
  if (!raw) return null;
  let parsed: Partial<VersionedDraft>;
  try {
    parsed = JSON.parse(raw) as Partial<VersionedDraft>;
  } catch {
    return null;
  }
  if (!parsed || parsed.v !== DRAFT_VERSION) return null;
  // Rebuild only known fields — unexpected keys (e.g. a smuggled token) are dropped.
  return {
    wabaId: str(parsed.wabaId),
    phoneNumberId: str(parsed.phoneNumberId),
    displayPhoneNumber: str(parsed.displayPhoneNumber),
    businessName: str(parsed.businessName),
    appSecret: str(parsed.appSecret),
  };
}

export function isDraftEmpty(draft: CredentialDraft): boolean {
  return !Object.values(draft).some((v) => v.trim() !== '');
}
