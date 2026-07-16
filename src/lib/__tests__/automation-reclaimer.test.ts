import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findOrphanedProcessingJobs, reclaimOrphanedJobTransaction } from '../automations/repository';

const mockCollection = {
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn(),
  doc: vi.fn().mockImplementation((docId: string) => ({
    id: docId,
  })),
};

const mockTx = {
  get: vi.fn(),
  update: vi.fn(),
};

vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn(() => mockCollection),
      runTransaction: vi.fn((cb) => cb(mockTx)),
    },
  };
});

describe('Automated Stuck Processing Jobs Reclaimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.get.mockReset();
    mockTx.get.mockReset();
    mockTx.update.mockReset();
  });

  describe('findOrphanedProcessingJobs', () => {
    it('queries stuck jobs older than threshold with limit of 100', async () => {
      const mockDocs = [
        {
          id: 'job-stuck-1',
          data: () => ({
            status: 'processing',
            updatedAt: '2026-07-16T12:00:00.000Z',
          }),
        },
      ];

      mockCollection.get.mockResolvedValueOnce({
        docs: mockDocs,
      } as any);

      const result = await findOrphanedProcessingJobs(30);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('job-stuck-1');
      expect(mockCollection.where).toHaveBeenCalledWith('status', '==', 'processing');
      expect(mockCollection.limit).toHaveBeenCalledWith(100);
    });
  });

  describe('reclaimOrphanedJobTransaction', () => {
    it('resets job back to pending and increments retryCount if attempts < 3', async () => {
      mockTx.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'processing',
          retryCount: 1,
        }),
      } as any);

      const success = await reclaimOrphanedJobTransaction('job-stuck-1');

      expect(success).toBe(true);
      expect(mockTx.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'job-stuck-1' }),
        expect.objectContaining({
          status: 'pending',
          retryCount: 2,
        })
      );
    });

    it('marks job status as failed if retryCount reaches 3', async () => {
      mockTx.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'processing',
          retryCount: 2, // 3rd attempt will fail
        }),
      } as any);

      const success = await reclaimOrphanedJobTransaction('job-stuck-2');

      expect(success).toBe(true);
      expect(mockTx.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'job-stuck-2' }),
        expect.objectContaining({
          status: 'failed',
          error: 'Execution timed out or worker crashed repeatedly.',
        })
      );
    });

    it('bypasses reclaim if job status has changed from processing', async () => {
      mockTx.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'completed',
        }),
      } as any);

      const success = await reclaimOrphanedJobTransaction('job-done');

      expect(success).toBe(false);
      expect(mockTx.update).not.toHaveBeenCalled();
    });
  });
});
