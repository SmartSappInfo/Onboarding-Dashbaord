import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  minutesToTimeString,
  generateDailyCandidateSlots,
  resolveDaySchedule,
  isSlotConflicting,
  getAvailableSlotsForRange,
} from '../scheduling-engine';
import type {
  AvailabilityProfile,
  EventType,
} from '../types';

describe('Scheduling Engine - Pure Utilities', () => {
  it('parses time strings to minutes accurately', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('09:30')).toBe(570);
    expect(parseTimeToMinutes('17:45')).toBe(1065);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });

  it('converts minutes to formatted 24h strings', () => {
    expect(minutesToTimeString(0)).toBe('00:00');
    expect(minutesToTimeString(570)).toBe('09:30');
    expect(minutesToTimeString(1065)).toBe('17:45');
    expect(minutesToTimeString(1439)).toBe('23:59');
  });

  it('generates candidate slots for standard and split interval working hours', () => {
    // Single 9:00 - 12:00 window, 30 min duration, 30 min step
    const slots1 = generateDailyCandidateSlots(
      [{ start: '09:00', end: '12:00' }],
      30,
      30
    );
    expect(slots1).toHaveLength(6);
    expect(slots1[0]).toEqual({ startMinutes: 540, endMinutes: 570 }); // 09:00 - 09:30
    expect(slots1[5]).toEqual({ startMinutes: 690, endMinutes: 720 }); // 11:30 - 12:00

    // Split shift: 09:00 - 12:00 and 13:00 - 15:00, 45 min duration, 15 min step
    const slots2 = generateDailyCandidateSlots(
      [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '15:00' },
      ],
      45,
      15
    );
    // 09:00 to 12:00 (180 mins) -> 09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30, 10:45, 11:00, 11:15 (10 slots)
    // 13:00 to 15:00 (120 mins) -> 13:00, 13:15, 13:30, 13:45, 14:00, 14:15 (6 slots)
    expect(slots2).toHaveLength(16);
  });

  it('resolves date overrides correctly over regular weekly rules', () => {
    const weeklyMonday = {
      dayOfWeek: 1,
      intervals: [{ start: '09:00', end: '17:00' }],
      isAvailable: true,
    };

    // 1. Regular Monday without override
    const res1 = resolveDaySchedule('2026-09-07', weeklyMonday, []);
    expect(res1.isAvailable).toBe(true);
    expect(res1.intervals).toEqual([{ start: '09:00', end: '17:00' }]);

    // 2. Monday with 'unavailable' holiday override
    const res2 = resolveDaySchedule('2026-09-07', weeklyMonday, [
      { id: '1', date: '2026-09-07', type: 'unavailable', reason: 'Labor Day' },
    ]);
    expect(res2.isAvailable).toBe(false);
    expect(res2.intervals).toEqual([]);

    // 3. Sunday with 'available' custom hours override
    const res3 = resolveDaySchedule(
      '2026-09-06',
      { dayOfWeek: 0, intervals: [], isAvailable: false },
      [
        {
          id: '2',
          date: '2026-09-06',
          type: 'available',
          intervals: [{ start: '14:00', end: '18:00' }],
        },
      ]
    );
    expect(res3.isAvailable).toBe(true);
    expect(res3.intervals).toEqual([{ start: '14:00', end: '18:00' }]);
  });

  it('evaluates buffer padding and eliminates overlapping conflicts', () => {
    // Existing booking from 10:00 to 10:30 UTC
    const existing = [
      {
        start: new Date('2026-09-07T10:00:00Z'),
        end: new Date('2026-09-07T10:30:00Z'),
      },
    ];

    // Candidate slot from 09:30 to 10:00 (no buffer) -> should NOT conflict
    expect(
      isSlotConflicting(
        new Date('2026-09-07T09:30:00Z'),
        new Date('2026-09-07T10:00:00Z'),
        existing,
        0,
        0
      )
    ).toBe(false);

    // Candidate slot from 09:30 to 10:00 WITH 10min bufferAfter -> 09:30 to 10:10 -> SHOULD conflict with 10:00-10:30
    expect(
      isSlotConflicting(
        new Date('2026-09-07T09:30:00Z'),
        new Date('2026-09-07T10:00:00Z'),
        existing,
        0,
        10
      )
    ).toBe(true);

    // Candidate slot from 10:30 to 11:00 WITH 10min bufferBefore -> 10:20 to 11:00 -> SHOULD conflict with 10:00-10:30
    expect(
      isSlotConflicting(
        new Date('2026-09-07T10:30:00Z'),
        new Date('2026-09-07T11:00:00Z'),
        existing,
        10,
        0
      )
    ).toBe(true);
  });
});

