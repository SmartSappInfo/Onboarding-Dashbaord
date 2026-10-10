/**
 * @fileOverview Intelligent Task Base Summary Generator & Error Feedback
 *
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Implements intelligent prefill for task details/description during task creation:
 *   * Summarizes task title/name, target institution/entity, and scheduled time.
 *   * Formats time strictly as TIME ONLY (e.g. "2:30 PM", never calendar date).
 * - Implements user-facing error message sanitization:
 *   * Translates cryptic Zod schema errors (e.g. taskId too small) into clear, actionable messages.
 * - Strictly typed: Zero `any` or `any[]` (Rule 4).
 */

import { formatTaskTime } from '@/lib/utils/date-utils';

export interface TaskBaseSummaryParams {
  title?: string | null;
  entityName?: string | null;
  time?: Date | string | number | null;
  timeStr?: string | null;
}

/**
 * Constructs an intelligent base text summary for task creation.
 * Examples:
 * - "Phone Call for Lincoln High at 2:30 PM"
 * - "Follow-up Meeting for Lincoln High"
 * - "Team Sync at 10:00 AM"
 * - "Task for Lincoln High at 2:30 PM"
 */
export function generateTaskBaseSummary({
  title,
  entityName,
  time,
  timeStr,
}: TaskBaseSummaryParams): string {
  const cleanTitle = (title || '').trim();
  const cleanEntity = (entityName || '').trim();
  const resolvedTimeStr = (timeStr || (time ? formatTaskTime(time) : '')).trim();

  if (!cleanTitle && !cleanEntity && !resolvedTimeStr) {
    return '';
  }

  const taskLabel = cleanTitle || 'Task';

  if (cleanEntity && resolvedTimeStr) {
    return `${taskLabel} for ${cleanEntity} at ${resolvedTimeStr}`;
  }
  if (cleanEntity) {
    return `${taskLabel} for ${cleanEntity}`;
  }
  if (resolvedTimeStr) {
    return `${taskLabel} at ${resolvedTimeStr}`;
  }
  return taskLabel;
}

/**
 * Translates low-level validation or schema errors into user-friendly feedback.
 */
export function sanitizeTaskErrorMessage(rawMessage?: string | null): string {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'Unable to save task. Please verify your details and try again.';
  }

  // Handle taskId Zod schema error
  if (rawMessage.includes('taskId') && (rawMessage.includes('Too small') || rawMessage.includes('expected string'))) {
    return 'Unable to update task because the task reference is invalid. Please try creating a new task.';
  }

  // Handle generic Zod schema error prefixes
  if (rawMessage.startsWith('Invalid input:')) {
    const cleaned = rawMessage.replace(/^Invalid input:\s*/, '');
    return `Please review task details: ${cleaned}`;
  }

  return rawMessage;
}
