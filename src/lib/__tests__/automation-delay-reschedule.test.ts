import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  estimateStartedAt,
  calculateNewExecuteAt,
  reschedulePendingJobs,
  purgePendingJobsForNode,
  purgeAllPendingJobsForAutomation,
} from '../automations/reschedule';
import { adminDb } from '../firebase-admin';

vi.mock('../firebase-admin', () => {
  const mockBatch = {
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  const mockCollection = {
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
  };
  return {
    adminDb: {
      collection: vi.fn(() => mockCollection),
      batch: vi.fn(() => mockBatch),
    },
  };
});

describe('Automation Delay Rescheduling Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('estimateStartedAt', () => {
    it('subtracts the correct old duration from executeAt', () => {
      const executeAt = '2026-06-05T12:00:00.000Z';
      const oldVal = 5;
      const oldUnit = 'Minutes';
      // 5 Minutes = 300,000 ms
      const expectedStartedAt = new Date(new Date(executeAt).getTime() - 5 * 60 * 1000);
      const estimated = estimateStartedAt(executeAt, oldVal, oldUnit);
      expect(estimated.toISOString()).toBe(expectedStartedAt.toISOString());
    });

    it('handles Hours unit correctly', () => {
      const executeAt = '2026-06-05T12:00:00.000Z';
      const oldVal = 2;
      const oldUnit = 'Hours';
      const expectedStartedAt = new Date(new Date(executeAt).getTime() - 2 * 60 * 60 * 1000);
      const estimated = estimateStartedAt(executeAt, oldVal, oldUnit);
      expect(estimated.toISOString()).toBe(expectedStartedAt.toISOString());
    });

    it('handles Days unit correctly', () => {
      const executeAt = '2026-06-05T12:00:00.000Z';
      const oldVal = 3;
      const oldUnit = 'Days';
      const expectedStartedAt = new Date(new Date(executeAt).getTime() - 3 * 24 * 60 * 60 * 1000);
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
    it('queries and updates pending jobs using batch operations', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          ref: { id: 'job-1' },
          data: () => ({
            executeAt: '2026-06-05T12:05:00.000Z',
            createdAt: '2026-06-05T12:00:00.000Z',
          }),
        },
        {
          id: 'job-legacy',
          ref: { id: 'job-legacy' },
          data: () => ({
            executeAt: '2026-06-05T12:05:00.000Z', // missing createdAt
          }),
        },
      ];

      const mockCollection = adminDb.collection('automation_jobs');
      vi.mocked(mockCollection.get).mockResolvedValue({
        empty: false,
        docs: mockJobs,
      } as any);

      const mockBatch = adminDb.batch();

      await reschedulePendingJobs(
        'auto-1',
        'node-delay-1',
        { value: 10, unit: 'Minutes' }, // new: 10 minutes
        { value: 5, unit: 'Minutes' }   // old: 5 minutes
      );

      // Verify query parameters
      expect(adminDb.collection).toHaveBeenCalledWith('automation_jobs');
      expect(mockCollection.where).toHaveBeenCalledWith('automationId', '==', 'auto-1');
      expect(mockCollection.where).toHaveBeenCalledWith('targetNodeId', '==', 'node-delay-1');
      expect(mockCollection.where).toHaveBeenCalledWith('status', '==', 'pending');

      // Verify batch updates
      // Job 1 has createdAt = 12:00. New executeAt = 12:00 + 10m = 12:10.
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockJobs[0].ref,
        expect.objectContaining({ executeAt: '2026-06-05T12:10:00.000Z' })
      );

      // Job legacy: executeAt = 12:05, old delay = 5m -> estimated startedAt = 12:00.
      // New executeAt = 12:00 + 10m = 12:10.
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockJobs[1].ref,
        expect.objectContaining({ executeAt: '2026-06-05T12:10:00.000Z' })
      );

      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('purgePendingJobsForNode', () => {
    it('deletes pending jobs associated with targetNodeId', async () => {
      const mockJobs = [
        { id: 'job-1', ref: { id: 'job-1' }, data: () => ({}) },
      ];

      const mockCollection = adminDb.collection('automation_jobs');
      vi.mocked(mockCollection.get).mockResolvedValue({
        empty: false,
        docs: mockJobs,
      } as any);

      const mockBatch = adminDb.batch();

      await purgePendingJobsForNode('auto-1', 'node-delay-1');

      expect(mockBatch.delete).toHaveBeenCalledWith(mockJobs[0].ref);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('purgeAllPendingJobsForAutomation', () => {
    it('deletes all pending jobs associated with automationId', async () => {
      const mockJobs = [
        { id: 'job-1', ref: { id: 'job-1' }, data: () => ({}) },
        { id: 'job-2', ref: { id: 'job-2' }, data: () => ({}) },
      ];

      const mockCollection = adminDb.collection('automation_jobs');
      vi.mocked(mockCollection.get).mockResolvedValue({
        empty: false,
        docs: mockJobs,
      } as any);

      const mockBatch = adminDb.batch();

      await purgeAllPendingJobsForAutomation('auto-1');

      expect(mockBatch.delete).toHaveBeenCalledWith(mockJobs[0].ref);
      expect(mockBatch.delete).toHaveBeenCalledWith(mockJobs[1].ref);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });
});
