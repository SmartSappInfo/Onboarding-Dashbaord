/**
 * Embedded Signing Service Test Suite
 *
 * Verifies postMessage parsing, frame-ancestors CSP generation,
 * embed origin validation, and debounced height clamp calculation (FM-P8-05, FM-P8-06).
 *
 * @maintainer Antigravity Pair Programming
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateEmbedOrigin } from '../embedded-signing-server';
import {
  generateEmbedCspHeader,
  parseEmbedMessage,
  calculateClampedEmbedHeight,
} from '@/lib/documents/embedded-signing-service';
import { adminDb } from '@/lib/firebase-admin';

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
    doc: vi.fn(),
  },
}));

describe('EmbeddedSigningService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateEmbedOrigin', () => {
    it('allows origin when present in workspace allowed origins', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          allowedEmbedOrigins: ['https://partner.portal.io', 'https://crm.corp.net'],
        }),
      };

      vi.mocked(adminDb.doc).mockReturnValue({
        get: vi.fn().mockResolvedValue(mockDoc),
      } as unknown as ReturnType<typeof adminDb.doc>);

      const result = await validateEmbedOrigin('ws_123', 'https://partner.portal.io');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects origin not in workspace whitelist', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          allowedEmbedOrigins: ['https://partner.portal.io'],
        }),
      };

      vi.mocked(adminDb.doc).mockReturnValue({
        get: vi.fn().mockResolvedValue(mockDoc),
      } as unknown as ReturnType<typeof adminDb.doc>);

      const result = await validateEmbedOrigin('ws_123', 'https://evil-attacker.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not whitelisted');
    });

    it('rejects wildcards or invalid URLs', async () => {
      const resultWildcard = await validateEmbedOrigin('ws_123', '*');
      expect(resultWildcard.allowed).toBe(false);

      const resultInvalid = await validateEmbedOrigin('ws_123', 'javascript:alert(1)');
      expect(resultInvalid.allowed).toBe(false);
    });

    it('handles missing workspace settings document gracefully', async () => {
      const mockDoc = {
        exists: false,
        data: () => null,
      };

      vi.mocked(adminDb.doc).mockReturnValue({
        get: vi.fn().mockResolvedValue(mockDoc),
      } as unknown as ReturnType<typeof adminDb.doc>);

      const result = await validateEmbedOrigin('ws_123', 'https://partner.portal.io');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not configured');
    });
  });

  describe('generateEmbedCspHeader', () => {
    it('generates frame-ancestors with self and whitelisted origins', () => {
      const origins = ['https://partner.io', 'https://app.crm.com'];
      const csp = generateEmbedCspHeader(origins);
      expect(csp).toBe("frame-ancestors 'self' https://partner.io https://app.crm.com;");
    });

    it('returns self only when list is empty', () => {
      const csp = generateEmbedCspHeader([]);
      expect(csp).toBe("frame-ancestors 'self';");
    });

    it('filters out invalid origins or formatting artifacts', () => {
      const origins = ['https://partner.io/', 'invalid-url', 'https://safe.org'];
      const csp = generateEmbedCspHeader(origins);
      expect(csp).toBe("frame-ancestors 'self' https://partner.io https://safe.org;");
    });
  });

  describe('parseEmbedMessage', () => {
    it('successfully parses handshake_init message', () => {
      const raw = {
        type: 'handshake_init',
        token: 'tok_signing_123',
      };
      const parsed = parseEmbedMessage(raw);
      expect(parsed).toEqual(raw);
    });

    it('successfully parses recipient_signed message', () => {
      const raw = {
        type: 'recipient_signed',
        envelopeId: 'env_123',
        recipientId: 'rec_456',
        timestamp: '2026-09-29T12:00:00Z',
      };
      const parsed = parseEmbedMessage(raw);
      expect(parsed).toEqual(raw);
    });

    it('successfully parses resize_request message', () => {
      const raw = {
        type: 'resize_request',
        height: 750,
      };
      const parsed = parseEmbedMessage(raw);
      expect(parsed).toEqual(raw);
    });

    it('returns null for unknown message types or malformed payloads', () => {
      expect(parseEmbedMessage({ type: 'unknown_type' })).toBeNull();
      expect(parseEmbedMessage('not an object')).toBeNull();
      expect(parseEmbedMessage({ type: 'handshake_init' })).toBeNull(); // missing token
    });
  });

  describe('calculateClampedEmbedHeight', () => {
    it('clamps height within bounds (500px - 2400px)', () => {
      const tooSmall = calculateClampedEmbedHeight(300);
      expect(tooSmall.height).toBe(500);
      expect(tooSmall.shouldUpdate).toBe(true);

      const tooLarge = calculateClampedEmbedHeight(3500);
      expect(tooLarge.height).toBe(2400);
      expect(tooLarge.shouldUpdate).toBe(true);

      const inRange = calculateClampedEmbedHeight(920);
      expect(inRange.height).toBe(920);
      expect(inRange.shouldUpdate).toBe(true);
    });

    it('enforces 8px deadband to prevent infinite resize loops (FM-P8-06)', () => {
      // 5px change from 900 -> within deadband (< 8px)
      const minorChange = calculateClampedEmbedHeight(905, 900);
      expect(minorChange.height).toBe(905);
      expect(minorChange.shouldUpdate).toBe(false);

      // 10px change from 900 -> exceeds deadband (>= 8px)
      const majorChange = calculateClampedEmbedHeight(910, 900);
      expect(majorChange.height).toBe(910);
      expect(majorChange.shouldUpdate).toBe(true);
    });
  });
});
