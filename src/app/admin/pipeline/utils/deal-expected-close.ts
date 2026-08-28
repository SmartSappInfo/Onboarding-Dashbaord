/**
 * @fileOverview Pure helpers for calculating a deal's expected close date
 * based on pipeline-level duration offsets (hours, days, or months).
 *
 * Side-effect-free and fully unit-testable without Firebase dependencies.
 */

import { addHours, addDays, addMonths } from 'date-fns';

export type CloseDateOffsetUnit = 'hours' | 'days' | 'months';

export interface PipelineOffsetConfig {
  defaultCloseDateOffsetValue?: number | null;
  defaultCloseDateOffsetUnit?: CloseDateOffsetUnit | null;
}

/**
 * Calculates the expected close date (delivery date) for a deal.
 *
 * Rules:
 * 1. If an explicitDate is provided and valid, it is returned as an ISO string.
 * 2. If no explicitDate is provided (or empty), and the pipeline has a valid
 *    defaultCloseDateOffsetValue (> 0) and defaultCloseDateOffsetUnit,
 *    the offset is added to baseDate (defaults to now) and returned as an ISO string.
 * 3. If no pipeline offset is configured, defaults to fallbackDays (standard 30 days from baseDate).
 * 4. If fallbackDays is explicitly null/0 and no pipeline offset exists, returns null.
 */
export function calculateExpectedCloseDate(
  pipeline?: PipelineOffsetConfig | null,
  explicitDate?: string | null,
  baseDate: Date = new Date(),
  fallbackDays: number | null = 30
): string | null {
  if (explicitDate && explicitDate.trim() !== '') {
    const parsed = new Date(explicitDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const base = new Date(baseDate);
  if (Number.isNaN(base.getTime())) return null;

  if (
    pipeline &&
    typeof pipeline.defaultCloseDateOffsetValue === 'number' &&
    pipeline.defaultCloseDateOffsetValue > 0 &&
    pipeline.defaultCloseDateOffsetUnit
  ) {
    let result: Date;
    if (pipeline.defaultCloseDateOffsetUnit === 'hours') {
      result = addHours(base, pipeline.defaultCloseDateOffsetValue);
    } else if (pipeline.defaultCloseDateOffsetUnit === 'days') {
      result = addDays(base, pipeline.defaultCloseDateOffsetValue);
    } else if (pipeline.defaultCloseDateOffsetUnit === 'months') {
      result = addMonths(base, pipeline.defaultCloseDateOffsetValue);
    } else if (typeof fallbackDays === 'number' && fallbackDays > 0) {
      result = addDays(base, fallbackDays);
    } else {
      return null;
    }

    return Number.isNaN(result.getTime()) ? null : result.toISOString();
  }

  if (typeof fallbackDays === 'number' && fallbackDays > 0) {
    const result = addDays(base, fallbackDays);
    return Number.isNaN(result.getTime()) ? null : result.toISOString();
  }

  return null;
}
