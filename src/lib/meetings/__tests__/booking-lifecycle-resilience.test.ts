import { describe, it, expect } from 'vitest';

/**
 * Computes the newEndAt timestamp for rescheduled meetings safely.
 */
export function computeRescheduledEndTime(
  newStartAt: string,
  durationMinutes?: number,
  originalStartAt?: string,
  originalEndAt?: string
): string {
  let duration = durationMinutes;
  if (!duration && originalStartAt && originalEndAt) {
    duration = Math.round((new Date(originalEndAt).getTime() - new Date(originalStartAt).getTime()) / 60000);
  }
  const validDuration = Math.max(15, duration || 30);
  return new Date(new Date(newStartAt).getTime() + validDuration * 60000).toISOString();
}

describe('Booking Reschedule EndTime Calculation', () => {
  it('correctly calculates newEndAt from durationMinutes', () => {
    const newStartAt = '2026-10-20T10:00:00.000Z';
    const computedEndAt = computeRescheduledEndTime(newStartAt, 45);
    expect(computedEndAt).toBe('2026-10-20T10:45:00.000Z');
  });

  it('correctly falls back to original interval when durationMinutes is missing', () => {
    const newStartAt = '2026-10-20T10:00:00.000Z';
    const originalStart = '2026-10-18T14:00:00.000Z';
    const originalEnd = '2026-10-18T15:00:00.000Z';
    const computedEndAt = computeRescheduledEndTime(newStartAt, undefined, originalStart, originalEnd);
    expect(computedEndAt).toBe('2026-10-20T11:00:00.000Z');
  });

  it('enforces a 15-minute minimum duration boundary to prevent zero-duration collapse', () => {
    const newStartAt = '2026-10-20T10:00:00.000Z';
    const computedEndAt = computeRescheduledEndTime(newStartAt, 5);
    expect(computedEndAt).toBe('2026-10-20T10:15:00.000Z');
  });
});
