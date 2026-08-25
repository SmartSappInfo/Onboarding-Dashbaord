/**
 * @fileoverview Pure Availability & Scheduling Engine for SmartSapp Meetings 2.0.
 * Handles slot candidate generation, date override substitution, minimum notice / horizon boundaries,
 * buffer offset padding, timezone conversion, conflict elimination, and atomic booking holds.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All slot interval computations must remain timezone-aware. Never assume visitor and host share timezones.
 * - Concurrency holds MUST use atomic transactions to prevent double-booking race conditions.
 * - This engine is designed as a standalone pure domain service with zero UI dependencies for maximum testability.
 */

import type {
  AvailabilityInterval,
  AvailabilityRule,
  AvailabilityOverride,
  AvailabilityProfile,
  EventType,
  AvailableSlot,
  BookingHold,
} from './types';

// ── Time Utility Helpers ──────────────────────────────────────────────────

/**
 * Converts "HH:mm" (24h) string to minutes from start of day.
 * Example: "09:30" -> 570
 */
export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Converts minutes from start of day to "HH:mm" (24h) string.
 * Example: 570 -> "09:30"
 */
export function minutesToTimeString(minutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.floor(minutes)));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Generates candidate time intervals for a single day based on working intervals.
 */
export function generateDailyCandidateSlots(
  intervals: AvailabilityInterval[],
  durationMinutes: number,
  slotIntervalMinutes: number
): { startMinutes: number; endMinutes: number }[] {
  const slots: { startMinutes: number; endMinutes: number }[] = [];
  const step = Math.max(5, slotIntervalMinutes || durationMinutes);

  for (const interval of intervals) {
    const startMins = parseTimeToMinutes(interval.start);
    const endMins = parseTimeToMinutes(interval.end);

    let currentStart = startMins;
    while (currentStart + durationMinutes <= endMins) {
      slots.push({
        startMinutes: currentStart,
        endMinutes: currentStart + durationMinutes,
      });
      currentStart += step;
    }
  }

  return slots;
}

/**
 * Evaluates date-specific overrides against the day's weekly default rule.
 */
export function resolveDaySchedule(
  dateStr: string,
  weeklyRule: AvailabilityRule | undefined,
  overrides: AvailabilityOverride[]
): { isAvailable: boolean; intervals: AvailabilityInterval[] } {
  // Find override for exact YYYY-MM-DD
  const override = overrides.find(o => o.date === dateStr);

  if (override) {
    if (override.type === 'unavailable') {
      return { isAvailable: false, intervals: [] };
    }
    return {
      isAvailable: true,
      intervals: override.intervals || [],
    };
  }

  if (!weeklyRule || !weeklyRule.isAvailable) {
    return { isAvailable: false, intervals: [] };
  }

  return {
    isAvailable: true,
    intervals: weeklyRule.intervals || [],
  };
}

/**
 * Builds an ISO UTC Date string from a host's local date (YYYY-MM-DD), local time (HH:mm),
 * and the host's IANA timezone.
 */
export function createUtcFromHostLocalTime(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const [hourStr, minStr] = timeStr.split(':');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  // Use Intl.DateTimeFormat to compute exact UTC offset for that date in that timezone
  const targetUtcGuess = new Date(Date.UTC(year, month, day, hour, min, 0));
  
  // Format targetUtcGuess in the target timezone to find the drift
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(targetUtcGuess);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const hostYear = parseInt(partMap.year || '0', 10);
  const hostMonth = parseInt(partMap.month || '1', 10) - 1;
  const hostDay = parseInt(partMap.day || '1', 10);
  const hostHour = parseInt(partMap.hour === '24' ? '00' : partMap.hour || '0', 10);
  const hostMin = parseInt(partMap.minute || '0', 10);

  const hostTimeAsUtc = Date.UTC(hostYear, hostMonth, hostDay, hostHour, hostMin, 0);
  const offsetDiff = hostTimeAsUtc - targetUtcGuess.getTime();

  return new Date(targetUtcGuess.getTime() - offsetDiff);
}

