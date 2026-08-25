import { describe, it, expect } from 'vitest';
import {
  mergeExternalBusyIntervals,
  isSlotConflictingWithExternalBusy,
  filterSlotsByExternalBusy,
} from '../calendar-service';
import type { AvailableSlot } from '../types';

describe('Calendar Free/Busy Conflict Engine', () => {
  it('merges overlapping and contiguous busy intervals correctly', () => {
    const internalBusy = [
      { start: '2026-09-01T10:00:00.000Z', end: '2026-09-01T11:00:00.000Z' },
      { start: '2026-09-01T14:00:00.000Z', end: '2026-09-01T15:00:00.000Z' },
    ];

    const externalBusy = [
      // Overlaps with the 10:00-11:00 slot (10:30-11:30)
      { start: '2026-09-01T10:30:00.000Z', end: '2026-09-01T11:30:00.000Z', source: 'google' as const },
      // Disjoint slot (16:00-17:00)
      { start: '2026-09-01T16:00:00.000Z', end: '2026-09-01T17:00:00.000Z', source: 'microsoft' as const },
    ];

    const merged = mergeExternalBusyIntervals(internalBusy, externalBusy);

    expect(merged).toHaveLength(3);
    // 1st merged interval: 10:00 to 11:30
    expect(merged[0].start).toBe('2026-09-01T10:00:00.000Z');
    expect(merged[0].end).toBe('2026-09-01T11:30:00.000Z');
    // 2nd interval: 14:00 to 15:00
    expect(merged[1].start).toBe('2026-09-01T14:00:00.000Z');
    expect(merged[1].end).toBe('2026-09-01T15:00:00.000Z');
    // 3rd interval: 16:00 to 17:00
    expect(merged[2].start).toBe('2026-09-01T16:00:00.000Z');
    expect(merged[2].end).toBe('2026-09-01T17:00:00.000Z');
  });

  it('detects direct slot collision and buffer collisions with external busy interval', () => {
    const busyIntervals = [
      { start: '2026-09-01T14:00:00.000Z', end: '2026-09-01T15:00:00.000Z' },
    ];

    // Direct overlap (14:30 - 15:00)
    expect(
      isSlotConflictingWithExternalBusy(
        '2026-09-01T14:30:00.000Z',
        '2026-09-01T15:00:00.000Z',
        busyIntervals
      )
    ).toBe(true);

    // Free slot away from busy (11:00 - 12:00)
    expect(
      isSlotConflictingWithExternalBusy(
        '2026-09-01T11:00:00.000Z',
        '2026-09-01T12:00:00.000Z',
        busyIntervals
      )
    ).toBe(false);

    // Slot 13:00-13:55 (not overlapping directly, but overlaps when bufferAfter is 10 min: 14:05 > 14:00)
    expect(
      isSlotConflictingWithExternalBusy(
        '2026-09-01T13:00:00.000Z',
        '2026-09-01T13:55:00.000Z',
        busyIntervals,
        0,
        10 // 10 minutes buffer after
      )
    ).toBe(true);

    // Slot 15:05-15:35 (not overlapping directly, but overlaps when bufferBefore is 10 min: 14:55 < 15:00)
    expect(
      isSlotConflictingWithExternalBusy(
        '2026-09-01T15:05:00.000Z',
        '2026-09-01T15:35:00.000Z',
        busyIntervals,
        10, // 10 minutes buffer before
        0
      )
    ).toBe(true);
  });

  it('filters available slots list against external busy calendar events', () => {
    const slots: AvailableSlot[] = [
      { start: '2026-09-01T09:00:00.000Z', end: '2026-09-01T09:30:00.000Z', formattedTime: '09:00', formattedEndTime: '09:30', available: true },
      { start: '2026-09-01T10:00:00.000Z', end: '2026-09-01T10:30:00.000Z', formattedTime: '10:00', formattedEndTime: '10:30', available: true },
      { start: '2026-09-01T11:00:00.000Z', end: '2026-09-01T11:30:00.000Z', formattedTime: '11:00', formattedEndTime: '11:30', available: true },
    ];

    const busy = [
      // Blocks the 10:00 slot
      { start: '2026-09-01T10:15:00.000Z', end: '2026-09-01T10:45:00.000Z' },
    ];

    const filtered = filterSlotsByExternalBusy(slots, busy);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].formattedTime).toBe('09:00');
    expect(filtered[1].formattedTime).toBe('11:00');
  });
});
