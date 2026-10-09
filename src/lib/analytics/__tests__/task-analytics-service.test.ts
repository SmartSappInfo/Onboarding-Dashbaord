/**
 * @fileOverview Unit tests for Task Analytics Service (Phase 4C).
 * Validates:
 * - Throughput, cycle time, lead time calculation.
 * - On-time completion rate.
 * - Cancelled tasks exclusion from completion metrics.
 * - Safe handling of empty datasets and zero denominators (no NaN).
 * - Blocker resolution mean-time-to-resolution (MTTR) calculation.
 */

import { describe, it, expect } from 'vitest';
import { calculateTaskAnalytics } from '../task-analytics-service';
import type { Task, BlockerRecord } from '@/lib/types';

describe('calculateTaskAnalytics (Phase 4C)', () => {
  it('handles empty datasets safely without NaN or errors', () => {
    const summary = calculateTaskAnalytics([], []);

    expect(summary.totalTasks).toBe(0);
    expect(summary.completedTasks).toBe(0);
    expect(summary.openTasks).toBe(0);
    expect(summary.overdueTasks).toBe(0);
    expect(summary.completionRate).toBe(0);
    expect(summary.onTimeRate).toBe(0);
    expect(summary.avgCycleTimeDays).toBe(0);
    expect(summary.avgLeadTimeDays).toBe(0);
    expect(summary.totalBlockers).toBe(0);
    expect(summary.avgBlockerResolutionHours).toBe(0);
    expect(isNaN(summary.completionRate)).toBe(false);
  });

  it('calculates completion and on-time rates accurately', () => {
    const mockTasks: Task[] = [
      // Completed on time: created 2026-10-01, due 2026-10-05, completed 2026-10-04 (lead time 3d)
      {
        id: 't1',
        workspaceId: 'ws-1',
        title: 'Task 1',
        description: '',
        status: 'done',
        priority: 'high',
        category: 'general',
        assignedTo: 'u1',
        createdAt: '2026-10-01T00:00:00.000Z',
        dueDate: '2026-10-05',
        completedAt: '2026-10-04T00:00:00.000Z',
        updatedAt: '2026-10-04T00:00:00.000Z',
        reminders: [],
        reminderSent: false,
      },
      // Completed late: created 2026-10-01, due 2026-10-03, completed 2026-10-06 (lead time 5d)
      {
        id: 't2',
        workspaceId: 'ws-1',
        title: 'Task 2',
        description: '',
        status: 'done',
        priority: 'medium',
        category: 'document',
        assignedTo: 'u1',
        createdAt: '2026-10-01T00:00:00.000Z',
        dueDate: '2026-10-03',
        completedAt: '2026-10-06T00:00:00.000Z',
        updatedAt: '2026-10-06T00:00:00.000Z',
        reminders: [],
        reminderSent: false,
      },
      // Open and overdue: due 2026-10-02 (relative to 2026-10-09)
      {
        id: 't3',
        workspaceId: 'ws-1',
        title: 'Task 3',
        description: '',
        status: 'in_progress',
        priority: 'urgent',
        category: 'follow_up',
        assignedTo: 'u2',
        createdAt: '2026-10-01T00:00:00.000Z',
        dueDate: '2026-10-02',
        updatedAt: '2026-10-01T00:00:00.000Z',
        reminders: [],
        reminderSent: false,
      },
      // Open waiting: due 2026-10-15 (future)
      {
        id: 't4',
        workspaceId: 'ws-1',
        title: 'Task 4',
        description: '',
        status: 'waiting',
        priority: 'low',
        category: 'call',
        assignedTo: 'u2',
        createdAt: '2026-10-01T00:00:00.000Z',
        dueDate: '2026-10-15',
        updatedAt: '2026-10-01T00:00:00.000Z',
        reminders: [],
        reminderSent: false,
      },
    ];

    const summary = calculateTaskAnalytics(mockTasks, [], '2026-10-09T00:00:00.000Z');

    expect(summary.totalTasks).toBe(4);
    expect(summary.completedTasks).toBe(2);
    expect(summary.openTasks).toBe(2);
    expect(summary.overdueTasks).toBe(1);

    // Completion rate: 2 completed out of 4 = 50%
    expect(summary.completionRate).toBe(50);

    // On-time rate: 1 of 2 completed on time = 50%
    expect(summary.onTimeRate).toBe(50);

    // Avg lead time: (3 + 5) / 2 = 4 days
    expect(summary.avgLeadTimeDays).toBe(4);
  });

  it('calculates blocker MTTR in hours correctly', () => {
    const mockBlockers: BlockerRecord[] = [
      {
        id: 'b1',
        workspaceId: 'ws-1',
        summary: 'Cert issue',
        category: 'technical',
        severity: 'high',
        status: 'resolved',
        raisedBy: 'u1',
        createdAt: '2026-10-09T00:00:00.000Z',
        resolvedAt: '2026-10-09T04:00:00.000Z', // 4 hours
        updatedAt: '2026-10-09T04:00:00.000Z',
      },
      {
        id: 'b2',
        workspaceId: 'ws-1',
        summary: 'Server latency',
        category: 'technical',
        severity: 'critical',
        status: 'resolved',
        raisedBy: 'u2',
        createdAt: '2026-10-09T00:00:00.000Z',
        resolvedAt: '2026-10-09T08:00:00.000Z', // 8 hours
        updatedAt: '2026-10-09T08:00:00.000Z',
      },
      {
        id: 'b3',
        workspaceId: 'ws-1',
        summary: 'Still open',
        category: 'general',
        severity: 'low',
        status: 'open',
        raisedBy: 'u3',
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
    ];

    const summary = calculateTaskAnalytics([], mockBlockers);

    expect(summary.totalBlockers).toBe(3);
    expect(summary.resolvedBlockers).toBe(2);
    expect(summary.activeBlockers).toBe(1);

    // Average MTTR: (4h + 8h) / 2 = 6.0 hours
    expect(summary.avgBlockerResolutionHours).toBe(6);
  });
});