describe('Scheduling Engine - High-Level Range Discovery', () => {
  const mockAvailabilityProfile: AvailabilityProfile = {
    id: 'avail-1',
    workspaceId: 'ws-1',
    organizationId: 'org-1',
    name: 'Standard Working Hours',
    timezone: 'UTC',
    isDefault: true,
    weeklyRules: [
      {
        dayOfWeek: 1, // Monday
        intervals: [{ start: '09:00', end: '12:00' }],
        isAvailable: true,
      },
      {
        dayOfWeek: 2, // Tuesday
        intervals: [{ start: '09:00', end: '12:00' }],
        isAvailable: true,
      },
    ],
    overrides: [
      {
        id: 'ov-1',
        date: '2026-09-08', // Tuesday is blocked by holiday override
        type: 'unavailable',
        reason: 'Bank Holiday',
      },
    ],
    minimumNoticeMinutes: 120, // 2 hours minimum notice
    maximumBookingHorizonDays: 30,
    defaultBufferBeforeMinutes: 0,
    defaultBufferAfterMinutes: 0,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const mockEventType: EventType = {
    id: 'event-1',
    workspaceId: 'ws-1',
    organizationId: 'org-1',
    name: '30-Minute Consultation',
    slug: 'consultation-30',
    purpose: 'consultation',
    format: 'one_to_one',
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minimumNoticeMinutes: 120,
    maximumBookingHorizonDays: 30,
    locationType: 'google_meet',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('discovers available slots for Monday and excludes overridden Tuesday', () => {
    // Monday: 2026-09-07, Tuesday: 2026-09-08
    const slots = getAvailableSlotsForRange({
      eventType: mockEventType,
      availabilityProfile: mockAvailabilityProfile,
      startDate: '2026-09-07',
      endDate: '2026-09-08',
      visitorTimezone: 'UTC',
      existingBookings: [
        {
          startAt: '2026-09-07T10:00:00Z',
          endAt: '2026-09-07T10:30:00Z',
        },
      ],
      now: new Date('2026-09-01T00:00:00Z'),
    });

    // Monday slots should exist and exclude 10:00-10:30
    expect(slots['2026-09-07']).toBeDefined();
    const mondayTimes = slots['2026-09-07'].map(s => s.formattedTime);
    expect(mondayTimes).toContain('09:00');
    expect(mondayTimes).toContain('09:30');
    expect(mondayTimes).not.toContain('10:00'); // Blocked by existing booking
    expect(mondayTimes).toContain('10:30');
    expect(mondayTimes).toContain('11:00');
    expect(mondayTimes).toContain('11:30');

    // Tuesday should have 0 slots because of the holiday override
    expect(slots['2026-09-08']).toBeUndefined();
  });

  it('correctly translates slots into a visitor in New York timezone (EDT = UTC-4)', () => {
    const slots = getAvailableSlotsForRange({
      eventType: mockEventType,
      availabilityProfile: mockAvailabilityProfile,
      startDate: '2026-09-07',
      endDate: '2026-09-07',
      visitorTimezone: 'America/New_York',
      existingBookings: [],
      now: new Date('2026-09-01T00:00:00Z'),
    });

    expect(slots['2026-09-07']).toBeDefined();
    // 09:00 UTC = 05:00 EDT
    const nyTimes = slots['2026-09-07'].map(s => s.formattedTime);
    expect(nyTimes[0]).toBe('05:00');
    expect(nyTimes[1]).toBe('05:30');
  });
});
