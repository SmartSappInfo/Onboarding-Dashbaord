/**
 * @fileOverview Unit Tests for Deal Task Cadence & Cleanup Canonical Core Engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeWorkingDate,
  formatCadenceSlotTime,
  buildCadenceTimeSlots,
  generateCadenceDaySummaries,
  generateCadencePreview,
  executeCadenceSchedule,
  type AssigneeInfo,
} from '../deal-task-cadence-core';
import type { Deal, DealTaskCadenceConfig } from '../deal-types';
import { createTaskCore } from '@/lib/tasks/task-core';

// In-memory mock store
const mockDealsStore = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((colName: string) => ({
        where: vi.fn((_field: string, _op: string, _val: unknown) => ({
          get: vi.fn(async () => {
            const docs = Array.from(mockDealsStore.entries()).map(([id, data]) => ({
              id,
              data: () => ({ ...data }),
            }));
            return {
              empty: docs.length === 0,
              size: docs.length,
              docs,
            };
          }),
        })),
        doc: vi.fn((id: string) => ({
          id,
          get: vi.fn(async () => {
            const data = mockDealsStore.get(id);
            return {
              exists: Boolean(data),
              id,
              data: () => data,
            };
          }),
          update: vi.fn(async (updates: Record<string, unknown>) => {
            const existing = mockDealsStore.get(id) || {};
            mockDealsStore.set(id, { ...existing, ...updates });
          }),
        })),
      })),
      batch: vi.fn(() => ({
        update: vi.fn((ref: { id: string }, updates: Record<string, unknown>) => {
          const existing = mockDealsStore.get(ref.id) || {};
          mockDealsStore.set(ref.id, { ...existing, ...updates });
        }),
        commit: vi.fn(async () => {}),
      })),
    },
  };
});

vi.mock('@/lib/tasks/task-core', () => ({
  createTaskCore: vi.fn(async () => ({ success: true, id: `task_${Date.now()}` })),
}));

vi.mock('@/lib/services/identity/person-service', () => ({
  PersonService: {
    getPerson: vi.fn(async (id: string) => {
      if (id === 'rep_1') return { id: 'rep_1', displayName: 'Sarah Jenkins', email: 'sarah@example.com' };
      if (id === 'rep_2') return { id: 'rep_2', displayName: 'Marcus Vance', email: 'marcus@example.com' };
      return null;
    }),
  },
}));

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn(async () => {}),
}));

describe('Deal Task Cadence Core Engine Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDealsStore.clear();
  });

  describe('computeWorkingDate Calendar Math', () => {
    it('advances calendar days correctly without skipping when skipWeekends is false', () => {
      // 2026-10-12 is Monday
      const d1 = computeWorkingDate('2026-10-12', 0, false);
      expect(d1.getFullYear()).toBe(2026);
      expect(d1.getMonth()).toBe(9); // October = 9 (0-indexed)
      expect(d1.getDate()).toBe(12);

      const d2 = computeWorkingDate('2026-10-12', 4, false);
      expect(d2.getDate()).toBe(16); // Friday
    });

    it('skips weekends when skipWeekends is true', () => {
      // 2026-10-16 is Friday. Advancing 1 working day should land on Monday 2026-10-19
      const friday = '2026-10-16';
      const monday = computeWorkingDate(friday, 1, true);

      expect(monday.getDay()).toBe(1); // Monday
      expect(monday.getDate()).toBe(19);
    });

    it('advances a Saturday start date to Monday when skipWeekends is true', () => {
      // 2026-10-17 is Saturday
      const startSaturday = '2026-10-17';
      const result = computeWorkingDate(startSaturday, 0, true);

      expect(result.getDay()).toBe(1); // Should advance to Monday
      expect(result.getDate()).toBe(19);
    });
  });

  describe('formatCadenceSlotTime Slot Formatting', () => {
    it('spaces intra-day slots by intervalMinutes', () => {
      const day = new Date(2026, 9, 12, 9, 0, 0); // 2026-10-12
      const slot0 = formatCadenceSlotTime(day, '09:00', 0, 30);
      const slot1 = formatCadenceSlotTime(day, '09:00', 1, 30);
      const slot2 = formatCadenceSlotTime(day, '09:00', 2, 30);

      expect(slot0).toContain('09:00:00');
      expect(slot1).toContain('09:30:00');
      expect(slot2).toContain('10:00:00');
    });

    it('clamps slot times to 17:00 when interval would exceed business hours', () => {
      const day = new Date(2026, 9, 12, 9, 0, 0);
      // 20 slots * 30 mins = 10 hours from 09:00 = 19:00 (7 PM). Clamped to 17:00
      const lateSlot = formatCadenceSlotTime(day, '09:00', 20, 30);
      expect(lateSlot).toContain('17:00:00');
    });
  });

  describe('buildCadenceTimeSlots Capacity Pacing', () => {
    const mockDeals: Deal[] = Array.from({ length: 12 }, (_, i) => ({
      id: `deal_${i + 1}`,
      name: `Deal ${i + 1}`,
      value: (i + 1) * 1000,
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      entityId: `ent_${i + 1}`,
      status: 'open',
      stageId: 'lead',
      pipelineId: 'p1',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      assignedTo: null,
    }));

    const singleRep: AssigneeInfo[] = [{ id: 'rep_1', name: 'Sarah Jenkins', email: 'sarah@example.com' }];

    it('paces tasks correctly for a single rep with max 5 tasks per day', () => {
      const config: DealTaskCadenceConfig = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        dealIds: mockDeals.map((d) => d.id),
        actionType: 'call',
        taskTitle: 'Discovery Follow-up',
        taskPriority: 'medium',
        maxFrequencyPerDay: 5,
        startDate: '2026-10-12', // Monday
        startTime: '09:00',
        intervalMinutes: 30,
        skipWeekends: true,
        assigneeMode: 'single',
        targetAssigneeIds: ['rep_1'],
      };

      const slots = buildCadenceTimeSlots(mockDeals, config, singleRep);

      expect(slots).toHaveLength(12);

      // Day 0: Deals 1-5
      for (let i = 0; i < 5; i++) {
        expect(slots[i].dayIndex).toBe(0);
        expect(slots[i].assigneeId).toBe('rep_1');
      }

      // Day 1: Deals 6-10
      for (let i = 5; i < 10; i++) {
        expect(slots[i].dayIndex).toBe(1);
        expect(slots[i].assigneeId).toBe('rep_1');
      }

      // Day 2: Deals 11-12
      expect(slots[10].dayIndex).toBe(2);
      expect(slots[11].dayIndex).toBe(2);
    });

    it('rotates assignees in round-robin mode across team pool', () => {
      const teamReps: AssigneeInfo[] = [
        { id: 'rep_1', name: 'Sarah Jenkins' },
        { id: 'rep_2', name: 'Marcus Vance' },
      ];

      const config: DealTaskCadenceConfig = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        dealIds: mockDeals.slice(0, 4).map((d) => d.id),
        actionType: 'email',
        taskTitle: 'ICP Touch',
        taskPriority: 'medium',
        maxFrequencyPerDay: 5,
        startDate: '2026-10-12',
        startTime: '10:00',
        intervalMinutes: 45,
        skipWeekends: true,
        assigneeMode: 'round_robin',
        targetAssigneeIds: ['rep_1', 'rep_2'],
      };

      const slots = buildCadenceTimeSlots(mockDeals.slice(0, 4), config, teamReps);

      expect(slots).toHaveLength(4);
      expect(slots[0].assigneeId).toBe('rep_1');
      expect(slots[1].assigneeId).toBe('rep_2');
      expect(slots[2].assigneeId).toBe('rep_1');
      expect(slots[3].assigneeId).toBe('rep_2');
    });
  });

  describe('generateCadencePreview Two-Phase Read-Only Preview', () => {
    it('summarizes days, dates, and deal count accurately', () => {
      const mockDeals: Deal[] = Array.from({ length: 7 }, (_, i) => ({
        id: `deal_${i + 1}`,
        name: `Deal ${i + 1}`,
        value: 10000,
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        entityId: `ent_${i + 1}`,
        status: 'open',
        stageId: 'lead',
        pipelineId: 'p1',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
        assignedTo: null,
      }));

      const singleRep: AssigneeInfo[] = [{ id: 'rep_1', name: 'Sarah Jenkins' }];

      const config: DealTaskCadenceConfig = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        dealIds: mockDeals.map((d) => d.id),
        actionType: 'call',
        taskTitle: 'Demo Review',
        taskPriority: 'medium',
        maxFrequencyPerDay: 3,
        startDate: '2026-10-12', // Monday
        startTime: '09:00',
        intervalMinutes: 30,
        skipWeekends: true,
        assigneeMode: 'single',
        targetAssigneeIds: ['rep_1'],
      };

      const preview = generateCadencePreview(mockDeals, config, singleRep);

      expect(preview.totalDeals).toBe(7);
      expect(preview.totalPipelineValue).toBe(70000);
      expect(preview.totalDaysSpanned).toBe(3); // 3 deals day 1, 3 day 2, 1 day 3
      expect(preview.daySummaries).toHaveLength(3);
      expect(preview.daySummaries[0].taskCount).toBe(3);
      expect(preview.daySummaries[1].taskCount).toBe(3);
      expect(preview.daySummaries[2].taskCount).toBe(1);
    });
  });

  describe('executeCadenceSchedule Execution & Deal Invariant', () => {
    it('assigns unassigned deals to the representative atomically with the task', async () => {
      // Seed unassigned deals into store
      mockDealsStore.set('deal_unassigned_1', {
        id: 'deal_unassigned_1',
        name: 'Enterprise Pilot Deal',
        workspaceId: 'ws_active',
        assignedTo: null,
        ownerId: null,
        nextStep: null,
      });

      mockDealsStore.set('deal_unassigned_2', {
        id: 'deal_unassigned_2',
        name: 'Growth Tier Deal',
        workspaceId: 'ws_active',
        assignedTo: null,
        ownerId: null,
        nextStep: null,
      });

      const config: DealTaskCadenceConfig = {
        workspaceId: 'ws_active',
        organizationId: 'org_test',
        dealIds: ['deal_unassigned_1', 'deal_unassigned_2'],
        actionType: 'call',
        taskTitle: 'Executive Qualification',
        taskDescription: 'Call the economic buyer to verify budget.',
        taskPriority: 'medium',
        maxFrequencyPerDay: 5,
        startDate: '2026-10-12',
        startTime: '09:30',
        intervalMinutes: 30,
        skipWeekends: true,
        assigneeMode: 'single',
        targetAssigneeIds: ['rep_1'],
      };

      const result = await executeCadenceSchedule(config, 'admin_user');

      expect(result.status).toBe('completed');
      expect(result.tasksCreatedCount).toBe(2);
      expect(result.dealsUpdatedCount).toBe(2);

      // Verify that createTaskCore was called
      expect(createTaskCore).toHaveBeenCalledTimes(2);

      // Verify invariant: The deals are now assigned to rep_1 and have nextStep set
      const d1 = mockDealsStore.get('deal_unassigned_1')!;
      expect(d1.ownerId).toBe('rep_1');
      expect((d1.assignedTo as { userId: string }).userId).toBe('rep_1');
      expect((d1.assignedTo as { name: string }).name).toBe('Sarah Jenkins');
      expect(d1.nextStep).toBe('Executive Qualification');
      expect(d1.nextStepDueDate).toBeDefined();

      const d2 = mockDealsStore.get('deal_unassigned_2')!;
      expect(d2.ownerId).toBe('rep_1');
      expect(d2.nextStep).toBe('Executive Qualification');
    });
  });
});
