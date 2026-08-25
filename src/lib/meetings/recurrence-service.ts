/**
 * @fileoverview Pure Recurring Meeting Series & RFC 5545 Recurrence Engine.
 * Expands repeating dates within windowed booking horizons.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure date arithmetic.
 * - Always bounds generation by maxHorizonDays to prevent infinite loops.
 */

import type { RecurrenceFrequency } from './types/intelligence';

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  interval?: number; // Defaults to 1
  daysOfWeek?: number[]; // [0=Sun, 1=Mon, ..., 6=Sat]
  startDate: string; // YYYY-MM-DD
  untilDate?: string; // YYYY-MM-DD
  count?: number; // Max total instances
}

/**
 * Expands a recurring rule into concrete `YYYY-MM-DD` occurrence dates
 * bounded by either untilDate, count, or the maxHorizonDays safety limit.
 */
export function expandRecurringDates(
  config: RecurrenceConfig,
  maxHorizonDays = 60,
  referenceNow = new Date()
): string[] {
  const { frequency, interval = 1, daysOfWeek, startDate, untilDate, count } = config;
  const dates: string[] = [];

  const startObj = new Date(`${startDate}T00:00:00Z`);
  if (isNaN(startObj.getTime())) return [];

  const maxHorizonDate = new Date(referenceNow.getTime() + maxHorizonDays * 24 * 60 * 60 * 1000);
  const untilObj = untilDate ? new Date(`${untilDate}T23:59:59Z`) : maxHorizonDate;
  const effectiveEnd = untilObj < maxHorizonDate ? untilObj : maxHorizonDate;

  let current = new Date(startObj);
  const maxInstances = count && count > 0 ? count : 100;

  if (frequency === 'daily') {
    while (current <= effectiveEnd && dates.length < maxInstances) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + Math.max(1, interval));
    }
  } else if (frequency === 'weekly' || frequency === 'biweekly') {
    const stepWeeks = frequency === 'biweekly' ? 2 : Math.max(1, interval);
    const targetDays = daysOfWeek && daysOfWeek.length > 0 ? daysOfWeek : [startObj.getUTCDay()];

    // Generate across weeks
    let weekCursor = new Date(current);
    while (weekCursor <= effectiveEnd && dates.length < maxInstances) {
      for (const day of targetDays) {
        const candidate = new Date(weekCursor);
        const diff = day - candidate.getUTCDay();
        candidate.setUTCDate(candidate.getUTCDate() + diff);

        if (
          candidate >= startObj &&
          candidate <= effectiveEnd &&
          dates.length < maxInstances
        ) {
          const dateStr = candidate.toISOString().slice(0, 10);
          if (!dates.includes(dateStr)) {
            dates.push(dateStr);
          }
        }
      }
      weekCursor.setUTCDate(weekCursor.getUTCDate() + stepWeeks * 7);
    }
  } else if (frequency === 'monthly') {
    const stepMonths = Math.max(1, interval);
    const dayOfMonth = startObj.getUTCDate();

    while (current <= effectiveEnd && dates.length < maxInstances) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCMonth(current.getUTCMonth() + stepMonths);
      // Handle month overflow
      current.setUTCDate(dayOfMonth);
    }
  }

  return dates.sort();
}

/**
 * Generates an RFC 5545 compliant RRULE string.
 * Example: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE;COUNT=10"
 */
export function generateRruleString(config: RecurrenceConfig): string {
  const parts: string[] = [];

  const freqMap: Record<RecurrenceFrequency, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    biweekly: 'WEEKLY',
    monthly: 'MONTHLY',
  };

  parts.push(`FREQ=${freqMap[config.frequency]}`);

  const interval = config.frequency === 'biweekly' ? 2 : config.interval || 1;
  if (interval > 1) {
    parts.push(`INTERVAL=${interval}`);
  }

  if (config.daysOfWeek && config.daysOfWeek.length > 0) {
    const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const byDays = config.daysOfWeek.map(d => dayCodes[d]).filter(Boolean).join(',');
    if (byDays) {
      parts.push(`BYDAY=${byDays}`);
    }
  }

  if (config.count && config.count > 0) {
    parts.push(`COUNT=${config.count}`);
  } else if (config.untilDate) {
    const cleanDate = config.untilDate.replace(/-/g, '');
    parts.push(`UNTIL=${cleanDate}T235959Z`);
  }

  return parts.join(';');
}
