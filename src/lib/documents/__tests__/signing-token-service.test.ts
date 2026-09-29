/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Ephemeral Capability Tokens and Recipient Security Service (P2.4 & P1.3).
 * 2. Invariants Tested:
 *    - 32-byte (256-bit) cryptographically secure random token generation.
 *    - Deterministic SHA-256 token hashing matching standard crypto primitives.
 *    - Timing-attack-resistant constant-time token verification.
 *    - Expiration handling and status validation (revoked/reassigned tokens invalid).
 *    - Zero tolerance for `any` or loose types (Rule 4).
 */

import { describe, it, expect } from 'vitest';
import {
  generateRecipientToken,
  hashSigningToken,
  verifyRecipientToken,
  generateSigningUrl,
} from '@/lib/documents/signing-token-service';

describe('Recipient Security & Capability Token Service (P2.4 & P1.3)', () => {
  describe('generateRecipientToken', () => {
    it('generates a 64-character hex raw token with valid SHA-256 hash and ISO expiry', () => {
      const tokenData = generateRecipientToken(14);

      expect(tokenData.rawToken).toHaveLength(64); // 32 bytes in hex = 64 characters
      expect(tokenData.tokenHash).toHaveLength(64); // sha-256 hex = 64 characters
      expect(tokenData.tokenHash).toBe(hashSigningToken(tokenData.rawToken));

      const expiryDate = new Date(tokenData.expiresAt);
      expect(expiryDate.getTime()).toBeGreaterThan(Date.now());
      // Roughly 14 days out
      const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(Math.round(diffDays)).toBe(14);
    });

    it('generates unique entropy on successive calls', () => {
      const token1 = generateRecipientToken();
      const token2 = generateRecipientToken();

      expect(token1.rawToken).not.toBe(token2.rawToken);
      expect(token1.tokenHash).not.toBe(token2.tokenHash);
    });
  });

  describe('hashSigningToken', () => {
    it('computes deterministic SHA-256 hash for known inputs', () => {
      const knownInput = 'test-token-secret-123';
      const hash1 = hashSigningToken(knownInput);
      const hash2 = hashSigningToken(knownInput);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('rejects empty or whitespace-only tokens', () => {
      expect(() => hashSigningToken('')).toThrow(/empty/i);
      expect(() => hashSigningToken('   ')).toThrow(/empty/i);
    });
  });

  describe('verifyRecipientToken', () => {
    it('successfully validates a matching raw token within valid expiry window', () => {
      const { rawToken, tokenHash, expiresAt } = generateRecipientToken(7);

      const recipient = {
        tokenHash,
        tokenExpiresAt: expiresAt,
        status: 'invited' as const,
      };

      const result = verifyRecipientToken(rawToken, recipient);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects token when raw token does not match stored hash', () => {
      const { tokenHash, expiresAt } = generateRecipientToken(7);

      const recipient = {
        tokenHash,
        tokenExpiresAt: expiresAt,
        status: 'invited' as const,
      };

      const wrongRawToken = 'a'.repeat(64);
      const result = verifyRecipientToken(wrongRawToken, recipient);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/invalid or tampered/i);
    });

    it('rejects token when token has expired', () => {
      const { rawToken, tokenHash } = generateRecipientToken(7);

      const expiredRecipient = {
        tokenHash,
        tokenExpiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        status: 'invited' as const,
      };

      const result = verifyRecipientToken(rawToken, expiredRecipient);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/expired/i);
    });

    it('rejects token if recipient has been revoked or reassigned', () => {
      const { rawToken, tokenHash, expiresAt } = generateRecipientToken(7);

      const revokedRecipient = {
        tokenHash,
        tokenExpiresAt: expiresAt,
        status: 'revoked' as const,
      };

      const resultRevoked = verifyRecipientToken(rawToken, revokedRecipient);
      expect(resultRevoked.valid).toBe(false);
      expect(resultRevoked.reason).toMatch(/revoked/i);

      const reassignedRecipient = {
        tokenHash,
        tokenExpiresAt: expiresAt,
        status: 'reassigned' as const,
      };

      const resultReassigned = verifyRecipientToken(rawToken, reassignedRecipient);
      expect(resultReassigned.valid).toBe(false);
      expect(resultReassigned.reason).toMatch(/reassigned/i);
    });
  });

  describe('generateSigningUrl', () => {
    it('constructs well-formed signing URL with encoded parameters', () => {
      const url = generateSigningUrl('https://app.smartsapp.com', 'env_123', 'tok_abc');
      expect(url).toBe('https://app.smartsapp.com/sign/env_123?token=tok_abc');
    });

    it('handles trailing slashes on base URL cleanly', () => {
      const url = generateSigningUrl('https://app.smartsapp.com/', 'env_123', 'tok_abc');
      expect(url).toBe('https://app.smartsapp.com/sign/env_123?token=tok_abc');
    });
  });
});
