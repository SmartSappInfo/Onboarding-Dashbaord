/**
 * @fileOverview Forecast-date urgency computation for deals.
 *
 * Pure, side-effect-free helpers so they can be unit-tested without Firebase.
 * Drives the colour-coded countdown shown on deal cards, the list view, and
 * the deal detail page.
 */

import { differenceInCalendarDays } from 'date-fns';

export type UrgencyLevel = 'overdue' | 'today' | 'soon' | 'ok' | 'none';

export interface ForecastUrgency {
  /** Human label, e.g. "3d overdue", "Due today", "5d left", "30d". */
  label: string;
  level: UrgencyLevel;
  /** Tailwind text colour class. */
  colorClass: string;
  /** Numeric priority for sorting (lower = more urgent). */
  sortWeight: number;
}

/**
 * Classifies a deal's expected close date relative to today.
 * Uses calendar-day difference (not hour count) so timezone offsets don't
 * flip a deal between "today" and "overdue".
 */
export function getForecastUrgency(dateStr: string | null | undefined): ForecastUrgency {
  if (!dateStr) {
    return { label: 'No date', level: 'none', colorClass: 'text-muted-foreground', sortWeight: 9999 };
  }

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    return { label: 'No date', level: 'none', colorClass: 'text-muted-foreground', sortWeight: 9999 };
  }

  const diff = differenceInCalendarDays(parsed, new Date());

  if (diff < 0) {
    return {
      label: `${Math.abs(diff)}d overdue`,
      level: 'overdue',
      colorClass: 'text-destructive',
      sortWeight: diff, // most negative = most overdue = most urgent
    };
  }
  if (diff === 0) {
    return { label: 'Due today', level: 'today', colorClass: 'text-amber-500', sortWeight: 0 };
  }
  if (diff <= 7) {
    return { label: `${diff}d left`, level: 'soon', colorClass: 'text-amber-500', sortWeight: diff };
  }
  return { label: `${diff}d`, level: 'ok', colorClass: 'text-emerald-600', sortWeight: diff };
}
