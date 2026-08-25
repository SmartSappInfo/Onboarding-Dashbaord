/**
 * @fileoverview Pure Calendar Service for Multi-Calendar Conflict Synchronization.
 * Merges internal and external (Google Calendar / Microsoft Outlook) busy intervals
 * and calculates conflict-free booking windows.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All comparisons are computed in epoch milliseconds (UTC timestamps) to eliminate timezone shift bugs.
 * - This service is 100% pure with zero side-effects for maximum testability.
 */

import type { AvailableSlot } from './types';
import type { ExternalBusyInterval } from './types/calendar';

export interface BusyInterval {
  start: string; // ISO 8601 UTC
  end: string;   // ISO 8601 UTC
  source?: string;
}

/**
 * Merges, sorts, and flattens multiple overlapping busy intervals into
 * a canonical list of non-overlapping busy intervals.
 */
export function mergeExternalBusyIntervals(
  internalBusy: Array<{ start: string; end: string }>,
  externalBusy: Array<ExternalBusyInterval | { start: string; end: string }>
): Array<{ start: string; end: string }> {
  const allIntervals = [...internalBusy, ...externalBusy]
    .map(interval => ({
      startMs: new Date(interval.start).getTime(),
      endMs: new Date(interval.end).getTime(),
    }))
    .filter(interval => !isNaN(interval.startMs) && !isNaN(interval.endMs) && interval.startMs < interval.endMs)
    .sort((a, b) => a.startMs - b.startMs);

  if (allIntervals.length === 0) {
    return [];
  }

  const merged: Array<{ startMs: number; endMs: number }> = [];
  let current = { ...allIntervals[0] };

  for (let i = 1; i < allIntervals.length; i++) {
    const next = allIntervals[i];

    if (next.startMs <= current.endMs) {
      // Overlapping or contiguous intervals: expand end time to max
      current.endMs = Math.max(current.endMs, next.endMs);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged.map(item => ({
    start: new Date(item.startMs).toISOString(),
    end: new Date(item.endMs).toISOString(),
  }));
}

/**
 * Checks whether a proposed time slot (with pre/post collision padding)
 * collides with any external busy interval.
 */
export function isSlotConflictingWithExternalBusy(
  slotStart: Date | string,
  slotEnd: Date | string,
  busyIntervals: Array<{ start: string; end: string }>,
  bufferBeforeMinutes = 0,
  bufferAfterMinutes = 0
): boolean {
  const slotStartMs = (typeof slotStart === 'string' ? new Date(slotStart) : slotStart).getTime();
  const slotEndMs = (typeof slotEnd === 'string' ? new Date(slotEnd) : slotEnd).getTime();

  const paddedStartMs = slotStartMs - bufferBeforeMinutes * 60000;
  const paddedEndMs = slotEndMs + bufferAfterMinutes * 60000;

  for (const busy of busyIntervals) {
    const busyStartMs = new Date(busy.start).getTime();
    const busyEndMs = new Date(busy.end).getTime();

    // Collision formula: Padded slot intersects busy if (PaddedStart < BusyEnd && PaddedEnd > BusyStart)
    if (paddedStartMs < busyEndMs && paddedEndMs > busyStartMs) {
      return true;
    }
  }

  return false;
}

/**
 * Filters out available slots that collide with external busy intervals.
 */
export function filterSlotsByExternalBusy(
  availableSlots: AvailableSlot[],
  busyIntervals: Array<{ start: string; end: string }>,
  bufferBeforeMinutes = 0,
  bufferAfterMinutes = 0
): AvailableSlot[] {
  if (!busyIntervals || busyIntervals.length === 0) {
    return availableSlots;
  }

  return availableSlots.filter(slot => {
    const hasCollision = isSlotConflictingWithExternalBusy(
      slot.start,
      slot.end,
      busyIntervals,
      bufferBeforeMinutes,
      bufferAfterMinutes
    );
    return !hasCollision;
  });
}
