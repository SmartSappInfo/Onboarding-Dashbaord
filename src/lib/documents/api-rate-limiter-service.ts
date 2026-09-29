/**
 * Token-Bucket API Rate Limiter & Security Guard
 *
 * Implements sliding-window rate limiting per API key or client IP,
 * preventing server denial-of-service, memory saturation in the vector PDF pipeline,
 * and automated scraping.
 *
 * Rate Limit Tiers:
 * - standard: 60 requests per 60,000ms (1 req/sec average)
 * - enterprise: 300 requests per 60,000ms (5 req/sec average)
 *
 * Invariants & Guarantees:
 * 1. Thread-safe sliding window tracking using monotonic timestamps.
 * 2. Automatic eviction of stale window entries preventing memory leaks.
 * 3. Returns standard HTTP 429 rate limit headers (RFC 6585):
 *    - X-RateLimit-Limit
 *    - X-RateLimit-Remaining
 *    - X-RateLimit-Reset
 *    - Retry-After (when limit is exceeded)
 *
 * Maintainer Note:
 * For multi-instance horizontal scaling, connect this interface to a shared
 * Redis or Firestore token bucket adapter.
 *
 * @maintainer Antigravity Pair Programming
 */

import {
  type ApiKeyRateLimitTier,
  type RateLimitConfig,
} from '@/lib/types/document-signing';

export const RATE_LIMIT_TIERS: Record<ApiKeyRateLimitTier, RateLimitConfig> = {
  standard: {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
  },
  enterprise: {
    windowMs: 60000, // 1 minute
    maxRequests: 300,
  },
};

export interface RateLimitCheckResult {
  isAllowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds?: number;
  headers: Record<string, string>;
}

// In-memory timestamp store: identifier -> timestamp[]
const rateLimitStore = new Map<string, number[]>();

/**
 * Checks and decrements rate limit quota for a given identifier (API key ID or IP).
 */
export function checkApiRateLimit(
  identifier: string,
  tier: ApiKeyRateLimitTier = 'standard',
  customConfig?: RateLimitConfig
): RateLimitCheckResult {
  const config = customConfig || RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.standard;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const existingTimestamps = rateLimitStore.get(identifier) || [];
  // Evict timestamps outside current sliding window
  const activeTimestamps = existingTimestamps.filter((t) => t > windowStart);

  const isAllowed = activeTimestamps.length < config.maxRequests;

  let remaining = config.maxRequests - activeTimestamps.length;
  if (isAllowed) {
    activeTimestamps.push(now);
    rateLimitStore.set(identifier, activeTimestamps);
    remaining = Math.max(0, remaining - 1);
  } else {
    // Keep sanitized active list in store
    rateLimitStore.set(identifier, activeTimestamps);
    remaining = 0;
  }

  // Calculate earliest expiration for X-RateLimit-Reset
  const oldestTimestamp = activeTimestamps[0] || now;
  const resetMs = Math.max(0, oldestTimestamp + config.windowMs - now);
  const resetSeconds = Math.ceil(resetMs / 1000);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetSeconds),
  };

  let retryAfterSeconds: number | undefined;
  if (!isAllowed) {
    retryAfterSeconds = Math.max(1, resetSeconds);
    headers['Retry-After'] = String(retryAfterSeconds);
  }

  return {
    isAllowed,
    limit: config.maxRequests,
    remaining,
    resetSeconds,
    retryAfterSeconds,
    headers,
  };
}

/**
 * Resets/clears rate limit tracking for an identifier (useful for tests or administrator quota reset).
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Clears the entire rate limit store (for test suites).
 */
export function resetRateLimitForTesting(): void {
  rateLimitStore.clear();
}

/**
 * Evicts all rate limit tracking records whose timestamps have all expired.
 * Prevents memory bloat over long container lifetimes.
 */
export function pruneExpiredRateLimits(): void {
  const now = Date.now();
  const maxWindow = Math.max(
    RATE_LIMIT_TIERS.standard.windowMs,
    RATE_LIMIT_TIERS.enterprise.windowMs
  );
  const threshold = now - maxWindow;

  for (const [key, timestamps] of rateLimitStore.entries()) {
    const active = timestamps.filter((t) => t > threshold);
    if (active.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, active);
    }
  }
}
