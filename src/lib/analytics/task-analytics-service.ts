/**
 * @fileOverview Task Analytics & Operational Insights Service (Phase 4C).
 *
 * Implements:
 * - Aggregated KPI calculations (throughput, cycle time, lead time, on-time delivery rate).
 * - Blocker resolution velocity and MTTR in hours.
 * - Workload distribution by assignee.
 * - Category and priority distributions.
 * - Defensive arithmetic with zero denominators and invalid dates.
 * - Zero `any` or `any[]` throughout.
 */

import { differenceInHours, differenceInCalendarDays } from 'date-fns';
import { safeParseDate } from '@/lib/utils/date-utils';
import type {
  Task,
  BlockerRecord,
  TaskAnalyticsSummary,
  TaskPriority,
  TaskCategory,
  TaskStatus,
} from '@/lib/types';

export interface UserWorkloadItem {
  userId: string;
  totalAssigned: number;
  openCount: number;
  overdueCount: number;
  completedCount: number;
}

export interface TaskAnalyticsExtended extends TaskAnalyticsSummary {
  tasksByPriority: Record<TaskPriority, number>;
  tasksByCategory: Record<TaskCategory, number>;
  tasksByStatus: Record<TaskStatus, number>;
  userWorkload: UserWorkloadItem[];
}

export function calculateTaskAnalytics(
  tasks: Task[],
  blockers: BlockerRecord[] = [],
  nowIso?: string
): TaskAnalyticsExtended {
  const now = nowIso ? new Date(nowIso) : new Date();
  const totalTasks = tasks.length;

  let completedTasks = 0;
  let openTasks = 0;
  let overdueTasks = 0;

  let completedWithDueDate = 0;
  let onTimeCompleted = 0;

  let totalLeadTimeHours = 0;
  let leadTimeTasksCount = 0;

  let totalCycleTimeHours = 0;
  let cycleTimeTasksCount = 0;

  const tasksByPriority: Record<TaskPriority, number> = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  };

  const tasksByCategory: Record<TaskCategory, number> = {
    general: 0,
    call: 0,
    visit: 0,
    document: 0,
    training: 0,
    follow_up: 0,
  };

  const tasksByStatus: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 0,
    waiting: 0,
    review: 0,
    done: 0,
  };

  const userWorkloadMap = new Map<string, UserWorkloadItem>();

  const getOrCreateUserWorkload = (uid: string): UserWorkloadItem => {
    let item = userWorkloadMap.get(uid);
    if (!item) {
      item = {
        userId: uid,
        totalAssigned: 0,
        openCount: 0,
        overdueCount: 0,
        completedCount: 0,
      };
      userWorkloadMap.set(uid, item);
    }
    return item;
  };

  // Iterate tasks
  for (const task of tasks) {
    if (task.priority && tasksByPriority[task.priority] !== undefined) {
      tasksByPriority[task.priority]++;
    }
    if (task.category && tasksByCategory[task.category] !== undefined) {
      tasksByCategory[task.category]++;
    }
    if (task.status && tasksByStatus[task.status] !== undefined) {
      tasksByStatus[task.status]++;
    }

    const dueDate = safeParseDate(task.dueDate);
    const createdAt = safeParseDate(task.createdAt);
    const completedAt = safeParseDate(task.completedAt || task.updatedAt);

    // Assignee workload tracking
    const assignedUserIds: string[] = Array.isArray(task.assignedTo)
      ? task.assignedTo
      : task.assignedTo
      ? [task.assignedTo]
      : [];

    for (const uid of assignedUserIds) {
      const uWork = getOrCreateUserWorkload(uid);
      uWork.totalAssigned++;
      if (task.status === 'done') {
        uWork.completedCount++;
      } else {
        uWork.openCount++;
        if (dueDate && dueDate < now) {
          uWork.overdueCount++;
        }
      }
    }

    if (task.status === 'done') {
      completedTasks++;

      // On-time check
      if (dueDate && completedAt) {
        completedWithDueDate++;
        // Compare end of due day vs completed date
        const dueCalendarDay = new Date(dueDate);
        dueCalendarDay.setHours(23, 59, 59, 999);
        if (completedAt <= dueCalendarDay) {
          onTimeCompleted++;
        }
      }

      // Lead time calculation (createdAt to completedAt)
      if (createdAt && completedAt) {
        const hours = Math.max(0, differenceInHours(completedAt, createdAt));
        totalLeadTimeHours += hours;
        leadTimeTasksCount++;
      }

      // Cycle time calculation
      if (createdAt && completedAt) {
        const days = Math.max(0, differenceInCalendarDays(completedAt, createdAt));
        totalCycleTimeHours += days * 24;
        cycleTimeTasksCount++;
      }
    } else {
      openTasks++;
      if (dueDate && dueDate < now) {
        overdueTasks++;
      }
    }
  }

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const onTimeRate =
    completedWithDueDate > 0
      ? Math.round((onTimeCompleted / completedWithDueDate) * 100)
      : completedTasks > 0
      ? 100
      : 0;

  const avgLeadTimeDays =
    leadTimeTasksCount > 0
      ? Math.round((totalLeadTimeHours / leadTimeTasksCount / 24) * 10) / 10
      : 0;

  const avgCycleTimeDays =
    cycleTimeTasksCount > 0
      ? Math.round((totalCycleTimeHours / cycleTimeTasksCount / 24) * 10) / 10
      : 0;

  // Blocker calculations
  const totalBlockers = blockers.length;
  let resolvedBlockers = 0;
  let totalResolutionHours = 0;

  for (const blk of blockers) {
    if (blk.status === 'resolved') {
      resolvedBlockers++;
      const created = safeParseDate(blk.createdAt);
      const resolved = safeParseDate(blk.resolvedAt || blk.updatedAt);
      if (created && resolved) {
        const hours = Math.max(0, differenceInHours(resolved, created));
        totalResolutionHours += hours;
      }
    }
  }

  const activeBlockers = totalBlockers - resolvedBlockers;
  const avgBlockerResolutionHours =
    resolvedBlockers > 0
      ? Math.round((totalResolutionHours / resolvedBlockers) * 10) / 10
      : 0;

  // Throughput: completed tasks in current dataset
  const throughputPerWeek = completedTasks;

  return {
    totalTasks,
    completedTasks,
    openTasks,
    overdueTasks,
    completionRate,
    onTimeRate,
    throughputPerWeek,
    avgCycleTimeDays,
    avgLeadTimeDays,
    totalBlockers,
    resolvedBlockers,
    activeBlockers,
    avgBlockerResolutionHours,
    standupSubmissionRate: 0,
    freshnessTimestamp: now.toISOString(),
    tasksByPriority,
    tasksByCategory,
    tasksByStatus,
    userWorkload: Array.from(userWorkloadMap.values()),
  };
}
