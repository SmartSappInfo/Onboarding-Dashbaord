/**
 * Token-Bucket API Rate Limiter & Security Guard Test Suite
 *
 * Verifies sliding-window rate limiting, tier quotas (standard vs enterprise),
 * HTTP 429 response header generation, decrement/replenishment over time,
 * and high burst load protection.
 *
 * @maintainer Antigravity Pair Programming
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkApiRateLimit,
  clearRateLimit,
  RATE_LIMIT_TIERS,
} from '@/lib/documents/api-rate-limiter-service';

describe('ApiRateLimiterService', () => {
  beforeEach(() => {
    clearRateLimit('test_key_01');
    clearRateLimit('test_key_enterprise');
    clearRateLimit('test_ip_127_0_0_1');
  });

  describe('Standard Tier Limiting', () => {
    it('allows requests within standard tier quota (60 req/min)', () => {
      const res = checkApiRateLimit('test_key_01', 'standard');
      expect(res.isAllowed).toBe(true);
      expect(res.limit).toBe(RATE_LIMIT_TIERS.standard.maxRequests);
      expect(res.remaining).toBe(RATE_LIMIT_TIERS.standard.maxRequests - 1);
      expect(res.headers['X-RateLimit-Limit']).toBe('60');
      expect(res.headers['X-RateLimit-Remaining']).toBe('59');
    });

    it('rejects requests and sets Retry-After when quota is exhausted', () => {
      // Consume all 60 standard requests
      for (let i = 0; i < 60; i++) {
        const check = checkApiRateLimit('test_key_01', 'standard');
        expect(check.isAllowed).toBe(true);
      }

      // 61st request must be denied
      const blocked = checkApiRateLimit('test_key_01', 'standard');
      expect(blocked.isAllowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.headers['Retry-After']).toBeDefined();
    });
  });

  describe('Enterprise Tier Limiting', () => {
    it('supports enterprise tier quota (300 req/min)', () => {
      for (let i = 0; i < 150; i++) {
        const check = checkApiRateLimit('test_key_enterprise', 'enterprise');
        expect(check.isAllowed).toBe(true);
      }

      const status = checkApiRateLimit('test_key_enterprise', 'enterprise');
      expect(status.isAllowed).toBe(true);
      expect(status.limit).toBe(300);
      expect(status.remaining).toBe(149);
    });
  });

  describe('Window Sliding and Replenishment', () => {
    it('replenishes quota when timestamps age out of sliding window', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      // Consume all 60
      for (let i = 0; i < 60; i++) {
        checkApiRateLimit('test_key_01', 'standard');
      }

      expect(checkApiRateLimit('test_key_01', 'standard').isAllowed).toBe(false);

      // Advance time by 61 seconds (past 60s window)
      vi.setSystemTime(now + 61000);

      const replenished = checkApiRateLimit('test_key_01', 'standard');
      expect(replenished.isAllowed).toBe(true);
      expect(replenished.remaining).toBe(59);

      vi.useRealTimers();
    });
  });
});
