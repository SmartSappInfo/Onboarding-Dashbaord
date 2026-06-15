import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  toPublicConnection,
  deriveTokenLast4,
  buildConnectionRecord,
  type SaveConnectionInput,
} from '../whatsapp-connection';
import { decrypt } from '../crypto-vault';
import type { WhatsAppConnection } from '../whatsapp-types';

/**
 * Phase 1 — the redacted projection is the ONLY shape allowed to cross the
 * server→client boundary (spec R5). These tests pin that no secret material can
 * leak through it.
 */

function sampleConnection(): WhatsAppConnection {
  return {
    id: 'org_123',
    organizationId: 'org_123',
    connectionType: 'manual',
    wabaId: 'waba_1',
    phoneNumberId: 'pn_1',
    displayPhoneNumber: '+233200000000',
    businessName: 'Acme',
    accessToken: { cipher: 'C', iv: 'I', tag: 'T', keyId: 'default' },
    appSecret: { cipher: 'C2', iv: 'I2', tag: 'T2', keyId: 'default' },
    tokenLast4: 'wxyz',
    webhookVerifyToken: 'super-secret-verify-token',
    status: 'connected',
    qualityRating: 'GREEN',
    messagingLimit: 'TIER_1K',
    createdAt: '2026-06-14T00:00:00.000Z',
    updatedAt: '2026-06-14T00:00:00.000Z',
  };
}

describe('toPublicConnection', () => {
  it('strips every secret field', () => {
    const pub = toPublicConnection(sampleConnection());
    expect('accessToken' in pub).toBe(false);
    expect('appSecret' in pub).toBe(false);
    expect('webhookVerifyToken' in pub).toBe(false);
  });

  it('does not leak any secret value when serialized', () => {
    const blob = JSON.stringify(toPublicConnection(sampleConnection()));
    expect(blob).not.toContain('super-secret-verify-token');
    expect(blob).not.toContain('"cipher"');
    expect(blob).not.toContain('keyId');
  });

  it('exposes safe display fields and hasToken flags', () => {
    const pub = toPublicConnection(sampleConnection());
    expect(pub.organizationId).toBe('org_123');
    expect(pub.displayPhoneNumber).toBe('+233200000000');
    expect(pub.status).toBe('connected');
    expect(pub.qualityRating).toBe('GREEN');
    expect(pub.tokenLast4).toBe('wxyz');
    expect(pub.hasToken).toBe(true);
    expect(pub.hasAppSecret).toBe(true);
  });

  it('reports hasToken/hasAppSecret false when absent', () => {
    const conn = sampleConnection();
    // @ts-expect-error — exercise the missing-secret path
    delete conn.accessToken;
    delete conn.appSecret;
    const pub = toPublicConnection(conn);
    expect(pub.hasToken).toBe(false);
    expect(pub.hasAppSecret).toBe(false);
  });
});

describe('deriveTokenLast4', () => {
  it('returns the last 4 characters', () => {
    expect(deriveTokenLast4('EAAGabcd1234wxyz')).toBe('wxyz');
  });
  it('handles short tokens without throwing', () => {
    expect(deriveTokenLast4('ab')).toBe('ab');
    expect(deriveTokenLast4('')).toBe('');
  });
});

describe('buildConnectionRecord', () => {
  let savedKey: string | undefined;
  beforeEach(() => {
    savedKey = process.env.WHATSAPP_ENCRYPTION_KEY;
    process.env.WHATSAPP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.WHATSAPP_ENCRYPTION_KEY;
    else process.env.WHATSAPP_ENCRYPTION_KEY = savedKey;
  });

  const input: SaveConnectionInput = {
    organizationId: 'org_123',
    wabaId: 'waba_1',
    phoneNumberId: 'pn_1',
    displayPhoneNumber: '+233200000000',
    accessToken: 'EAAG-plaintext-token-1234',
    appSecret: 'app-secret-xyz',
    createdBy: 'u1',
  };

  it('encrypts the token (no plaintext at rest) but round-trips via decrypt', () => {
    const rec = buildConnectionRecord(input, { now: 'NOW', webhookVerifyToken: 'vt' });
    expect(JSON.stringify(rec.accessToken)).not.toContain('EAAG-plaintext-token-1234');
    expect(decrypt(rec.accessToken)).toBe('EAAG-plaintext-token-1234');
    expect(rec.tokenLast4).toBe('1234');
  });

  it('encrypts the app secret only when provided', () => {
    const withSecret = buildConnectionRecord(input, { now: 'NOW', webhookVerifyToken: 'vt' });
    expect(withSecret.appSecret).toBeDefined();
    expect(decrypt(withSecret.appSecret!)).toBe('app-secret-xyz');

    const { appSecret, ...rest } = input;
    const without = buildConnectionRecord(rest, { now: 'NOW', webhookVerifyToken: 'vt' });
    expect(without.appSecret).toBeUndefined();
  });

  it('keys the record by organizationId and defaults to manual + pending', () => {
    const rec = buildConnectionRecord(input, { now: 'NOW', webhookVerifyToken: 'vt' });
    expect(rec.id).toBe('org_123');
    expect(rec.connectionType).toBe('manual');
    expect(rec.status).toBe('pending');
    expect(rec.createdAt).toBe('NOW');
  });

  it('preserves immutable fields on update (createdAt, webhookVerifyToken)', () => {
    const existing = buildConnectionRecord(input, { now: 'CREATED', webhookVerifyToken: 'original-vt' });
    const updated = buildConnectionRecord(
      { ...input, accessToken: 'EAAG-rotated-5678' },
      { now: 'UPDATED', webhookVerifyToken: 'ignored-new-vt', existing },
    );
    expect(updated.createdAt).toBe('CREATED');
    expect(updated.webhookVerifyToken).toBe('original-vt');
    expect(updated.updatedAt).toBe('UPDATED');
    expect(updated.tokenLast4).toBe('5678');
  });
});
