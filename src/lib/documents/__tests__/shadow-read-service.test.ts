/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Non-Blocking Shadow-Read Verifier Test Suite (Phase 7):
 * 1. Purpose:
 *    Validates asynchronous shadow reads comparing legacy vs modern domain query results:
 *    - Zero user-facing latency impact (FM-P7-08): caller receives legacy reader result immediately.
 *    - Deep discrepancy detection: records diffs when legacy and modern reads diverge.
 *    - Telemetry aggregation: computes rolling parity percentages for rollout monitoring.
 * 2. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeShadowRead,
  getShadowReadParityMetrics,
  compareEntitySnapshots,
} from '@/lib/documents/shadow-read-service';

// Mock Firebase Admin
const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      get: mockGet,
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
      })),
    })),
  },
}));

describe('Non-Blocking Shadow-Read Verifier (Phase 7)', () => {
  const workspaceId = 'ws_enterprise_cutover_01';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('compareEntitySnapshots', () => {
    it('returns true when objects match identically', () => {
      const a = { id: 'con_1', status: 'signed', value: 100 };
      const b = { id: 'con_1', status: 'signed', value: 100 };
      expect(compareEntitySnapshots(a, b)).toBe(true);
    });

    it('returns false when values diverge', () => {
      const a = { id: 'con_1', status: 'signed' };
      const b = { id: 'con_1', status: 'draft' };
      expect(compareEntitySnapshots(a, b)).toBe(false);
    });
  });

  describe('executeShadowRead (FM-P7-08)', () => {
    it('returns legacy reader result immediately without awaiting modern reader failures', async () => {
      const legacyValue = { id: 'con_100', status: 'signed' };
      const legacyReader = vi.fn().mockResolvedValue(legacyValue);
      const modernReader = vi.fn().mockResolvedValue({ id: 'con_100', status: 'signed' });

      const result = await executeShadowRead({
        workspaceId,
        entityType: 'contract',
        entityId: 'con_100',
        legacyReader,
        modernReader,
      });

      expect(result).toEqual(legacyValue);
      expect(legacyReader).toHaveBeenCalledTimes(1);
    });

    it('records telemetry when modern reader diverges from legacy reader', async () => {
      const legacyValue = { id: 'con_200', status: 'signed' };
      const modernDivergent = { id: 'con_200', status: 'draft' };

      const legacyReader = vi.fn().mockResolvedValue(legacyValue);
      const modernReader = vi.fn().mockResolvedValue(modernDivergent);

      const result = await executeShadowRead({
        workspaceId,
        entityType: 'contract',
        entityId: 'con_200',
        legacyReader,
        modernReader,
      });

      expect(result).toEqual(legacyValue);

      // Wait a tick for background async execution
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('getShadowReadParityMetrics', () => {
    it('calculates parity percentage based on recent telemetry records', async () => {
      mockGet.mockResolvedValueOnce({
        size: 4,
        docs: [
          { data: () => ({ matched: true }) },
          { data: () => ({ matched: true }) },
          { data: () => ({ matched: true }) },
          { data: () => ({ matched: false }) },
        ],
      });

      const metrics = await getShadowReadParityMetrics(workspaceId);

      expect(metrics.totalReads).toBe(4);
      expect(metrics.matchedReads).toBe(3);
      expect(metrics.discrepancyCount).toBe(1);
      expect(metrics.parityPercentage).toBe(75);
    });
  });
});
