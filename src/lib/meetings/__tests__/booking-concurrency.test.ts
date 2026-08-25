import { describe, it, expect } from 'vitest';
import { isSlotConflicting } from '../scheduling-engine';

describe('Booking Concurrency & Slot Collision Protection', () => {
  it('detects collisions when two requests target identical time intervals', () => {
    const slotAStart = new Date('2026-09-10T14:00:00Z');
    const slotAEnd = new Date('2026-09-10T14:30:00Z');

    const blocked = [
      {
        start: new Date('2026-09-10T14:00:00Z'),
        end: new Date('2026-09-10T14:30:00Z'),
      },
    ];

    expect(isSlotConflicting(slotAStart, slotAEnd, blocked, 0, 0)).toBe(true);
  });

  it('detects partial overlap collisions', () => {
    const slotStart = new Date('2026-09-10T14:15:00Z');
    const slotEnd = new Date('2026-09-10T14:45:00Z');

    const blocked = [
      {
        start: new Date('2026-09-10T14:00:00Z'),
        end: new Date('2026-09-10T14:30:00Z'),
      },
    ];

    expect(isSlotConflicting(slotStart, slotEnd, blocked, 0, 0)).toBe(true);
  });

  it('allows adjacent non-overlapping slots when buffers are zero', () => {
    const slotStart = new Date('2026-09-10T14:30:00Z');
    const slotEnd = new Date('2026-09-10T15:00:00Z');

    const blocked = [
      {
        start: new Date('2026-09-10T14:00:00Z'),
        end: new Date('2026-09-10T14:30:00Z'),
      },
    ];

    expect(isSlotConflicting(slotStart, slotEnd, blocked, 0, 0)).toBe(false);
  });

  it('blocks adjacent slots when bufferBefore or bufferAfter are active', () => {
    const slotStart = new Date('2026-09-10T14:30:00Z');
    const slotEnd = new Date('2026-09-10T15:00:00Z');

    const blocked = [
      {
        start: new Date('2026-09-10T14:00:00Z'),
        end: new Date('2026-09-10T14:30:00Z'),
      },
    ];

    // With 15-minute buffer before, slot effectively needs 14:15 - 15:00 -> conflicts with 14:00-14:30
    expect(isSlotConflicting(slotStart, slotEnd, blocked, 15, 0)).toBe(true);
  });
});
