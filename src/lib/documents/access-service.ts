/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Cryptographic Security & Access Control Service:
 *    Provides salted SHA-256 HMAC password hashing, constant-time password verification,
 *    and access policy evaluation for documents, distributions, and public reader viewers.
 * 2. Timing Attack Resistance:
 *    Uses `crypto.timingSafeEqual` (or constant-time buffer comparison) to prevent side-channel timing attacks.
 * 3. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 * 4. Caution Areas:
 *    Never log raw passwords or hashes in plaintext. Passwords must never be transmitted back to public clients in document responses.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { AccessPolicy, Document, AccessVisibility } from '@/lib/types/document-types';

export interface HashResult {
  hash: string;
  salt: string;
}

export interface AccessEvaluationResult {
  allowed: boolean;
  requiresPassword?: boolean;
  requiresToken?: boolean;
  reason?: string;
}

export interface AccessEvaluationContext {
  providedPasscode?: string;
  providedToken?: string;
  userEmail?: string;
  callerIsAuthenticated?: boolean;
}

/**
 * Generates a random cryptographic salt.
 */
export function generateSalt(length = 16): string {
  return randomBytes(length).toString('hex');
}

/**
 * Hashes a plaintext passcode using HMAC SHA-256 with a unique cryptographic salt.
 */
export function hashPasscode(passcode: string, salt?: string): HashResult {
  const activeSalt = salt || generateSalt();
  const hmac = createHmac('sha256', activeSalt);
  hmac.update(passcode);
  const hash = hmac.digest('hex');
  return { hash, salt: activeSalt };
}

/**
 * Verifies a plaintext passcode against a stored hash and salt using timing-safe comparison.
 */
export function verifyPasscode(passcode: string, storedHash: string, salt: string): boolean {
  if (!passcode || !storedHash || !salt) return false;
  try {
    const computed = hashPasscode(passcode, salt);
    const computedBuf = Buffer.from(computed.hash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (computedBuf.length !== storedBuf.length) return false;
    return timingSafeEqual(computedBuf, storedBuf);
  } catch {
    return false;
  }
}

/**
 * Evaluates whether a viewer can access a document based on its status and AccessPolicy.
 */
export function evaluateAccess(
  doc: Document,
  policy?: AccessPolicy | null,
  context?: AccessEvaluationContext
): AccessEvaluationResult {
  // 1. Published status check
  if (doc.status !== 'published') {
    if (!context?.callerIsAuthenticated) {
      return {
        allowed: false,
        reason: 'Document is not published.',
      };
    }
  }

  // If no specific access policy exists, default to public access for published docs
  if (!policy) {
    return { allowed: true };
  }

  const visibility: AccessVisibility = policy.visibility || 'public';

  switch (visibility) {
    case 'public':
      return { allowed: true };

    case 'private':
      if (!context?.callerIsAuthenticated) {
        return {
          allowed: false,
          reason: 'This document is private and requires workspace authorization.',
        };
      }
      return { allowed: true };

    case 'protected': {
      if (!policy.passwordHash || !policy.salt) {
        return { allowed: true };
      }
      if (!context?.providedPasscode) {
        return {
          allowed: false,
          requiresPassword: true,
          reason: 'Passcode required to view this publication.',
        };
      }
      const isValid = verifyPasscode(context.providedPasscode, policy.passwordHash, policy.salt);
      if (!isValid) {
        return {
          allowed: false,
          requiresPassword: true,
          reason: 'Incorrect passcode provided.',
        };
      }
      return { allowed: true };
    }

    case 'tokenized': {
      if (!context?.providedToken) {
        return {
          allowed: false,
          requiresToken: true,
          reason: 'Access token required to view this publication.',
        };
      }
      if (policy.tokenExpiration) {
        const expiresAt = new Date(policy.tokenExpiration).getTime();
        if (Date.now() > expiresAt) {
          return {
            allowed: false,
            reason: 'This publication access token has expired.',
          };
        }
      }
      return { allowed: true };
    }

    case 'authenticated': {
      if (!context?.callerIsAuthenticated) {
        return {
          allowed: false,
          reason: 'Authentication required to view this document.',
        };
      }
      if (policy.allowedDomains && policy.allowedDomains.length > 0 && context.userEmail) {
        const domain = context.userEmail.split('@')[1]?.toLowerCase();
        if (!domain || !policy.allowedDomains.some((d) => d.toLowerCase() === domain)) {
          return {
            allowed: false,
            reason: 'Your email domain is not authorized to access this document.',
          };
        }
      }
      return { allowed: true };
    }

    default:
      return { allowed: true };
  }
}
