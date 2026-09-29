import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordCircuitBreakerFailure,
  recordCircuitBreakerSuccess,
  checkCircuitBreakerStatus,
} from '@/lib/documents/resilient-outbox-service';

// Mock Firestore
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
        update: mockUpdate,
      })),
    })),
  },
}));

describe('Distributed Circuit Breaker & Resilient Outbox Persistence (Phase 6)', () => {
  const workspaceId = 'ws_production_cloud_run';
  const serviceKey = 'webhook_partner_api';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Distributed State Sync across Cloud Run Containers (FM-P6-05, RSK-02)', () => {
    it('initializes and permits execution when circuit breaker document does not exist', async () => {
      mockGet.mockResolvedValueOnce({
        exists: false,
      });

      const status = await checkCircuitBreakerStatus(workspaceId, serviceKey);
      expect(status.canExecute).toBe(true);
      expect(status.state).toBe('closed');
      expect(status.remainingCooldownMs).toBe(0);
    });

    it('increments failure count and transitions to open after reaching failure threshold', async () => {
      // 4 previous failures
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          serviceKey,
          state: 'closed',
          failureCount: 4,
          successCount: 10,
          lastFailureAt: new Date().toISOString(),
          nextAllowedAttemptAt: null,
          updatedAt: new Date().toISOString(),
        }),
      });

      const updated = await recordCircuitBreakerFailure(workspaceId, serviceKey, 5, 30000);
      expect(updated.failureCount).toBe(5);
      expect(updated.state).toBe('open');
      expect(updated.nextAllowedAttemptAt).toBeDefined();
      expect(mockSet).toHaveBeenCalledTimes(1);
    });

    it('blocks execution when circuit breaker is open within cooldown period', async () => {
      const futureCooldown = new Date(Date.now() + 20000).toISOString(); // 20s in future

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          serviceKey,
          state: 'open',
          failureCount: 5,
          nextAllowedAttemptAt: futureCooldown,
          updatedAt: new Date().toISOString(),
        }),
      });

      const status = await checkCircuitBreakerStatus(workspaceId, serviceKey);
      expect(status.canExecute).toBe(false);
      expect(status.state).toBe('open');
      expect(status.remainingCooldownMs).toBeGreaterThan(0);
    });

    it('transitions from open to half_open once cooldown period expires', async () => {
      const pastCooldown = new Date(Date.now() - 5000).toISOString(); // 5s ago

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          serviceKey,
          state: 'open',
          failureCount: 5,
          nextAllowedAttemptAt: pastCooldown,
          updatedAt: new Date().toISOString(),
        }),
      });

      const status = await checkCircuitBreakerStatus(workspaceId, serviceKey);
      expect(status.canExecute).toBe(true);
      expect(status.state).toBe('half_open');
      expect(status.remainingCooldownMs).toBe(0);
    });

    it('resets failure count and closes circuit upon recording success', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          serviceKey,
          state: 'half_open',
          failureCount: 5,
          successCount: 0,
        }),
      });

      const closed = await recordCircuitBreakerSuccess(workspaceId, serviceKey);
      expect(closed.state).toBe('closed');
      expect(closed.failureCount).toBe(0);
      expect(closed.nextAllowedAttemptAt).toBeNull();
    });
  });
});
