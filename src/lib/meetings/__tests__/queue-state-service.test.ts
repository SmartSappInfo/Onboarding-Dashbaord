import { describe, it, expect } from 'vitest';
import {
  isQueueEntryStale,
  recalculateQueuePositions,
  estimateWaitTimeMinutes,
} from '../queue-state-service';
import type { OfficeHoursQueueEntry } from '../types/polls';

describe('Office Hours Queue & Heartbeat Service', () => {
  const refNow = new Date('2026-09-01T12:00:00Z');

  it('flags entries as stale if heartbeat is older than 90 seconds', () => {
    // 30s ago -> fresh
    const fresh = new Date(refNow.getTime() - 30 * 1000).toISOString();
    expect(isQueueEntryStale(fresh, 90, refNow)).toBe(false);

    // 120s ago -> stale
    const stale = new Date(refNow.getTime() - 120 * 1000).toISOString();
    expect(isQueueEntryStale(stale, 90, refNow)).toBe(true);
  });

  it('recalculates FIFO queue positions filtering out stale entries', () => {
    const entries: OfficeHoursQueueEntry[] = [
      {
        id: 'e1',
        roomId: 'r1',
        workspaceId: 'w1',
        visitorName: 'Visitor 1',
        visitorEmail: 'v1@example.com',
        status: 'waiting',
        position: 0,
        joinedQueueAt: '2026-09-01T11:50:00Z',
        lastHeartbeatAt: new Date(refNow.getTime() - 20 * 1000).toISOString(), // Active
      },
      {
        id: 'e2',
        roomId: 'r1',
        workspaceId: 'w1',
        visitorName: 'Visitor 2 (Abandoned)',
        visitorEmail: 'v2@example.com',
        status: 'waiting',
        position: 0,
        joinedQueueAt: '2026-09-01T11:52:00Z',
        lastHeartbeatAt: new Date(refNow.getTime() - 200 * 1000).toISOString(), // Stale / Abandoned
      },
      {
        id: 'e3',
        roomId: 'r1',
        workspaceId: 'w1',
        visitorName: 'Visitor 3',
        visitorEmail: 'v3@example.com',
        status: 'waiting',
        position: 0,
        joinedQueueAt: '2026-09-01T11:55:00Z',
        lastHeartbeatAt: new Date(refNow.getTime() - 10 * 1000).toISOString(), // Active
      },
    ];

    const result = recalculateQueuePositions(entries, refNow);

    const activeV1 = result.find(e => e.id === 'e1')!;
    expect(activeV1.position).toBe(1);
    expect(activeV1.status).toBe('waiting');

    const abandonedV2 = result.find(e => e.id === 'e2')!;
    expect(abandonedV2.position).toBe(0);
    expect(abandonedV2.status).toBe('abandoned');

    const activeV3 = result.find(e => e.id === 'e3')!;
    expect(activeV3.position).toBe(2);
    expect(activeV3.status).toBe('waiting');
  });

  it('estimates wait times based on position and consultation duration', () => {
    expect(estimateWaitTimeMinutes(1, 15)).toBe(0); // Next in line
    expect(estimateWaitTimeMinutes(2, 15)).toBe(15);
    expect(estimateWaitTimeMinutes(3, 15)).toBe(30);
  });
});
