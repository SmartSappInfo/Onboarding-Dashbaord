import { describe, it, expect } from 'vitest';
import { reconcileOfflineQueue } from '../offline-cache-service';
import type { OfflineMutationJob } from '../types/offline-cache';

describe('Offline Cache & Sync Reconciler Service', () => {
  it('identifies clean synchronizations and server timestamp conflicts', () => {
    const mutations: OfflineMutationJob[] = [
      {
        id: 'job_1',
        type: 'update_draft',
        entityId: 'meeting_1',
        payload: { title: 'New Offline Title' },
        clientTimestamp: '2026-08-25T10:00:00Z',
        status: 'queued',
        retryCount: 0,
      },
      {
        id: 'job_2',
        type: 'check_in',
        entityId: 'meeting_2',
        payload: { checkedIn: true },
        clientTimestamp: '2026-08-25T12:00:00Z',
        status: 'queued',
        retryCount: 0,
      },
    ];

    const serverSnapshots = {
      meeting_1: { updatedAt: '2026-08-25T11:00:00Z' }, // Updated AFTER job_1 -> Conflict!
      meeting_2: { updatedAt: '2026-08-25T09:00:00Z' }, // Updated BEFORE job_2 -> Clean sync!
    };

    const result = reconcileOfflineQueue(mutations, serverSnapshots);

    expect(result.syncedCount).toBe(1);
    expect(result.conflictedCount).toBe(1);
    expect(result.conflictedJobIds).toEqual(['job_1']);
    expect(result.resolvedMutations[0].status).toBe('conflict');
    expect(result.resolvedMutations[1].status).toBe('synced');
  });
});
