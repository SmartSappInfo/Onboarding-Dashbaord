/**
 * @fileOverview Template variable utility functions (synchronous, no server actions)
 * 
 * This file contains pure utility functions for working with template variables
 * that don't require database access or async operations.
 */

import type { TemplateVariable, VariableContext } from './types';
import { STATIC_VARIABLES } from './template-variable-registry-data';

/**
 * Returns static variables for the given context.
 * For any non-common context, common variables are included as well.
 * For 'common', only common variables are returned.
 * 
 * @param context - The variable context to get variables for
 * @returns Array of template variables for the context
 * 
 * @example
 * ```typescript
 * const meetingVars = getVariablesForContext('meeting');
 * // Returns: common variables + meeting-specific variables
 * 
 * const commonVars = getVariablesForContext('common');
 * // Returns: only common variables
 * ```
 */
export function getVariablesForContext(context: VariableContext): TemplateVariable[] {
  if (context === 'common') {
    return STATIC_VARIABLES.filter((v) => v.context === 'common');
  }
  return STATIC_VARIABLES.filter((v) => v.context === 'common' || v.context === context);
}

/**
 * Computes the ISO scheduledAt timestamp for a reminder.
 * For TIME_UP (offset = 0) the scheduledAt equals the event time.
 * 
 * @param eventTimeIso - ISO 8601 timestamp of the event
 * @param offsetMinutes - Minutes before the event to schedule the reminder
 * @returns ISO 8601 timestamp for when the reminder should be sent
 * 
 * @example
 * ```typescript
 * // Schedule 15 minutes before 10:00 AM
 * computeScheduledAt('2025-06-20T10:00:00.000Z', 15);
 * // Returns: '2025-06-20T09:45:00.000Z'
 * 
 * // Schedule at event time (time's up reminder)
 * computeScheduledAt('2025-06-20T10:00:00.000Z', 0);
 * // Returns: '2025-06-20T10:00:00.000Z'
 * ```
 */
export function computeScheduledAt(eventTimeIso: string, offsetMinutes: number): string {
  const eventMs = new Date(eventTimeIso).getTime();
  const scheduledMs = eventMs - offsetMinutes * 60 * 1000;
  return new Date(scheduledMs).toISOString();
}
