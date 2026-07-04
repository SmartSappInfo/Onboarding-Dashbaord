import { describe, it, expect, vi, beforeEach } from 'vitest';

const { encrypt, decrypt, isVaultConfigured } = vi.hoisted(() => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  isVaultConfigured: vi.fn(),
}));

vi.mock('../../whatsapp/crypto-vault', () => ({ encrypt, decrypt, isVaultConfigured }));

import { isEnvelope, sealSecret, openSecret } from '../secret-vault';

const envelope = { cipher: 'c', iv: 'i', tag: 't', keyId: 'k1' };

beforeEach(() => vi.clearAllMocks());

describe('isEnvelope', () => {
  it('recognizes a sealed envelope', () => {
    expect(isEnvelope(envelope)).toBe(true);
  });
  it('rejects plaintext strings, null, and partial objects', () => {
    expect(isEnvelope('AIzaSyPlain')).toBe(false);
    expect(isEnvelope(null)).toBe(false);
    expect(isEnvelope({ cipher: 'c' })).toBe(false);
    expect(isEnvelope(undefined)).toBe(false);
  });
});

describe('sealSecret', () => {
  it('encrypts when the vault is configured', () => {
    isVaultConfigured.mockReturnValue(true);
    encrypt.mockReturnValue(envelope);
    expect(sealSecret('secret')).toEqual(envelope);
    expect(encrypt).toHaveBeenCalledWith('secret');
  });

  it('throws (never stores plaintext) when the vault is not configured', () => {
    isVaultConfigured.mockReturnValue(false);
    expect(() => sealSecret('secret')).toThrow(/not configured/i);
    expect(encrypt).not.toHaveBeenCalled();
  });
});

describe('openSecret', () => {
  it('decrypts a sealed envelope', () => {
    decrypt.mockReturnValue('plain');
    expect(openSecret(envelope)).toBe('plain');
    expect(decrypt).toHaveBeenCalledWith(envelope);
  });

  it('passes through legacy plaintext strings', () => {
    expect(openSecret('AIzaSyLegacy')).toBe('AIzaSyLegacy');
    expect(decrypt).not.toHaveBeenCalled();
  });

  it('returns undefined for empty/missing values', () => {
    expect(openSecret('')).toBeUndefined();
    expect(openSecret(undefined)).toBeUndefined();
    expect(openSecret(null)).toBeUndefined();
  });
});
