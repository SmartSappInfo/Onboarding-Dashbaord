/**
 * @fileOverview Safe Date Parsing & Formatting Utility
 *
 * ARCHITECTURAL POINTER (Rule 10 - Date Parsing Single Source of Truth):
 * Firestore documents across client and server environments may serialize dates as:
 * 1. ISO 8601 strings ('2026-09-14T03:00:00.000Z')
 * 2. Short date strings ('2026-09-14')
 * 3. Epoch timestamps in milliseconds (1726282000000) or seconds (1726282000)
 * 4. Client Firestore Timestamp instances ({ toDate(): Date })
 * 5. Admin SDK / JSON-serialized Firestore Timestamps ({ seconds: number, nanoseconds: number } or { _seconds: number, _nanoseconds: number })
 * 6. Native JavaScript Date instances
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Calling 'new Date(val)' on a Firestore Timestamp object returns 'Invalid Date' (NaN).
 * - Calling '.toISOString()' or date-fns 'format()' on 'Invalid Date' throws 'RangeError: Invalid time value',
 *   which crashes React client renders with an unhandled exception.
 * - ALWAYS route date parsing through 'parseSafeDate()' before calling date-fns or native Date methods.
 * - Strictly typed (zero 'any' or 'any[]').
 */

import { format, formatDistanceToNow } from 'date-fns';

/**
 * Safely parses an unknown date value into a valid JavaScript Date, or returns null if unparseable.
 * Never throws RangeError or TypeError.
 */
export function parseSafeDate(val: unknown): Date | null {
  if (val === null || val === undefined) return null;

  // 1. Native Date instance
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }

  // 2. Firestore Timestamp instance with .toDate() method
  if (typeof val === 'object' && val !== null && 'toDate' in val) {
    const maybeTimestamp = val as { toDate?: unknown };
    if (typeof maybeTimestamp.toDate === 'function') {
      try {
        const d = maybeTimestamp.toDate();
        if (d instanceof Date && !Number.isNaN(d.getTime())) {
          return d;
        }
      } catch {
        // Fall through to other checks
      }
    }
  }

  // 3. Serialized Firestore Timestamp object ({ seconds, nanoseconds } or { _seconds, _nanoseconds })
  if (typeof val === 'object' && val !== null) {
    const raw = val as { seconds?: unknown; _seconds?: unknown };
    const sec = typeof raw.seconds === 'number'
      ? raw.seconds
      : typeof raw._seconds === 'number'
        ? raw._seconds
        : null;

    if (sec !== null && Number.isFinite(sec)) {
      const d = new Date(sec * 1000);
      if (!Number.isNaN(d.getTime())) {
        return d;
      }
    }
  }

  // 4. Numeric timestamp (milliseconds or seconds)
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return null;
    // Values less than 100,000,000,000 are interpreted as seconds (e.g. 1726282000 -> Sep 2026)
    const ms = val < 100_000_000_000 ? val * 1000 : val;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // 5. String parsing
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed.toLowerCase() === 'invalid date' || trimmed.toLowerCase() === 'nan') {
      return null;
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Safely formats a date value using date-fns 'format', returning a fallback if invalid.
 * Never throws RangeError.
 */
export function formatSafeDate(
  val: unknown,
  formatStr: string,
  fallback: string = ''
): string {
  const parsed = parseSafeDate(val);
  if (!parsed) return fallback;
  try {
    return format(parsed, formatStr);
  } catch {
    return fallback;
  }
}

/**
 * Safely formats a relative distance string (e.g. '3 days ago') using date-fns 'formatDistanceToNow',
 * returning a fallback if invalid. Never throws RangeError.
 */
export function formatSafeRelativeTime(
  val: unknown,
  fallback: string = 'recently',
  options?: { addSuffix?: boolean }
): string {
  const parsed = parseSafeDate(val);
  if (!parsed) return fallback;
  try {
    return formatDistanceToNow(parsed, { addSuffix: options?.addSuffix ?? true });
  } catch {
    return fallback;
  }
}

/**
 * Safely formats a localized date string using 'toLocaleDateString', returning a fallback if invalid.
 * Never throws RangeError.
 */
export function formatSafeLocaleDate(
  val: unknown,
  fallback: string = 'TBD',
  locale: string = 'en-US',
  options?: Intl.DateTimeFormatOptions
): string {
  const parsed = parseSafeDate(val);
  if (!parsed) return fallback;
  try {
    return parsed.toLocaleDateString(locale, options);
  } catch {
    return fallback;
  }
}
