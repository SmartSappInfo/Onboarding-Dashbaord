/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Cryptographic Capability Token service for multi-party document signing (P2.4 & P1.3).
 * 2. Security & Invariants:
 *    - High-Entropy Generation: 32 bytes (256 bits) of cryptographically secure random entropy per token.
 *    - Never Store Plaintext: Raw tokens are NEVER stored in Firestore or database ledgers.
 *      Only the SHA-256 digest (`tokenHash`) is persisted in `recipients[i].tokenHash`.
 *    - Timing-Attack Defense: Uses `crypto.timingSafeEqual` when verifying candidate token hashes.
 *    - Revocation Enforcement: Tokens belonging to recipients with status 'revoked', 'reassigned',
 *      or past their `tokenExpiresAt` are rejected immediately.
 * 3. Strict Typing Standard (Rule 4):
 *    Zero tolerance for `any` or `any[]`.
 */

import crypto from 'node:crypto';
import type { RecipientStatus } from '@/lib/types/document-signing';

export interface GeneratedRecipientToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: string;
}

export interface VerifyTokenRecipientInput {
  tokenHash: string;
  tokenExpiresAt: string;
  status: RecipientStatus;
}

export interface VerifyTokenResult {
  valid: boolean;
  reason?: string;
}

/**
 * Generates a cryptographically strong ephemeral capability token (32 bytes random entropy)
 * along with its SHA-256 storage hash and ISO 8601 expiration date.
 */
export function generateRecipientToken(expiresInDays = 14): GeneratedRecipientToken {
  const rawBytes = crypto.randomBytes(32);
  const rawToken = rawBytes.toString('hex');
  const tokenHash = hashSigningToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

/**
 * Deterministically computes the SHA-256 hex digest of a raw capability token.
 */
export function hashSigningToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    throw new Error('Raw signing token cannot be empty or whitespace.');
  }

  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Verifies a raw token against a recipient's stored hash and status invariants.
 * Uses timing-safe equality comparison to mitigate side-channel timing attacks.
 */
export function verifyRecipientToken(
  rawToken: string,
  recipient: VerifyTokenRecipientInput
): VerifyTokenResult {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    return {
      valid: false,
      reason: 'Missing or empty signing capability token.',
    };
  }

  // 1. Status Check
  if (recipient.status === 'revoked') {
    return {
      valid: false,
      reason: 'This signing invitation has been revoked by the sender.',
    };
  }

  if (recipient.status === 'reassigned') {
    return {
      valid: false,
      reason: 'This signing role has been reassigned to another signatory.',
    };
  }

  // 2. Expiry Check
  const expiresAtTime = new Date(recipient.tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAtTime) || expiresAtTime <= Date.now()) {
    return {
      valid: false,
      reason: 'This signing link has expired. Please contact the sender for a new link.',
    };
  }

  // 3. Hash Validation with Timing-Safe Comparison
  try {
    const candidateHash = hashSigningToken(rawToken);
    const candidateBuf = Buffer.from(candidateHash, 'hex');
    const storedBuf = Buffer.from(recipient.tokenHash, 'hex');

    if (candidateBuf.length !== storedBuf.length) {
      return {
        valid: false,
        reason: 'Invalid or tampered signing link.',
      };
    }

    const matches = crypto.timingSafeEqual(candidateBuf, storedBuf);
    if (!matches) {
      return {
        valid: false,
        reason: 'Invalid or tampered signing link.',
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      reason: 'Invalid or tampered signing link.',
    };
  }
}

/**
 * Helper to construct the clean public signing URL for a recipient.
 */
export function generateSigningUrl(baseUrl: string, envelopeId: string, rawToken: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return `${normalizedBase}/sign/${envelopeId}?token=${encodeURIComponent(rawToken)}`;
}
