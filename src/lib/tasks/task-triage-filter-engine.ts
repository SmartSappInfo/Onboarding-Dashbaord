/**
 * @fileOverview Pure Domain Filtering Engine for Tasks Triage and Standup Flow
 *
 * Implements:
 * 1. Independent sub-filtering for Overdue, Upcoming, and Completed cards.
 * 2. Standup Mode logic:
 *    - Daily Tuesday-Friday: covers Yesterday 00:00:00 to Today 23:59:59.
 *    - Monday Weekend Twist: covers Friday 00:00:00 through Monday 23:59:59.
 * 3. Dynamic Card Order:
 *    - Normal Mode: Overdue -> Upcoming (Due) -> Completed
 *    - Standup Mode: Completed -> Upcoming (Due) -> Overdue
 * 4. Global presets mapping.
 * 5. Strict typing: Zero `any` or `any[]`.
 *
 * Architectural pointer: Keep this pure and free of React hooks so it can be
 * benchmarked, unit-tested, and executed deterministically across client and server.
 */

import {
  getDay,
  subDays,
  addDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
} from 'date-fns';
import { safeParseDate } from '@/lib/utils/date-utils';
import type { Task } from '@/lib/types';

export type TaskTriageMode = 'normal' | 'standup';

export type CompletedSubFilter =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'all_time';

export type UpcomingSubFilter =
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'this_month'
  | 'all_time';

export type OverdueSubFilter =
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'all_time';

export type GlobalPeriodPreset = 'today' | 'this_week' | 'this_month' | 'all_time';

export interface TaskTriageFilterOptions {
  anchorDate: Date;
  mode: TaskTriageMode;
  completedFilter: CompletedSubFilter;
  upcomingFilter: UpcomingSubFilter;
  overdueFilter: OverdueSubFilter;
}

export type TriageCardId = 'overdue' | 'upcoming' | 'completed';

export interface TaskTriageResult {
  cardOrder: TriageCardId[];
  overdueTasks: Task[];
  upcomingTasks: Task[];
  completedTasks: Task[];
  isMondayStandup: boolean;
  standupCoverageLabel?: string;
}

/**
 * Checks whether the given date is a Monday (ISO day 1).
 */
export function isMondayDate(date: Date): boolean {
  return getDay(date) === 1;
}

/**
 * Filters completed tasks according to the selected sub-filter and triage mode.
 */
export function filterCompletedTasks(
  tasks: Task[],
  subFilter: CompletedSubFilter,
  anchorDate: Date,
  mode: TaskTriageMode
): Task[] {
  const completedOnly = tasks.filter((t) => t.status === 'done');
  if (subFilter === 'all_time') {
    return completedOnly;
  }

  // Standup Mode handling for 'today'
  if (mode === 'standup' && subFilter === 'today') {
    const isMonday = isMondayDate(anchorDate);
    const windowStart = isMonday
      ? startOfDay(subDays(anchorDate, 3)) // Friday 00:00:00
      : startOfDay(subDays(anchorDate, 1)); // Yesterday 00:00:00
    const windowEnd = endOfDay(anchorDate);

    return completedOnly.filter((task) => {
      const completedDate = safeParseDate(task.completedAt || task.updatedAt);
      if (!completedDate) return false;
      return completedDate >= windowStart && completedDate <= windowEnd;
    });
  }

  // Normal mode sub-filter ranges
  let windowStart: Date;
  let windowEnd: Date;

  if (subFilter === 'today') {
    windowStart = startOfDay(anchorDate);
    windowEnd = endOfDay(anchorDate);
  } else if (subFilter === 'yesterday') {
    const yesterday = subDays(anchorDate, 1);
    windowStart = startOfDay(yesterday);
    windowEnd = endOfDay(yesterday);
  } else if (subFilter === 'this_week') {
    windowStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
    windowEnd = endOfWeek(anchorDate, { weekStartsOn: 1 });
  } else if (subFilter === 'this_month') {
    windowStart = startOfMonth(anchorDate);
    windowEnd = endOfMonth(anchorDate);
  } else {
    return completedOnly;
  }

  return completedOnly.filter((task) => {
    const completedDate = safeParseDate(task.completedAt || task.updatedAt);
    if (!completedDate) return false;
    return completedDate >= windowStart && completedDate <= windowEnd;
  });
}

/**
 * Filters upcoming (open/due) tasks according to the selected sub-filter.
 */
