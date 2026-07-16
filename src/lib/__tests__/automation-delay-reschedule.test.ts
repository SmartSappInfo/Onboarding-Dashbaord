import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  estimateStartedAt,
  calculateNewExecuteAt,
  reschedulePendingJobs,
  purgePendingJobsForNode,
  purgeAllPendingJobsForAutomation,
} from '../automations/reschedule';
import { manuallyReleaseAllWaitJobs } from '../automations/service';
import { adminDb } from '../firebase-admin';
import { rescheduleDelayTask, cancelDelayTask } from '../gcp-tasks-client';
import { resumeAutomationRun } from '../automations/resume';

// Mock GCP tasks client
vi.mock('../gcp-tasks-client', () => ({
  rescheduleDelayTask: vi.fn().mockResolvedValue('task_rescheduled'),
  cancelDelayTask: vi.fn().mockResolvedValue(undefined),
  parseQueueChannel: vi.fn().mockReturnValue('default'),
}));

// Mock Resume module
vi.mock('../automations/resume', () => ({
  resumeAutomationRun: vi.fn(),
}));

// Mock Permissions
vi.mock('../automation-permissions', () => ({
  assertAutomationManagePermission: vi.fn().mockResolvedValue(true),
  loadAutomationForAuth: vi.fn(),
}));

// Define mock objects in outer scope
const mockBatch = {
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
};

const mockCollection = {
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  startAfter: vi.fn().mockReturnThis(),
  get: vi.fn(),
  doc: vi.fn().mockImplementation((docId: string) => ({
    id: docId,
    get: mockCollection.get,
    update: mockCollection.get,
  })),
};

const mockTx = {
  get: vi.fn(),
  update: vi.fn(),
};

// Mock Firebase Admin
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn(() => mockCollection),
      batch: vi.fn(() => mockBatch),
      runTransaction: vi.fn((cb) => cb(mockTx)),
    },
  };
});

