import { describe, it, expect } from 'vitest';
import type { Task, UserProfile } from '@/lib/types';
import {
  calculateTriageBuckets,
  getGlobalPresetSubFilters,
  isMondayDate,
  type TaskTriageMode,
  type CompletedSubFilter,
  type UpcomingSubFilter,
  type OverdueSubFilter,
  type GlobalPeriodPreset,
} from '@/lib/tasks/task-triage-filter-engine';

describe('TasksClient Triage Integration & Scoping Invariants', () => {
  const currentUserId = 'usr_current';
  const teammateId = 'usr_alice';
  const managerId = 'usr_bob';

  const mockUsers: UserProfile[] = [
    {
      id: currentUserId,
      email: 'current@company.com',
      name: 'Current User',
      organizationId: 'org-1',
      workspaceIds: ['ws-1'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: teammateId,
      email: 'alice@company.com',
      name: 'Alice Engineer',
      organizationId: 'org-1',
      workspaceIds: ['ws-1'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: managerId,
      email: 'bob@company.com',
      name: 'Bob Manager',
      organizationId: 'org-1',
      workspaceIds: ['ws-1'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Current user completed today',
      description: '',
      status: 'done',
      priority: 'high',
      category: 'follow_up',
      assignedTo: [currentUserId],
      dueDate: '2026-10-12T10:00:00.000Z',
      completedAt: '2026-10-12T10:00:00.000Z', // Monday
      workspaceId: 'ws-1',
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-12T10:00:00.000Z',
      reminders: [],
      reminderSent: false,
    },
    {
      id: 'task-2',
      title: 'Alice completed on Friday',
      description: '',
      status: 'done',
      priority: 'medium',
      category: 'general',
      assignedTo: [teammateId],
      dueDate: '2026-10-09T16:00:00.000Z',
      completedAt: '2026-10-09T16:00:00.000Z', // Friday
      workspaceId: 'ws-1',
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-09T16:00:00.000Z',
      reminders: [],
      reminderSent: false,
    },
    {
      id: 'task-3',
      title: 'Alice upcoming today',
      description: '',
      status: 'todo',
      priority: 'urgent',
      category: 'call',
      assignedTo: [teammateId],
      dueDate: '2026-10-12T14:00:00.000Z', // Monday
      workspaceId: 'ws-1',
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-01T08:00:00.000Z',
      reminders: [],
      reminderSent: false,
    },
    {
      id: 'task-4',
      title: 'Current user overdue from yesterday/Sunday',
      description: '',
      status: 'todo',
      priority: 'high',
      category: 'general',
      assignedTo: [currentUserId],
      dueDate: '2026-10-11T12:00:00.000Z', // Sunday
      workspaceId: 'ws-1',
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-01T08:00:00.000Z',
      reminders: [],
      reminderSent: false,
    },
    {
      id: 'task-5',
      title: 'Unassigned upcoming tomorrow',
      description: '',
      status: 'todo',
      priority: 'low',
      category: 'general',
      assignedTo: [],
      dueDate: '2026-10-13T10:00:00.000Z', // Tuesday
      workspaceId: 'ws-1',
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-01T08:00:00.000Z',
      reminders: [],
      reminderSent: false,
    },
  ];

  // Helper function matching TasksClient scope filtering
  function filterByScope(
    tasks: Task[],
    scope: 'my' | 'team' | 'member' | 'all',
    userId: string,
    selectedMemberId: string | null
  ): Task[] {
    return tasks.filter((task) => {
      const assignees = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : task.assignedTo
        ? [task.assignedTo]
        : [];

      if (scope === 'my') {
        return assignees.includes(userId);
      }
      if (scope === 'team') {
        return assignees.length > 0;
      }
      if (scope === 'member' && selectedMemberId) {
        return assignees.includes(selectedMemberId);
      }
      return true; // 'all'
    });
  }

  describe('Default Workspace Scope Invariant', () => {
    it('defaults to "all" returning all tasks regardless of assignee', () => {
      const defaultScope = 'all';
      const scoped = filterByScope(mockTasks, defaultScope, currentUserId, null);
      expect(scoped.length).toBe(mockTasks.length);
    });

    it('scopes correctly to selected team member when scope is "member"', () => {
      const scoped = filterByScope(mockTasks, 'member', currentUserId, teammateId);
      expect(scoped.map((t) => t.id)).toEqual(['task-2', 'task-3']);
    });

    it('scopes correctly to "my" tasks', () => {
      const scoped = filterByScope(mockTasks, 'my', currentUserId, null);
      expect(scoped.map((t) => t.id)).toEqual(['task-1', 'task-4']);
    });
  });

  describe('Triage Bucketing and Dynamic Card Order', () => {
    const mondayAnchor = new Date('2026-10-12T12:00:00.000Z'); // Monday noon

    it('returns triage-first card order [overdue, upcoming, completed] in normal mode', () => {
      const result = calculateTriageBuckets(mockTasks, {
        mode: 'normal',
        anchorDate: mondayAnchor,
        completedFilter: 'today',
        upcomingFilter: 'today',
        overdueFilter: 'all_time',
      });

      expect(result.cardOrder).toEqual(['overdue', 'upcoming', 'completed']);
      expect(result.isMondayStandup).toBe(false);
      expect(result.overdueTasks.length).toBe(1);
      expect(result.upcomingTasks.length).toBe(1);
      expect(result.completedTasks.length).toBe(1);
    });

    it('returns agile standup card order [completed, upcoming, overdue] in standup mode', () => {
      const result = calculateTriageBuckets(mockTasks, {
        mode: 'standup',
        anchorDate: mondayAnchor,
        completedFilter: 'today',
        upcomingFilter: 'today',
        overdueFilter: 'all_time',
      });

      expect(result.cardOrder).toEqual(['completed', 'upcoming', 'overdue']);
      expect(result.isMondayStandup).toBe(true);
      // Monday standup covers Friday (task-2) and Monday (task-1)
      expect(result.completedTasks.map((t) => t.id).sort()).toEqual(['task-1', 'task-2']);
    });
  });

  describe('Global Preset Synchronization', () => {
    it('synchronizes all three cards to matching presets', () => {
      const todayPreset = getGlobalPresetSubFilters('today');
      expect(todayPreset).toEqual({
        completed: 'today',
        upcoming: 'today',
        overdue: 'all_time',
      });

      const weekPreset = getGlobalPresetSubFilters('this_week');
      expect(weekPreset).toEqual({
        completed: 'this_week',
        upcoming: 'this_week',
        overdue: 'this_week',
      });

      const monthPreset = getGlobalPresetSubFilters('this_month');
      expect(monthPreset).toEqual({
        completed: 'this_month',
        upcoming: 'this_month',
        overdue: 'this_month',
      });

      const allTimePreset = getGlobalPresetSubFilters('all_time');
      expect(allTimePreset).toEqual({
        completed: 'all_time',
        upcoming: 'all_time',
        overdue: 'all_time',
      });
    });
  });
});