/**
 * Formats an ISO Date string into a visitor's localized date string (YYYY-MM-DD)
 * and localized 24h/12h time string (HH:mm).
 */
export function formatInTimezone(
  date: Date,
  timeZone: string
): { dateStr: string; timeStr: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const hour = partMap.hour === '24' ? '00' : (partMap.hour || '00');
  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const timeStr = `${hour}:${partMap.minute}`;

  return { dateStr, timeStr };
}

/**
 * Checks whether a candidate slot overlaps with any blocked interval,
 * taking into account buffer before and buffer after.
 */
export function isSlotConflicting(
  slotStart: Date,
  slotEnd: Date,
  blockedIntervals: { start: Date; end: Date }[],
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number
): boolean {
  const slotStartWithBuffer = new Date(slotStart.getTime() - bufferBeforeMinutes * 60 * 1000);
  const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferAfterMinutes * 60 * 1000);

  for (const blocked of blockedIntervals) {
    // Overlap condition: max(startA, startB) < min(endA, endB)
    const overlapStart = Math.max(slotStartWithBuffer.getTime(), blocked.start.getTime());
    const overlapEnd = Math.min(slotEndWithBuffer.getTime(), blocked.end.getTime());

    if (overlapStart < overlapEnd) {
      return true;
    }
  }

  return false;
}

// ── High-Level Slot Discovery Service ─────────────────────────────────────

export interface GetAvailableSlotsParams {
  eventType: EventType;
  availabilityProfile: AvailabilityProfile;
  /** YYYY-MM-DD start date in visitor's perspective */
  startDate: string;
  /** YYYY-MM-DD end date in visitor's perspective */
  endDate: string;
  /** IANA timezone requested by visitor, e.g. 'Europe/London' */
  visitorTimezone: string;
  /** Confirmed bookings for the host/event within the window */
  existingBookings?: Array<{ startAt: string; endAt: string }>;
  /** Active holds that have not yet expired */
  activeHolds?: Array<{ startAt: string; endAt: string; expiresAt: string }>;
  /** External calendar busy intervals (Google Calendar / Microsoft Outlook) */
  externalBusyIntervals?: Array<{ start: string; end: string }>;
  /** Current reference time (defaults to new Date()) */
  now?: Date;
}

/**
 * Computes all bookable slots for a date range, localized into the visitor's requested timezone.
 * Returns a map of `YYYY-MM-DD` -> `AvailableSlot[]`.
 */