describe('Automation Delay Rescheduling & Manual Resumption Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatch.update.mockReset();
    mockBatch.delete.mockReset();
    mockBatch.commit.mockReset();
    mockBatch.commit.mockResolvedValue(undefined);
    mockCollection.get.mockReset();
    mockTx.get.mockReset();
    mockTx.update.mockReset();
    vi.mocked(resumeAutomationRun).mockReset();
  });

  describe('estimateStartedAt', () => {
    it('subtracts the correct old duration from executeAt', () => {
      const executeAt = '2026-06-05T12:00:00.000Z';
      const oldVal = 5;
      const oldUnit = 'Minutes';
      const expectedStartedAt = new Date(new Date(executeAt).getTime() - 5 * 60 * 1000);
      const estimated = estimateStartedAt(executeAt, oldVal, oldUnit);
      expect(estimated.toISOString()).toBe(expectedStartedAt.toISOString());
    });
  });

  describe('calculateNewExecuteAt', () => {
    it('adds new duration to startedAt correctly', () => {
      const startedAt = '2026-06-05T12:00:00.000Z';
      const newVal = 10;
      const newUnit = 'Minutes';
      const expectedExecuteAt = '2026-06-05T12:10:00.000Z';
      const calculated = calculateNewExecuteAt(startedAt, newVal, newUnit);
      expect(calculated.toISOString()).toBe(expectedExecuteAt);
    });
  });

  describe('reschedulePendingJobs', () => {
    it('queries and updates pending jobs using batch operations and skipDbUpdate flag', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          ref: { id: 'job-1' },
          data: () => ({
            runId: 'run-1',
            executeAt: '2026-06-05T12:05:00.000Z',
            createdAt: '2026-06-05T12:00:00.000Z',
            workspaceId: 'onboarding',
            payload: {},
          }),
        },
        {
          id: 'job-legacy',
          ref: { id: 'job-legacy' },
          data: () => ({
            runId: 'run-2',
            executeAt: '2026-06-05T12:05:00.000Z',
            workspaceId: 'onboarding',
            payload: {},
          }),
        },
      ];

      vi.mocked(mockCollection.get)
        .mockResolvedValueOnce({
          empty: false,
          docs: mockJobs,
        } as any)
        .mockResolvedValueOnce({
          empty: true,
        } as any);

      await reschedulePendingJobs(
        'auto-1',
        'node-delay-1',
        { value: 10, unit: 'Minutes' },
        { value: 5, unit: 'Minutes' }
      );

      // Verify query limits & sorting
      expect(mockCollection.orderBy).toHaveBeenCalledWith('__name__');
      expect(mockCollection.limit).toHaveBeenCalledWith(500);

      // Verify batch updates
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockJobs[0].ref,
        expect.objectContaining({ executeAt: '2026-06-05T12:10:00.000Z' })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockJobs[1].ref,
        expect.objectContaining({ executeAt: '2026-06-05T12:10:00.000Z' })
      );

      // Verify cancelDelayTask/rescheduleDelayTask bypassed DB updates
      expect(rescheduleDelayTask).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          nodeId: 'node-delay-1',
          skipDbUpdate: true,
        })
      );

      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('purgePendingJobsForNode', () => {
    it('deletes pending jobs associated with targetNodeId and cancels tasks with skipDbUpdate', async () => {
      const mockJobs = [
        { id: 'job-1', ref: { id: 'job-1' }, data: () => ({ runId: 'run-1', payload: {} }) },
      ];

      vi.mocked(mockCollection.get)
        .mockResolvedValueOnce({
          empty: false,
          docs: mockJobs,
        } as any)
        .mockResolvedValueOnce({
          empty: true,
        } as any);

      await purgePendingJobsForNode('auto-1', 'node-delay-1');

      expect(mockBatch.delete).toHaveBeenCalledWith(mockJobs[0].ref);
      expect(cancelDelayTask).toHaveBeenCalledWith('run-1', 'node-delay-1', 'default', true);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('purgeAllPendingJobsForAutomation', () => {
    it('deletes all pending jobs associated with automationId and cancels tasks with skipDbUpdate', async () => {
      const mockJobs = [
        { id: 'job-1', ref: { id: 'job-1' }, data: () => ({ runId: 'run-1', targetNodeId: 'node-1', payload: {} }) },
        { id: 'job-2', ref: { id: 'job-2' }, data: () => ({ runId: 'run-2', targetNodeId: 'node-2', payload: {} }) },
      ];

      vi.mocked(mockCollection.get)
        .mockResolvedValueOnce({
          empty: false,
          docs: mockJobs,
        } as any)
        .mockResolvedValueOnce({
          empty: true,
        } as any);

      await purgeAllPendingJobsForAutomation('auto-1');

      expect(mockBatch.delete).toHaveBeenCalledWith(mockJobs[0].ref);
      expect(mockBatch.delete).toHaveBeenCalledWith(mockJobs[1].ref);
      expect(cancelDelayTask).toHaveBeenCalledWith('run-1', 'node-1', 'default', true);
      expect(cancelDelayTask).toHaveBeenCalledWith('run-2', 'node-2', 'default', true);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('manuallyReleaseAllWaitJobs', () => {
    it('claims pending wait jobs transactionally, cancels GCP Cloud Tasks, and resumes runs downstream', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          ref: { id: 'job-1' },
          data: () => ({
            runId: 'run-1',
            automationId: 'auto-1',
            targetNodeId: 'node-delay-1',
            status: 'pending',
            payload: {},
          }),
        },
      ];

      // 1. Mock query for automation snapshot
      mockCollection.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ workspaceIds: ['onboarding'] }),
      } as any);

      // 2. Mock query for pending jobs at wait step (Call 1)
      mockCollection.get.mockResolvedValueOnce({
        empty: false,
        docs: mockJobs,
      } as any);

      // 3. Mock query for subsequent pending jobs (Call 2)
      mockCollection.get.mockResolvedValueOnce({
        empty: true,
      } as any);

      // 4. Mock Transaction get to return the job data
      mockTx.get.mockResolvedValueOnce({
        id: 'job-1',
        data: () => ({
          runId: 'run-1',
          automationId: 'auto-1',
          targetNodeId: 'node-delay-1',
          status: 'pending',
          payload: {},
        }),
      } as any);

      // 5. Mock resumeAutomationRun to return true
      vi.mocked(resumeAutomationRun).mockResolvedValueOnce(true);

      const result = await manuallyReleaseAllWaitJobs('auto-1', 'node-delay-1', 'user-1');

      // Verify success status and correct resume counts
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      // Verify transactional claiming
      expect(mockTx.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'job-1' }),
        expect.objectContaining({ status: 'processing' })
      );

      // Verify GCP Task cancellation occurred
      expect(cancelDelayTask).toHaveBeenCalledWith('run-1', 'node-delay-1', 'default', true);

      // Verify resumeAutomationRun was called with the claimed job data
      expect(resumeAutomationRun).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-1',
          status: 'pending',
        })
      );
    });
  });
});
