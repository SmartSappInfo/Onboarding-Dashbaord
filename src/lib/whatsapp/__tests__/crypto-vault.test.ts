import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  encrypt,
  decrypt,
  generateEncryptionKey,
  isVaultConfigured,
  type EncryptedEnvelope,
} from '../crypto-vault';

/**
 * Phase 0 — crypto-vault characterization.
 *
 * Tokens (Meta System User access tokens, app secrets) are AES-256-GCM
 * encrypted at rest. These tests pin the security guarantees: round-trip
 * fidelity, non-determinism (fresh IV per call), and tamper detection via
 * the GCM auth tag. See spec §3A (F9) and §9.
 */

const validKey = () => crypto.randomBytes(32).toString('hex');

describe('crypto-vault', () => {
  let savedKey: string | undefined;
  let savedKeyId: string | undefined;
  let savedRetired: string | undefined;

  beforeEach(() => {
    savedKey = process.env.WHATSAPP_ENCRYPTION_KEY;
    savedKeyId = process.env.WHATSAPP_ENCRYPTION_KEY_ID;
    savedRetired = process.env.WHATSAPP_ENCRYPTION_KEYS_RETIRED;
    process.env.WHATSAPP_ENCRYPTION_KEY = validKey();
    delete process.env.WHATSAPP_ENCRYPTION_KEY_ID;
    delete process.env.WHATSAPP_ENCRYPTION_KEYS_RETIRED;
  });

  afterEach(() => {
    // Restore env so tests stay isolated.
    const restore = (k: string, v: string | undefined) =>
      v === undefined ? delete process.env[k] : (process.env[k] = v);
    restore('WHATSAPP_ENCRYPTION_KEY', savedKey);
    restore('WHATSAPP_ENCRYPTION_KEY_ID', savedKeyId);
    restore('WHATSAPP_ENCRYPTION_KEYS_RETIRED', savedRetired);
  });

  it('round-trips plaintext exactly', () => {
    const secret = 'EAAG...meta-system-user-token...xyz';
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('round-trips unicode and empty strings', () => {
    expect(decrypt(encrypt(''))).toBe('');
    expect(decrypt(encrypt('🔐 sécret — 日本語'))).toBe('🔐 sécret — 日本語');
  });

  it('produces a non-deterministic ciphertext (fresh IV per call)', () => {
    const a = encrypt('same-plaintext');
    const b = encrypt('same-plaintext');
    expect(a.iv).not.toBe(b.iv);
    expect(a.cipher).not.toBe(b.cipher);
    // ...yet both decrypt back to the same value.
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it('never emits the plaintext inside the envelope', () => {
    const env = encrypt('plaintext-must-not-leak');
    const blob = JSON.stringify(env);
    expect(blob).not.toContain('plaintext-must-not-leak');
  });

  it('stamps the current keyId on the envelope', () => {
    process.env.WHATSAPP_ENCRYPTION_KEY_ID = 'v2';
    expect(encrypt('x').keyId).toBe('v2');
  });

  it('rejects a tampered auth tag', () => {
    const env = encrypt('integrity-protected');
    const tampered: EncryptedEnvelope = { ...env, tag: flipFirstByteB64(env.tag) };
    expect(() => decrypt(tampered)).toThrow();
  });

  it('rejects tampered ciphertext', () => {
    const env = encrypt('integrity-protected');
    const tampered: EncryptedEnvelope = { ...env, cipher: flipFirstByteB64(env.cipher) };
    expect(() => decrypt(tampered)).toThrow();
  });

  it('rejects an unknown keyId (rotation safety)', () => {
    const env = encrypt('x');
    expect(() => decrypt({ ...env, keyId: 'no-such-key' })).toThrow(/keyId/i);
  });

  it('decrypts with a retired key after rotation', () => {
    // Encrypt under the original "default" key.
    const original = encrypt('rotate-me');
    const oldKeyHex = process.env.WHATSAPP_ENCRYPTION_KEY!;
    // Rotate: new current key, old key retired and still resolvable by keyId.
    process.env.WHATSAPP_ENCRYPTION_KEY = validKey();
    process.env.WHATSAPP_ENCRYPTION_KEY_ID = 'v2';
    process.env.WHATSAPP_ENCRYPTION_KEYS_RETIRED = JSON.stringify({ default: oldKeyHex });
    expect(decrypt(original)).toBe('rotate-me');
    expect(encrypt('new').keyId).toBe('v2');
  });

  it('throws a clear error when the key is missing', () => {
    delete process.env.WHATSAPP_ENCRYPTION_KEY;
    expect(isVaultConfigured()).toBe(false);
    expect(() => encrypt('x')).toThrow(/WHATSAPP_ENCRYPTION_KEY/);
  });

  it('throws when the key is not 32 bytes', () => {
    process.env.WHATSAPP_ENCRYPTION_KEY = 'deadbeef'; // 4 bytes
    expect(() => encrypt('x')).toThrow(/32 bytes/);
  });

  it('generateEncryptionKey() returns a usable 32-byte hex key', () => {
    const key = generateEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    process.env.WHATSAPP_ENCRYPTION_KEY = key;
    expect(decrypt(encrypt('works'))).toBe('works');
  });
});

/** Flip the first byte of a base64 payload to simulate corruption. */
function flipFirstByteB64(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  buf[0] = buf[0] ^ 0xff;
  return buf.toString('base64');
}
