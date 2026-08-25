/**
 * @fileoverview Pure Bulk Meeting Operations & Recurring Series Exception Engine.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Handles bulk timestamp shifting deterministically across timezones.
 */

import type {
  SeriesInstanceOverride,
} from './types/bulk-operations';

/**
 * Calculates new start and end timestamps for a batch of meetings given a minute delta.
 */
export function calculateBulkRescheduleTimes(
  meetings: Array<{ id: string; meetingTime: string; endAt?: string }>,
  minuteDelta: number
): Array<{ id: string; newMeetingTime: string; newEndAt?: string }> {
  const deltaMs = minuteDelta * 60000;

  return meetings.map(m => {
    const oldStartMs = new Date(m.meetingTime).getTime();
    const newStart = new Date(oldStartMs + deltaMs).toISOString();

    let newEnd: string | undefined;
    if (m.endAt) {
      const oldEndMs = new Date(m.endAt).getTime();
      newEnd = new Date(oldEndMs + deltaMs).toISOString();
    }

    return {
      id: m.id,
      newMeetingTime: newStart,
      newEndAt: newEnd,
    };
  });
}

/**
 * Applies single instance exception override to a recurring series list without breaking the series.
 */
export function applySeriesInstanceOverride(
  seriesEvents: Array<{ seriesId: string; startAt: string; isCancelled?: boolean }>,
  override: SeriesInstanceOverride
): Array<{ seriesId: string; startAt: string; isCancelled?: boolean }> {
  return seriesEvents.map(event => {
    if (event.seriesId === override.seriesId && event.startAt === override.originalStart) {
      if (override.isCancelled) {
        return { ...event, isCancelled: true };
      }
      if (override.newStartAt) {
        return { ...event, startAt: override.newStartAt, isCancelled: false };
      }
    }
    return event;
  });
}
