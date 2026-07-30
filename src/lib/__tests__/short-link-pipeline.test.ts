/**
 * PURPOSE: Unit test suite for stateless cryptographic short link pipeline.
 * Validates Feistel cipher packing, 11-character Base58 encoding, round-trip encryption/decryption,
 * and legacy AES-256-GCM token decryption compatibility.
 *
 * TESTABILITY: Run via `npx vitest run src/lib/__tests__/short-link-pipeline.test.ts`.
 * RELATED SURFACES: short-crypto.ts, link-tracking.ts, crypto.ts.
 */

import { describe, it, expect } from 'vitest';
import { packSerials, unpackSerials, encrypt64, decrypt64, encodeBase58, decodeBase58 } from '../utils/short-crypto';
import { decryptToken } from '../crypto';

describe('Stateless Short Link Cipher Pipeline', () => {
  it('should correctly pack 32-bit contact and page serials into a 64-bit BigInt', () => {
    const contactSerial = 1234567;
    const pageSerial = 9876543;

    const packed = packSerials(contactSerial, pageSerial);
    const unpacked = unpackSerials(packed);

    expect(unpacked.contactSerial).toBe(contactSerial);
    expect(unpacked.pageSerial).toBe(pageSerial);
  });

  it('should perform round-trip 4-round Feistel cipher encryption and decryption', () => {
    const contactSerial = 42;
    const pageSerial = 1001;

    const packed = packSerials(contactSerial, pageSerial);
    const encrypted = encrypt64(packed);
    const decrypted = decrypt64(encrypted);
    const unpacked = unpackSerials(decrypted);

    expect(unpacked.contactSerial).toBe(contactSerial);
    expect(unpacked.pageSerial).toBe(pageSerial);
  });

  it('should encode encrypted 64-bit bigint into exactly 11 Base58 characters', () => {
    const contactSerial = 88888;
    const pageSerial = 77777;

    const packed = packSerials(contactSerial, pageSerial);
    const encrypted = encrypt64(packed);
    const token = encodeBase58(encrypted);

    expect(token).toHaveLength(11);

    const decoded = decodeBase58(token);
    const decrypted = decrypt64(decoded);
    const unpacked = unpackSerials(decrypted);

    expect(unpacked.contactSerial).toBe(contactSerial);
    expect(unpacked.pageSerial).toBe(pageSerial);
  });

  it('should safely decrypt legacy 3-part hex GCM tokens or return raw text fallback', () => {
    const legacyRaw = 'legacy-unencrypted-token-123';
    const result = decryptToken(legacyRaw);
    expect(result).toBe(legacyRaw);
  });
});
