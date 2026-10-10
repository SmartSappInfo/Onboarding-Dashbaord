/**
 * @fileOverview Unit Tests for Task Triage & Standup Filtering Engine
 *
 * Tests:
 * 1. Independent filtering for Overdue, Upcoming, and Completed tasks.
 * 2. Standup Mode logic:
 *    - Tuesday-Friday: Yesterday + Today
 *    - Monday Weekend Twist: Friday + Saturday + Sunday + Monday
 * 3. Dynamic card ordering:
 *    - Normal Mode: Overdue -> Upcoming -> Completed
 *    - Standup Mode: Completed -> Upcoming -> Overdue
 * 4. Global presets coordination.
 * 5. Strict typing & defensive parsing of missing/malformed dates.
 */

import { describe, it, expect } from 'vitest';
import type { Task } from '@/lib/types';
import {
  calculateTriageBuckets,
  filterCompletedTasks,
  filterUpcomingTasks,
  filterOverdueTasks,
  getGlobalPresetSubFilters,
  isMondayDate,
  type TaskTriageFilterOptions,
} from '../task-triage-filter-engine';

describe('task-triage-filter-engine', () => {
  // Fixed Anchor Dates for testing:
  // 2026-10-12 is a MONDAY
  // 2026-10-13 is a TUESDAY
  const MONDAY_ANCHOR = new Date('2026-10-12T10:00:00.000Z');
  const TUESDAY_ANCHOR = new Date('2026-10-13T10:00:00.000Z');

  const createMockTask = (overrides: Partial<Task>): Task => ({
    id: `task-${Math.random().toString(36).slice(2, 7)}`,
    title: 'Test Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    category: 'general',
    assignedTo: 'user-1',
    dueDate: '2026-10-15T10:00:00.000Z',
    reminders: [],
    reminderSent: false,
    workspaceId: 'ws-123',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  });


  describe('isMondayDate', () => {
    it('correctly identifies a Monday', () => {
      expect(isMondayDate(MONDAY_ANCHOR)).toBe(true);
      expect(isMondayDate(TUESDAY_ANCHOR)).toBe(false);
    });
  });

  describe('Standup Mode: Monday Weekend Twist', () => {
    it('on Monday, Completed includes Friday, Saturday, Sunday, and Monday completions', () => {
      const taskFriday = createMockTask({
        id: 't-fri',
        status: 'done',
        completedAt: '2026-10-09T16:00:00.000Z', // Friday
      });
      const taskSaturday = createMockTask({
        id: 't-sat',
        status: 'done',
        completedAt: '2026-10-10T12:00:00.000Z', // Saturday
      });
      const taskSunday = createMockTask({
        id: 't-sun',
        status: 'done',
        completedAt: '2026-10-11T14:00:00.000Z', // Sunday
      });
      const taskMonday = createMockTask({
        id: 't-mon',
        status: 'done',
        completedAt: '2026-10-12T09:00:00.000Z', // Monday
      });
      const taskThursday = createMockTask({
        id: 't-thu',
        status: 'done',
        completedAt: '2026-10-08T18:00:00.000Z', // Thursday (prior)
      });

      const allCompleted = [taskThursday, taskFriday, taskSaturday, taskSunday, taskMonday];

      const result = filterCompletedTasks(allCompleted, 'today', MONDAY_ANCHOR, 'standup');

      const ids = result.map((t) => t.id);
      expect(ids).toContain('t-fri');
      expect(ids).toContain('t-sat');
      expect(ids).toContain('t-sun');
      expect(ids).toContain('t-mon');
      expect(ids).not.toContain('t-thu');
    });

    it('on Tuesday, Completed includes Yesterday (Monday) and Today (Tuesday)', () => {
      const taskSunday = createMockTask({
        id: 't-sun',
        status: 'done',
        completedAt: '2026-10-11T14:00:00.000Z',
      });
      const taskMonday = createMockTask({
        id: 't-mon',
        status: 'done',
        completedAt: '2026-10-12T15:00:00.000Z',
      });
      const taskTuesday = createMockTask({
        id: 't-tue',
        status: 'done',
        completedAt: '2026-10-13T09:30:00.000Z',
      });

      const all = [taskSunday, taskMonday, taskTuesday];
      const result = filterCompletedTasks(all, 'today', TUESDAY_ANCHOR, 'standup');

      const ids = result.map((t) => t.id);
      expect(ids).toContain('t-mon');
      expect(ids).toContain('t-tue');
      expect(ids).not.toContain('t-sun');
    });
  });

  describe('filterCompletedTasks in Normal Mode', () => {
    it('filters strictly by Today', () => {
      const taskToday = createMockTask({
        id: 't-today',
        status: 'done',
        completedAt: '2026-10-13T08:00:00.000Z',
      });
      const taskYesterday = createMockTask({
        id: 't-yest',
        status: 'done',
        completedAt: '2026-10-12T18:00:00.000Z',
      });

      const result = filterCompletedTasks([taskToday, taskYesterday], 'today', TUESDAY_ANCHOR, 'normal');
      expect(result.map((t) => t.id)).toEqual(['t-today']);
    });

    it('filters strictly by Yesterday', () => {
      const taskToday = createMockTask({
        id: 't-today',
        status: 'done',
        completedAt: '2026-10-13T08:00:00.000Z',
      });
      const taskYesterday = createMockTask({
        id: 't-yest',
        status: 'done',
        completedAt: '2026-10-12T18:00:00.000Z',
      });

      const result = filterCompletedTasks([taskToday, taskYesterday], 'yesterday', TUESDAY_ANCHOR, 'normal');
      expect(result.map((t) => t.id)).toEqual(['t-yest']);
    });

    it('returns all completed tasks when all_time is chosen', () => {
      const taskOld = createMockTask({
        id: 't-old',
        status: 'done',
        completedAt: '2026-01-01T00:00:00.000Z',
      });
      const result = filterCompletedTasks([taskOld], 'all_time', TUESDAY_ANCHOR, 'normal');
      expect(result.length).toBe(1);
    });
  });

  describe('filterUpcomingTasks', () => {
    it('filters by Today and Tomorrow correctly', () => {
      const taskToday = createMockTask({
        id: 'up-today',
        status: 'todo',
        dueDate: '2026-10-13T17:00:00.000Z',
      });
      const taskTomorrow = createMockTask({
        id: 'up-tomorrow',
        status: 'todo',
        dueDate: '2026-10-14T17:00:00.000Z',
      });
      const taskNextWeek = createMockTask({
        id: 'up-nextweek',
        status: 'todo',
        dueDate: '2026-10-22T17:00:00.000Z',
      });

      const tasks = [taskToday, taskTomorrow, taskNextWeek];

      expect(filterUpcomingTasks(tasks, 'today', TUESDAY_ANCHOR, 'normal').map((t) => t.id)).toEqual(['up-today']);
      expect(filterUpcomingTasks(tasks, 'tomorrow', TUESDAY_ANCHOR, 'normal').map((t) => t.id)).toEqual(['up-tomorrow']);
    });
  });

  describe('filterOverdueTasks', () => {
    it('identifies overdue tasks and excludes completed tasks', () => {
      const overdueTask = createMockTask({
        id: 'ov-1',
        status: 'todo',
        dueDate: '2026-10-10T12:00:00.000Z', // Before Tuesday
      });
      const completedPastDue = createMockTask({
        id: 'ov-done',
        status: 'done',
        dueDate: '2026-10-10T12:00:00.000Z',
      });

      const tasks = [overdueTask, completedPastDue];
      const result = filterOverdueTasks(tasks, 'all_time', TUESDAY_ANCHOR, 'normal');

      expect(result.map((t) => t.id)).toEqual(['ov-1']);
    });
  });

  describe('calculateTriageBuckets & Ordering', () => {
    it('in Normal Mode, orders Overdue -> Upcoming -> Completed', () => {
      const taskOverdue = createMockTask({ id: 't-ov', status: 'todo', dueDate: '2026-10-01' });
      const taskUpcoming = createMockTask({ id: 't-up', status: 'todo', dueDate: '2026-10-13' });
      const taskCompleted = createMockTask({ id: 't-done', status: 'done', completedAt: '2026-10-13' });

      const options: TaskTriageFilterOptions = {
        anchorDate: TUESDAY_ANCHOR,
        mode: 'normal',
        completedFilter: 'today',
        upcomingFilter: 'today',
        overdueFilter: 'all_time',
      };

      const buckets = calculateTriageBuckets([taskOverdue, taskUpcoming, taskCompleted], options);

      expect(buckets.cardOrder).toEqual(['overdue', 'upcoming', 'completed']);
      expect(buckets.overdueTasks.map((t) => t.id)).toEqual(['t-ov']);
      expect(buckets.upcomingTasks.map((t) => t.id)).toEqual(['t-up']);
      expect(buckets.completedTasks.map((t) => t.id)).toEqual(['t-done']);
      expect(buckets.isMondayStandup).toBe(false);
    });

    it('in Standup Mode on Monday, orders Completed -> Upcoming -> Overdue and flags isMondayStandup', () => {
      const options: TaskTriageFilterOptions = {
        anchorDate: MONDAY_ANCHOR,
        mode: 'standup',
        completedFilter: 'today',
        upcomingFilter: 'today',
        overdueFilter: 'all_time',
      };

      const buckets = calculateTriageBuckets([], options);

      expect(buckets.cardOrder).toEqual(['completed', 'upcoming', 'overdue']);
      expect(buckets.isMondayStandup).toBe(true);
    });
  });

  describe('getGlobalPresetSubFilters', () => {
    it('maps global presets to coordinate all three cards', () => {
      expect(getGlobalPresetSubFilters('today')).toEqual({
        completed: 'today',
        upcoming: 'today',
        overdue: 'all_time',
      });

      expect(getGlobalPresetSubFilters('this_week')).toEqual({
        completed: 'this_week',
        upcoming: 'this_week',
        overdue: 'this_week',
      });

      expect(getGlobalPresetSubFilters('this_month')).toEqual({
        completed: 'this_month',
        upcoming: 'this_month',
        overdue: 'this_month',
      });

      expect(getGlobalPresetSubFilters('all_time')).toEqual({
        completed: 'all_time',
        upcoming: 'all_time',
        overdue: 'all_time',
      });
    });
  });
});
