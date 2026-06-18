import { describe, it, expect } from 'vitest';
import {
  serializeDraft,
  parseDraft,
  isDraftEmpty,
  DRAFT_VERSION,
  type CredentialDraft,
} from '../whatsapp-draft';

/**
 * Phase 0 — versioned credential-draft (de)serialization. The browser keeps an
 * unsaved draft so a reload/failed save doesn't lose typed input; the access
 * token is never part of it. Per `client-localstorage-schema`, a schema version
 * guards against deserializing stale/garbage after a field change.
 */
const sample: CredentialDraft = {
  wabaId: '123',
  phoneNumberId: '456',
  displayPhoneNumber: '+233200000000',
  businessName: 'Acme',
  appSecret: 'sek',
};

describe('whatsapp-draft', () => {
  it('round-trips a draft', () => {
    expect(parseDraft(serializeDraft(sample))).toEqual(sample);
  });

  it('embeds the schema version', () => {
    expect(JSON.parse(serializeDraft(sample)).v).toBe(DRAFT_VERSION);
  });

  it('returns null for null or empty input', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseDraft('{not json')).toBeNull();
  });

  it('returns null when the version is missing or mismatched', () => {
    expect(parseDraft(JSON.stringify({ ...sample }))).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 999, ...sample }))).toBeNull();
  });

  it('coerces missing fields to empty strings', () => {
    const d = parseDraft(JSON.stringify({ v: DRAFT_VERSION, wabaId: 'x' }));
    expect(d).toEqual({
      wabaId: 'x',
      phoneNumberId: '',
      displayPhoneNumber: '',
      businessName: '',
      appSecret: '',
    });
  });

  it('never persists an access token field even if present in input', () => {
    const withToken = JSON.stringify({ v: DRAFT_VERSION, ...sample, accessToken: 'EAA-secret' });
    const parsed = parseDraft(withToken) as CredentialDraft & { accessToken?: string };
    expect(parsed.accessToken).toBeUndefined();
  });

  it('isDraftEmpty is true only when every field is blank', () => {
    expect(
      isDraftEmpty({ wabaId: '', phoneNumberId: '', displayPhoneNumber: '', businessName: '', appSecret: '' }),
    ).toBe(true);
    expect(isDraftEmpty(sample)).toBe(false);
  });
});
