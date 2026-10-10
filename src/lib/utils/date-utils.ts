/**
 * @fileOverview Shared Defensive Date Utilities
 *
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Centralizes safe parsing, validation, and formatting for all task, calendar, and activity dates.
 * - Prevents unhandled `RangeError: Invalid time value` crashes caused by null, undefined, or malformed date inputs.
 * - Strictly typed: Zero `any` or `any[]`.
 * - Complies with agents_mcp_rules.md: Rule 1 (Best Practices), Rule 4 (Strict Typing), Rule 47 (Never Trust External Data).
 */

import { format, isValid } from 'date-fns';

/**
 * Checks whether an unknown value is a valid Date instance.
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime()) && isValid(value);
}

/**
 * Safely parses any unknown date representation into a valid Date object or null.
 * Never throws RangeError.
 */
export function safeParseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (isValidDate(value)) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return isValidDate(parsed) ? parsed : null;
  }

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return null;
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Formats a task due date with a specified pattern, returning a safe fallback on error or absence.
 */
export function formatTaskDueDate(
  value: unknown,
  pattern = 'MMM d',
  fallback = 'No due date'
): string {
  const date = safeParseDate(value);
  if (!date) return fallback;
  try {
    return format(date, pattern);
  } catch {
    return fallback;
  }
}

/**
 * Formats any general task date (createdAt, completedAt, etc.) with a safe fallback.
 */
export function formatTaskDate(
  value: unknown,
  pattern = 'MMM d, yyyy',
  fallback = '—'
): string {
  const date = safeParseDate(value);
  if (!date) return fallback;
  try {
    return format(date, pattern);
  } catch {
    return fallback;
  }
}

/**
 * Formats time only (e.g. "2:30 PM" or "10:00 AM"), returning a fallback if invalid or absent.
 * Strictly excludes any year, month, or day.
 */
export function formatTaskTime(
  value: unknown,
  pattern = 'h:mm a',
  fallback = ''
): string {
  const date = safeParseDate(value);
  if (!date) return fallback;
  try {
    return format(date, pattern);
  } catch {
    return fallback;
  }
}

