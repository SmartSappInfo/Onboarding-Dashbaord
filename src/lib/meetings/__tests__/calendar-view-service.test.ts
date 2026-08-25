import { describe, it, expect } from 'vitest';
import {
  buildHourSlots,
  getCalendarGridDays,
  detectGridCollision,
  calculateEventGridPosition,
} from '../calendar-view-service';
import type { CalendarGridEvent } from '../types/calendar-view';

describe('Calendar View & Grid Engine', () => {
  it('generates 30-minute interval hour slots accurately', () => {
    const slots = buildHourSlots(9, 11);
    // 09:00, 09:30, 10:00, 10:30, 11:00 -> 5 slots
    expect(slots).toHaveLength(5);
    expect(slots[0].timeStr).toBe('09:00');
    expect(slots[1].timeStr).toBe('09:30');
    expect(slots[4].timeStr).toBe('11:00');
  });

  it('generates appropriate day arrays for day, 3-day, and week modes', () => {
    const anchor = new Date('2026-08-25T12:00:00Z'); // Tuesday

    const dayGrid = getCalendarGridDays(anchor, 'day');
    expect(dayGrid).toHaveLength(1);

    const threeDayGrid = getCalendarGridDays(anchor, '3day');
    expect(threeDayGrid).toHaveLength(3);

    const weekGrid = getCalendarGridDays(anchor, 'week');
    expect(weekGrid).toHaveLength(7);
  });

  it('detects collisions against existing events and external busy blocks', () => {
    const existing: CalendarGridEvent[] = [
      {
        id: 'evt_1',
        sourceId: 'm1',
        sourceType: 'meeting',
        title: 'Team Sync',
        startAt: '2026-08-25T10:00:00Z',
        endAt: '2026-08-25T11:00:00Z',
        hostUserId: 'host_1',
      },
      {
        id: 'evt_2',
        sourceId: 'g_busy_1',
        sourceType: 'google_busy',
        title: 'Busy (Google)',
        startAt: '2026-08-25T14:00:00Z',
        endAt: '2026-08-25T15:30:00Z',
        hostUserId: 'host_1',
        isExternalCollision: true,
      },
    ];

    // Collides with evt_1 (10:30 - 11:30)
    const collision1 = detectGridCollision(
      new Date('2026-08-25T10:30:00Z'),
      new Date('2026-08-25T11:30:00Z'),
      existing
    );
    expect(collision1?.id).toBe('evt_1');

    // Free slot (11:30 - 12:30)
    const collisionFree = detectGridCollision(
      new Date('2026-08-25T11:30:00Z'),
      new Date('2026-08-25T12:30:00Z'),
      existing
    );
    expect(collisionFree).toBeNull();

    // Collides with Google busy block (14:30 - 15:00)
    const collision2 = detectGridCollision(
      new Date('2026-08-25T14:30:00Z'),
      new Date('2026-08-25T15:00:00Z'),
      existing
    );
    expect(collision2?.id).toBe('evt_2');
  });

  it('calculates grid percentage offsets and heights correctly', () => {
    // 09:00 to 10:00 in an 8:00 - 20:00 day (12 hours = 720 mins)
    // 09:00 is 60 mins from 8:00 -> (60/720)*100 = 8.33%
    // 60 mins duration -> (60/720)*100 = 8.33%
    const pos = calculateEventGridPosition(
      new Date('2026-08-25T09:00:00Z'),
      new Date('2026-08-25T10:00:00Z'),
      8,
      20
    );

    expect(Math.round(pos.topPercent)).toBe(8);
    expect(Math.round(pos.heightPercent)).toBe(8);
  });
});
