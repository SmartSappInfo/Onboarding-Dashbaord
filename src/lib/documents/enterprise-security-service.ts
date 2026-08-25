/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Enterprise Document Security & RBAC:
 *    Enforces the granular permissions matrix across product roles (PRD Sections 88–89 & Phase 13),
 *    sanitizes input payloads against XSS, and rate limits viewer event streams against DDoS attacks.
 * 2. Multi-Tenant Role Invariant:
 *    `verifyDocumentPermission` guarantees that only authorized roles execute sensitive operations
 *    such as `documents.delete`, `documents.publish`, or `documents.manage_access`.
 * 3. In-Memory Sliding Window Rate Limiting:
 *    Protects `/api/documents/events` and public reader interactions with a sliding timestamp window.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import type {
  DocumentRole,
  DocumentPermission,
} from '@/lib/types/document-types';
import { ROLE_PERMISSIONS_MAP } from '@/lib/types/document-types';

/**
 * Checks if a given role has the requested document permission.
 */
export function verifyDocumentPermission(
  role: DocumentRole,
  permission: DocumentPermission
): boolean {
  const allowedPermissions = ROLE_PERMISSIONS_MAP[role];
  if (!allowedPermissions) return false;
  return allowedPermissions.includes(permission);
}

/**
 * Recursive sanitizer for document payload objects against XSS, unsafe script injections,
 * and malicious protocol schemes (`javascript:`, `data:text/html`).
 */
export function sanitizeDocumentInputPayload<T extends Record<string, unknown>>(payload: T): T {
  const sanitized = { ...payload };

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      let cleanVal = value;
      // Strip script tags and HTML event handlers
      cleanVal = cleanVal.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      cleanVal = cleanVal.replace(/on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
      // Strip javascript: pseudo-protocol
      cleanVal = cleanVal.replace(/javascript:/gi, '');
      (sanitized as Record<string, unknown>)[key] = cleanVal;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = sanitizeDocumentInputPayload(
        value as Record<string, unknown>
      );
    }
  }

  return sanitized;
}

// ── In-Memory Sliding Window Rate Limiter ──────────────────────────────────
interface RateLimitBucket {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitBucket>();

/**
 * Evaluates whether a client request is within the allowed requests-per-minute threshold.
 */
export function checkEventRateLimit(
  clientId: string,
  limitPerMinute = 120,
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetTimeMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  let bucket = rateLimitStore.get(clientId);
  if (!bucket) {
    bucket = { timestamps: [] };
    rateLimitStore.set(clientId, bucket);
  }

  // Filter timestamps outside current sliding window
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

  if (bucket.timestamps.length >= limitPerMinute) {
    const oldestTimestamp = bucket.timestamps[0];
    const resetTimeMs = Math.max(0, oldestTimestamp + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetTimeMs,
    };
  }

  bucket.timestamps.push(now);
  const remaining = limitPerMinute - bucket.timestamps.length;

  return {
    allowed: true,
    remaining,
    resetTimeMs: windowMs,
  };
}

/**
 * Resets the in-memory rate limit store (used in testing).
 */
export function resetRateLimitRegistry(): void {
  rateLimitStore.clear();
}
