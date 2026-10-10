/**
 * @fileOverview Unit tests for Deal Cadence Server Actions (Phase 2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  previewDealTaskCadenceAction,
  executeDealTaskCadenceAction,
} from '../deal-cadence-actions';
import type { DealTaskCadenceConfig } from '@/lib/deals/deal-types';
import { adminAuth } from '@/lib/firebase-admin';
import { canUser } from '@/lib/workspace-permissions';
import { executeCadenceSchedule, generateCadencePreview } from '@/lib/deals/deal-task-cadence-core';

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(),
  },
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(async () => ({
          docs: [
            {
              id: 'deal_1',
              data: () => ({ id: 'deal_1', name: 'Deal One', value: 5000, workspaceId: 'ws_1' }),
            },
          ],
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/services/identity/person-service', () => ({
  PersonService: {
    getPerson: vi.fn(async (id: string) => ({ id, displayName: 'Test Rep', email: 'rep@test.com' })),
  },
}));

vi.mock('@/lib/deals/deal-task-cadence-core', () => ({
  generateCadencePreview: vi.fn(() => ({
    workspaceId: 'ws_1',
    totalDeals: 1,
    totalPipelineValue: 5000,
    totalDaysSpanned: 1,
    startDate: '2026-10-12',
    endDate: '2026-10-12',
    slots: [],
    daySummaries: [],
  })),
  executeCadenceSchedule: vi.fn(async () => ({
    jobId: 'job_123',
    workspaceId: 'ws_1',
    totalDealsProcessed: 1,
    tasksCreatedCount: 1,
    dealsUpdatedCount: 1,
    startDate: '2026-10-12',
    endDate: '2026-10-12',
    executedAt: new Date().toISOString(),
    status: 'completed',
  })),
}));

describe('Deal Cadence Server Actions Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validConfig: DealTaskCadenceConfig = {
    workspaceId: 'ws_1',
    organizationId: 'org_1',
    dealIds: ['deal_1'],
    actionType: 'call',
    taskTitle: 'Discovery Call',
    taskPriority: 'high',
    maxFrequencyPerDay: 5,
    startDate: '2026-10-12',
    startTime: '09:00',
    intervalMinutes: 30,
    skipWeekends: true,
    assigneeMode: 'single',
    targetAssigneeIds: ['rep_1'],
  };

  describe('previewDealTaskCadenceAction', () => {
    it('returns error if idToken is invalid', async () => {
      vi.mocked(adminAuth.verifyIdToken).mockRejectedValueOnce(new Error('Invalid token'));

      const res = await previewDealTaskCadenceAction({
        idToken: 'invalid',
        config: validConfig,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid token');
    });

    it('returns error if user lacks permission', async () => {
      vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({ uid: 'user_1' } as never);
      vi.mocked(canUser).mockResolvedValueOnce({ granted: false, reason: 'Access denied' });

      const res = await previewDealTaskCadenceAction({
        idToken: 'valid_token',
        config: validConfig,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Access denied');
    });

    it('generates preview successfully when authorized', async () => {
      vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({ uid: 'user_1' } as never);
      vi.mocked(canUser).mockResolvedValueOnce({ granted: true });

      const res = await previewDealTaskCadenceAction({
        idToken: 'valid_token',
        config: validConfig,
      });

      expect(res.success).toBe(true);
      expect(res.preview).toBeDefined();
      expect(generateCadencePreview).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeDealTaskCadenceAction', () => {
    it('enforces task creation permissions before executing', async () => {
      vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({ uid: 'user_1' } as never);
      vi.mocked(canUser).mockResolvedValueOnce({ granted: false, reason: 'Cannot create tasks' });

      const res = await executeDealTaskCadenceAction({
        idToken: 'valid_token',
        config: validConfig,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Cannot create tasks');
      expect(executeCadenceSchedule).not.toHaveBeenCalled();
    });

    it('executes cadence schedule and returns result when authorized', async () => {
      vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({ uid: 'user_1' } as never);
      vi.mocked(canUser).mockResolvedValueOnce({ granted: true });

      const res = await executeDealTaskCadenceAction({
        idToken: 'valid_token',
        config: validConfig,
      });

      expect(res.success).toBe(true);
      expect(res.result).toBeDefined();
      expect(res.result?.status).toBe('completed');
      expect(executeCadenceSchedule).toHaveBeenCalledTimes(1);
    });
  });
});