export function getAvailableSlotsForRange(
  params: GetAvailableSlotsParams
): Record<string, AvailableSlot[]> {
  const {
    eventType,
    availabilityProfile,
    startDate,
    endDate,
    visitorTimezone,
    existingBookings = [],
    activeHolds = [],
    externalBusyIntervals = [],
    now = new Date(),
  } = params;

  const hostTimezone = availabilityProfile.timezone || 'UTC';
  const duration = eventType.durationMinutes || 30;
  const slotInterval = eventType.slotIntervalMinutes || duration;
  const bufferBefore = eventType.bufferBeforeMinutes ?? availabilityProfile.defaultBufferBeforeMinutes ?? 0;
  const bufferAfter = eventType.bufferAfterMinutes ?? availabilityProfile.defaultBufferAfterMinutes ?? 0;
  const minimumNoticeMinutes = eventType.minimumNoticeMinutes ?? availabilityProfile.minimumNoticeMinutes ?? 60;
  const maxHorizonDays = eventType.maximumBookingHorizonDays ?? availabilityProfile.maximumBookingHorizonDays ?? 30;

  // Earliest allowed booking time
  const earliestAllowedUtc = new Date(now.getTime() + minimumNoticeMinutes * 60 * 1000);
  // Latest allowed booking time
  const latestAllowedUtc = new Date(now.getTime() + maxHorizonDays * 24 * 60 * 60 * 1000);

  // Build list of all blocked intervals (confirmed bookings + valid active holds + external busy intervals)
  const blockedIntervals: { start: Date; end: Date }[] = [];

  for (const b of existingBookings) {
    if (b.startAt && b.endAt) {
      blockedIntervals.push({
        start: new Date(b.startAt),
        end: new Date(b.endAt),
      });
    }
  }

  for (const h of activeHolds) {
    if (h.startAt && h.endAt && h.expiresAt) {
      const expiresAt = new Date(h.expiresAt);
      if (expiresAt.getTime() > now.getTime()) {
        blockedIntervals.push({
          start: new Date(h.startAt),
          end: new Date(h.endAt),
        });
      }
    }
  }

  for (const ext of externalBusyIntervals) {
    if (ext.start && ext.end) {
      blockedIntervals.push({
        start: new Date(ext.start),
        end: new Date(ext.end),
      });
    }
  }

  // Parse start and end date range (extended by 1 day on both sides to cover timezone shifts)
  const startObj = new Date(`${startDate}T00:00:00Z`);
  const endObj = new Date(`${endDate}T23:59:59Z`);

  // Pad by 1 day on either side for safe timezone boundary calculations
  const searchStart = new Date(startObj.getTime() - 24 * 60 * 60 * 1000);
  const searchEnd = new Date(endObj.getTime() + 24 * 60 * 60 * 1000);

  const resultMap: Record<string, AvailableSlot[]> = {};

  // Iterate day by day in host timezone
  const currentCursor = new Date(searchStart);

  while (currentCursor <= searchEnd) {
    const hostDateParts = formatInTimezone(currentCursor, hostTimezone);
    const hostDateStr = hostDateParts.dateStr;

    // Day of week in host timezone: 0 = Sun, 1 = Mon, ..., 6 = Sat
    const dayOfWeek = new Date(`${hostDateStr}T12:00:00Z`).getUTCDay();
    const weeklyRule = availabilityProfile.weeklyRules.find(r => r.dayOfWeek === dayOfWeek);

    const daySchedule = resolveDaySchedule(
      hostDateStr,
      weeklyRule,
      availabilityProfile.overrides || []
    );

    if (daySchedule.isAvailable && daySchedule.intervals.length > 0) {
      const candidateSlots = generateDailyCandidateSlots(
        daySchedule.intervals,
        duration,
        slotInterval
      );

      for (const slot of candidateSlots) {
        const startStr = minutesToTimeString(slot.startMinutes);
        const endStr = minutesToTimeString(slot.endMinutes);

        const slotStartUtc = createUtcFromHostLocalTime(hostDateStr, startStr, hostTimezone);
        const slotEndUtc = createUtcFromHostLocalTime(hostDateStr, endStr, hostTimezone);

        // Check Notice & Horizon bounds
        if (slotStartUtc < earliestAllowedUtc || slotStartUtc > latestAllowedUtc) {
          continue;
        }

        // Check Conflicts & Buffers
        if (isSlotConflicting(slotStartUtc, slotEndUtc, blockedIntervals, bufferBefore, bufferAfter)) {
          continue;
        }

        // Format slot in visitor's requested timezone
        const visitorStart = formatInTimezone(slotStartUtc, visitorTimezone);
        const visitorEnd = formatInTimezone(slotEndUtc, visitorTimezone);

        // Only include if within requested visitor date window [startDate, endDate]
        if (visitorStart.dateStr >= startDate && visitorStart.dateStr <= endDate) {
          if (!resultMap[visitorStart.dateStr]) {
            resultMap[visitorStart.dateStr] = [];
          }

          resultMap[visitorStart.dateStr].push({
            start: slotStartUtc.toISOString(),
            end: slotEndUtc.toISOString(),
            formattedTime: visitorStart.timeStr,
            formattedEndTime: visitorEnd.timeStr,
            available: true,
          });
        }
      }
    }

    // Step forward 1 day
    currentCursor.setTime(currentCursor.getTime() + 24 * 60 * 60 * 1000);
  }

  // Sort slots chronologically within each day
  for (const dateKey of Object.keys(resultMap)) {
    resultMap[dateKey].sort((a, b) => a.start.localeCompare(b.start));
  }

  return resultMap;
}