export function filterUpcomingTasks(
  tasks: Task[],
  subFilter: UpcomingSubFilter,
  anchorDate: Date,
  _mode: TaskTriageMode
): Task[] {
  const openOnly = tasks.filter((t) => t.status !== 'done');
  const anchorStart = startOfDay(anchorDate);

  if (subFilter === 'all_time') {
    return openOnly.filter((task) => {
      const dueDate = safeParseDate(task.dueDate);
      // Include unscheduled tasks or tasks due today/later
      return !dueDate || dueDate >= anchorStart;
    });
  }

  let windowStart: Date;
  let windowEnd: Date;

  if (subFilter === 'today') {
    windowStart = anchorStart;
    windowEnd = endOfDay(anchorDate);
  } else if (subFilter === 'tomorrow') {
    const tomorrow = addDays(anchorDate, 1);
    windowStart = startOfDay(tomorrow);
    windowEnd = endOfDay(tomorrow);
  } else if (subFilter === 'this_week') {
    windowStart = anchorStart;
    windowEnd = endOfWeek(anchorDate, { weekStartsOn: 1 });
  } else if (subFilter === 'this_month') {
    windowStart = anchorStart;
    windowEnd = endOfMonth(anchorDate);
  } else {
    return openOnly;
  }

  return openOnly.filter((task) => {
    const dueDate = safeParseDate(task.dueDate);
    if (!dueDate) return false;
    return dueDate >= windowStart && dueDate <= windowEnd;
  });
}

/**
 * Filters overdue tasks according to the selected sub-filter.
 */
export function filterOverdueTasks(
  tasks: Task[],
  subFilter: OverdueSubFilter,
  anchorDate: Date,
  _mode: TaskTriageMode
): Task[] {
  const anchorStart = startOfDay(anchorDate);

  // Baseline: Must be incomplete and have due date earlier than today's start
  const overdueOnly = tasks.filter((task) => {
    if (task.status === 'done') return false;
    const dueDate = safeParseDate(task.dueDate);
    return Boolean(dueDate && dueDate < anchorStart);
  });

  if (subFilter === 'all_time') {
    return overdueOnly;
  }

  let windowStart: Date;
  let windowEnd: Date;

  if (subFilter === 'yesterday') {
    const yesterday = subDays(anchorDate, 1);
    windowStart = startOfDay(yesterday);
    windowEnd = endOfDay(yesterday);
  } else if (subFilter === 'this_week') {
    windowStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
    windowEnd = endOfDay(subDays(anchorDate, 1));
  } else if (subFilter === 'last_week') {
    const lastWeek = subWeeks(anchorDate, 1);
    windowStart = startOfWeek(lastWeek, { weekStartsOn: 1 });
    windowEnd = endOfWeek(lastWeek, { weekStartsOn: 1 });
  } else if (subFilter === 'this_month') {
    windowStart = startOfMonth(anchorDate);
    windowEnd = endOfDay(subDays(anchorDate, 1));
  } else if (subFilter === 'last_month') {
    const lastMonth = subMonths(anchorDate, 1);
    windowStart = startOfMonth(lastMonth);
    windowEnd = endOfMonth(lastMonth);
  } else {
    return overdueOnly;
  }

  return overdueOnly.filter((task) => {
    const dueDate = safeParseDate(task.dueDate);
    if (!dueDate) return false;
    return dueDate >= windowStart && dueDate <= windowEnd;
  });
}

/**
 * Maps global period presets to coordinate all three cards simultaneously.
 */
export function getGlobalPresetSubFilters(preset: GlobalPeriodPreset): {
  completed: CompletedSubFilter;
  upcoming: UpcomingSubFilter;
  overdue: OverdueSubFilter;
} {
  switch (preset) {
    case 'today':
      return {
        completed: 'today',
        upcoming: 'today',
        overdue: 'all_time',
      };
    case 'this_week':
      return {
        completed: 'this_week',
        upcoming: 'this_week',
        overdue: 'this_week',
      };
    case 'this_month':
      return {
        completed: 'this_month',
        upcoming: 'this_month',
        overdue: 'this_month',
      };
    case 'all_time':
    default:
      return {
        completed: 'all_time',
        upcoming: 'all_time',
        overdue: 'all_time',
      };
  }
}

/**
 * Calculates triage buckets and dynamic card ordering based on options.
 */
export function calculateTriageBuckets(
  tasks: Task[],
  options: TaskTriageFilterOptions
): TaskTriageResult {
  const { anchorDate, mode, completedFilter, upcomingFilter, overdueFilter } = options;

  const isMonday = isMondayDate(anchorDate);
  const isMondayStandup = mode === 'standup' && isMonday;

  const completedTasks = filterCompletedTasks(tasks, completedFilter, anchorDate, mode);
  const upcomingTasks = filterUpcomingTasks(tasks, upcomingFilter, anchorDate, mode);
  const overdueTasks = filterOverdueTasks(tasks, overdueFilter, anchorDate, mode);

  // Dynamic Card Ordering:
  // Normal Mode (Triage First): Overdue -> Upcoming -> Completed
  // Standup Mode (Agile Flow): Completed -> Upcoming -> Overdue
  const cardOrder: TriageCardId[] =
    mode === 'standup'
      ? ['completed', 'upcoming', 'overdue']
      : ['overdue', 'upcoming', 'completed'];

  const standupCoverageLabel = isMondayStandup
    ? 'Monday Standup: Reviewing Fri – Mon work'
    : mode === 'standup'
    ? 'Daily Standup: Reviewing Yesterday & Today'
    : undefined;

  return {
    cardOrder,
    overdueTasks,
    upcomingTasks,
    completedTasks,
    isMondayStandup,
    standupCoverageLabel,
  };
}
