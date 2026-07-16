import { describe, it, expect } from 'vitest';
import {
  packSerials,
  unpackSerials,
  encrypt64,
  decrypt64,
  encodeBase58,
  decodeBase58
} from '../short-crypto';

describe('Short Cryptography Engine', () => {
  it('correctly packs and unpacks serial integers', () => {
    const contactSerial = 12345678;
    const pageSerial = 87654321;

    const packed = packSerials(contactSerial, pageSerial);
    const unpacked = unpackSerials(packed);

    expect(unpacked.contactSerial).toBe(contactSerial);
    expect(unpacked.pageSerial).toBe(pageSerial);
  });

  it('handles boundary values for packing and unpacking', () => {
    const minVal = 0;
    const maxVal = 0xffffffff; // Max 32-bit unsigned int

    const packedMin = packSerials(minVal, minVal);
    const unpackedMin = unpackSerials(packedMin);
    expect(unpackedMin.contactSerial).toBe(minVal);
    expect(unpackedMin.pageSerial).toBe(minVal);

    const packedMax = packSerials(maxVal, maxVal);
    const unpackedMax = unpackSerials(packedMax);
    expect(unpackedMax.contactSerial).toBe(maxVal);
    expect(unpackedMax.pageSerial).toBe(maxVal);
  });

  it('encrypts and decrypts 64-bit bigint values statelessly', () => {
    const payload = packSerials(987654, 321098);
    const encrypted = encrypt64(payload);
    const decrypted = decrypt64(encrypted);

    expect(decrypted).toBe(payload);
    expect(encrypted).not.toBe(payload); // Ensure it actually obfuscates/encrypts
  });

  it('correctly encodes and decodes Base58 to exactly 11 characters', () => {
    const val = 18446744073709551615n; // Max 64-bit unsigned integer
    const encoded = encodeBase58(val);

    expect(encoded).toHaveLength(11);

    const decoded = decodeBase58(encoded);
    expect(decoded).toBe(val);
  });

  it('is deterministic: same serials yield identical token', () => {
    const contactSerial = 111111;
    const pageSerial = 222222;

    const token1 = encodeBase58(encrypt64(packSerials(contactSerial, pageSerial)));
    const token2 = encodeBase58(encrypt64(packSerials(contactSerial, pageSerial)));

    expect(token1).toBe(token2);
    expect(token1).toHaveLength(11);
  });

  it('throws error for invalid Base58 character or length', () => {
    expect(() => decodeBase58('1234567890')).toThrow('Base58 short link token must be exactly 11 characters');
    expect(() => decodeBase58('1234567890!').toThrow());
  });
});
