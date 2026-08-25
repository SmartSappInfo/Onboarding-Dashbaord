/**
 * @fileoverview Pure Calendar View & Collision Calculation Engine.
 * Calculates date grids for day, 3-day, week, month, and agenda modes,
 * and detects scheduling conflicts across internal and external calendar events.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side effects.
 * - All date computations are reference-safe.
 */

import type {
  CalendarGridEvent,
  CalendarTimeSlot,
  CalendarViewMode,
} from './types/calendar-view';

/**
 * Builds standard 30-minute interval slots between startHour and endHour.
 */
export function buildHourSlots(startHour = 8, endHour = 20): CalendarTimeSlot[] {
  const slots: CalendarTimeSlot[] = [];
  for (let h = startHour; h <= endHour; h++) {
    slots.push({
      timeStr: `${h.toString().padStart(2, '0')}:00`,
      hour: h,
      minute: 0,
    });
    if (h < endHour) {
      slots.push({
        timeStr: `${h.toString().padStart(2, '0')}:30`,
        hour: h,
        minute: 30,
      });
    }
  }
  return slots;
}

/**
 * Returns the array of Date instances corresponding to the active calendar view mode.
 */
export function getCalendarGridDays(anchorDate: Date, mode: CalendarViewMode): Date[] {
  const base = new Date(anchorDate);
  base.setHours(0, 0, 0, 0);

  if (mode === 'day') {
    return [new Date(base)];
  }

  if (mode === '3day') {
    return [
      new Date(base),
      new Date(base.getTime() + 86400000),
      new Date(base.getTime() + 172800000),
    ];
  }

  if (mode === 'week' || mode === 'agenda') {
    // Start from Sunday of current week
    const day = base.getDay(); // 0 is Sunday
    const sunday = new Date(base.getTime() - day * 86400000);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(sunday.getTime() + i * 86400000));
    }
    return days;
  }

  if (mode === 'month') {
    // Return all days in the anchor's month
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Date[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d, 0, 0, 0, 0));
    }
    return days;
  }

  return [new Date(base)];
}

/**
 * Detects if a proposed meeting slot collides with any existing grid event.
 */
export function detectGridCollision(
  proposedStart: Date,
  proposedEnd: Date,
  existingEvents: CalendarGridEvent[],
  excludeEventId?: string
): CalendarGridEvent | null {
  const pStartMs = proposedStart.getTime();
  const pEndMs = proposedEnd.getTime();

  for (const evt of existingEvents) {
    if (excludeEventId && evt.id === excludeEventId) continue;
    if (evt.status === 'cancelled') continue;

    const eStartMs = new Date(evt.startAt).getTime();
    const eEndMs = new Date(evt.endAt).getTime();

    // Standard interval overlap test: (StartA < EndB) and (EndA > StartB)
    if (pStartMs < eEndMs && pEndMs > eStartMs) {
      return evt;
    }
  }

  return null;
}

/**
 * Calculates percentage top and height for rendering a time block inside a daily grid.
 */
export function calculateEventGridPosition(
  eventStart: Date,
  eventEnd: Date,
  dayStartHour = 8,
  dayEndHour = 20
): { topPercent: number; heightPercent: number } {
  const totalDayMinutes = (dayEndHour - dayStartHour) * 60;
  if (totalDayMinutes <= 0) return { topPercent: 0, heightPercent: 10 };

  const startMinutes = (eventStart.getHours() - dayStartHour) * 60 + eventStart.getMinutes();
  const durationMinutes = Math.max(15, (eventEnd.getTime() - eventStart.getTime()) / 60000);

  const topPercent = Math.max(0, Math.min(100, (startMinutes / totalDayMinutes) * 100));
  const heightPercent = Math.max(2, Math.min(100 - topPercent, (durationMinutes / totalDayMinutes) * 100));

  return { topPercent, heightPercent };
}
