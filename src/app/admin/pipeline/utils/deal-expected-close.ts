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
 * Calculates the expected close date for a deal.
 *
 * Rules:
 * 1. If an explicitDate is provided and valid, it is returned as an ISO string.
 * 2. If no explicitDate is provided (or empty), and the pipeline has a valid
 *    defaultCloseDateOffsetValue (> 0) and defaultCloseDateOffsetUnit,
 *    the offset is added to baseDate (defaults to now) and returned as an ISO string.
 * 3. Otherwise, returns null.
 */
export function calculateExpectedCloseDate(
  pipeline?: PipelineOffsetConfig | null,
  explicitDate?: string | null,
  baseDate: Date = new Date()
): string | null {
  if (explicitDate && explicitDate.trim() !== '') {
    const parsed = new Date(explicitDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (!pipeline) return null;
  const { defaultCloseDateOffsetValue, defaultCloseDateOffsetUnit } = pipeline;

  if (
    typeof defaultCloseDateOffsetValue !== 'number' ||
    Number.isNaN(defaultCloseDateOffsetValue) ||
    defaultCloseDateOffsetValue <= 0 ||
    !defaultCloseDateOffsetUnit
  ) {
    return null;
  }

  const base = new Date(baseDate);
  if (Number.isNaN(base.getTime())) return null;

  let result: Date;
  if (defaultCloseDateOffsetUnit === 'hours') {
    result = addHours(base, defaultCloseDateOffsetValue);
  } else if (defaultCloseDateOffsetUnit === 'days') {
    result = addDays(base, defaultCloseDateOffsetValue);
  } else if (defaultCloseDateOffsetUnit === 'months') {
    result = addMonths(base, defaultCloseDateOffsetValue);
  } else {
    return null;
  }

  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}
