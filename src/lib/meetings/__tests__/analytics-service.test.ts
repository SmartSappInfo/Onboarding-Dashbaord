import { describe, it, expect } from 'vitest';
import {
  aggregateMeetingKPIs,
  computePeakBookingHours,
  computeHostWorkload,
} from '../analytics-service';

describe('Meeting Analytics & Metrics Service', () => {
  it('aggregates workspace meeting KPIs and computes attendance rate', () => {
    const meetings = [
      { id: 'm1', meetingTime: '2026-08-25T10:00:00Z', duration: 60, status: 'completed' },
      { id: 'm2', meetingTime: '2026-08-25T14:00:00Z', duration: 30, status: 'scheduled' },
      { id: 'm3', meetingTime: '2026-08-25T16:00:00Z', duration: 45, status: 'cancelled' },
    ];

    const bookings = [
      { id: 'b1', startAt: '2026-08-25T10:00:00Z', status: 'confirmed', createdAt: '2026-08-24T10:00:00Z' },
      { id: 'b2', startAt: '2026-08-25T14:00:00Z', status: 'confirmed', createdAt: '2026-08-24T14:00:00Z' },
    ];

    const participants = [
      { id: 'p1', meetingId: 'm1', status: 'completed' as const, attendedDurationSeconds: 3600 },
      { id: 'p2', meetingId: 'm1', status: 'completed' as const, attendedDurationSeconds: 3500 },
      { id: 'p3', meetingId: 'm1', status: 'no_show' as const, attendedDurationSeconds: 0 },
    ];

    const kpis = aggregateMeetingKPIs(meetings, bookings, participants);

    expect(kpis.totalScheduledMeetings).toBe(2); // m1 and m2 (m3 cancelled)
    expect(kpis.totalBookings).toBe(2);
    // 2 attended out of 3 total evaluated -> 67%
    expect(kpis.overallAttendanceRate).toBe(67);
    // (60 + 30) / 60 = 1.5 hours
    expect(kpis.totalMeetingHours).toBe(1.5);
    expect(kpis.completedMeetingsCount).toBe(1);
    expect(kpis.noShowCount).toBe(1);
  });

  it('computes peak booking hours bucket distributions', () => {
    const bookings = [
      { id: 'b1', startAt: '', status: 'confirmed', createdAt: '2026-08-24T10:15:00Z' },
      { id: 'b2', startAt: '', status: 'confirmed', createdAt: '2026-08-24T10:45:00Z' },
      { id: 'b3', startAt: '', status: 'confirmed', createdAt: '2026-08-24T14:20:00Z' },
    ];

    const peaks = computePeakBookingHours(bookings);
    const h10 = peaks.find(p => p.hour === 10)!;
    const h14 = peaks.find(p => p.hour === 14)!;

    expect(h10.count).toBe(2);
    expect(h14.count).toBe(1);
  });

  it('computes workload per host correctly', () => {
    const meetings = [
      { id: 'm1', meetingTime: '', duration: 30, status: 'completed', hostUserId: 'h1', hostName: 'Host One' },
      { id: 'm2', meetingTime: '', duration: 60, status: 'scheduled', hostUserId: 'h1', hostName: 'Host One' },
      { id: 'm3', meetingTime: '', duration: 45, status: 'scheduled', hostUserId: 'h2', hostName: 'Host Two' },
    ];

    const workload = computeHostWorkload(meetings);
    expect(workload).toHaveLength(2);
    expect(workload[0].hostUserId).toBe('h1');
    expect(workload[0].totalMeetings).toBe(2);
    expect(workload[0].totalMinutes).toBe(90);
  });
});
