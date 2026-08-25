import { describe, it, expect } from 'vitest';
import {
  calculateBulkRescheduleTimes,
  applySeriesInstanceOverride,
} from '../bulk-session-service';

describe('Bulk Session Operations & Series Exceptions Service', () => {
  it('calculates shifted timestamps for a batch of meetings', () => {
    const meetings = [
      { id: 'm1', meetingTime: '2026-08-25T10:00:00.000Z', endAt: '2026-08-25T11:00:00.000Z' },
      { id: 'm2', meetingTime: '2026-08-25T14:00:00.000Z', endAt: '2026-08-25T15:00:00.000Z' },
    ];

    // Reschedule +120 minutes (2 hours later)
    const shifted = calculateBulkRescheduleTimes(meetings, 120);

    expect(shifted[0].newMeetingTime).toBe('2026-08-25T12:00:00.000Z');
    expect(shifted[0].newEndAt).toBe('2026-08-25T13:00:00.000Z');
    expect(shifted[1].newMeetingTime).toBe('2026-08-25T16:00:00.000Z');
  });

  it('applies single instance cancellation or time override to recurring series', () => {
    const series = [
      { seriesId: 's1', startAt: '2026-08-25T10:00:00Z' },
      { seriesId: 's1', startAt: '2026-09-01T10:00:00Z' },
    ];

    // Cancel 2nd instance
    const overridden = applySeriesInstanceOverride(series, {
      seriesId: 's1',
      originalStart: '2026-09-01T10:00:00Z',
      isCancelled: true,
    });

    expect(overridden[0].isCancelled).toBeUndefined();
    expect(overridden[1].isCancelled).toBe(true);
  });
});
