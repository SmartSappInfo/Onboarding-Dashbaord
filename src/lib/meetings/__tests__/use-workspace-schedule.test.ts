import { describe, it, expect } from 'vitest';
import { calculateScheduleMetrics } from '../hooks/use-workspace-schedule';
import type { UnifiedMeetingItem } from '../types/unified-meeting';

describe('useWorkspaceSchedule Metric Engine', () => {
  const fixedNow = new Date('2026-10-05T12:00:00.000Z');

  const createItem = (overrides: Partial<UnifiedMeetingItem>): UnifiedMeetingItem => ({
    id: 'test_1',
    sourceType: 'booking',
    sourceId: 'src_1',
    title: 'Test Consultation',
    startAt: '2026-10-05T14:00:00.000Z',
    endAt: '2026-10-05T14:30:00.000Z',
    durationMinutes: 30,
    locationType: 'google_meet',
    joinUrl: 'https://meet.google.com/abc-xyz',
    status: 'confirmed',
    participantCount: 1,
    ...overrides,
  });

  it('filters todayEvents and upcomingWeekEvents accurately', () => {
    const todayItem = createItem({
      id: 'today_1',
      startAt: '2026-10-05T15:00:00.000Z',
      endAt: '2026-10-05T15:30:00.000Z',
    });

    const tomorrowItem = createItem({
      id: 'tomorrow_1',
      startAt: '2026-10-06T10:00:00.000Z',
      endAt: '2026-10-06T10:30:00.000Z',
    });

    const nextMonthItem = createItem({
      id: 'next_month_1',
      startAt: '2026-11-20T10:00:00.000Z',
      endAt: '2026-11-20T10:30:00.000Z',
    });

    const allEvents = [todayItem, tomorrowItem, nextMonthItem];
    const metrics = calculateScheduleMetrics({
      allEvents,
      referenceNow: fixedNow,
      connectedCalendarCount: 1,
    });

    expect(metrics.todayEvents).toHaveLength(1);
    expect(metrics.todayEvents[0].id).toBe('today_1');

    expect(metrics.upcomingWeekEvents).toHaveLength(2);
    expect(metrics.upcomingWeekEvents.map(e => e.id)).toEqual(['today_1', 'tomorrow_1']);
  });

  it('identifies the nearest upcoming group session', () => {
    const pastGroupSession = createItem({
      id: 'group_past',
      sourceType: 'meeting',
      title: 'Past Webinar',
      startAt: '2026-10-04T10:00:00.000Z',
      endAt: '2026-10-04T11:00:00.000Z',
    });

    const nextGroupSession = createItem({
      id: 'group_next',
      sourceType: 'meeting',
      title: 'Orientation 2026',
      startAt: '2026-10-06T18:00:00.000Z',
      endAt: '2026-10-06T19:00:00.000Z',
      typeBadge: 'Orientation',
    });

    const laterGroupSession = createItem({
      id: 'group_later',
      sourceType: 'meeting',
      title: 'Workshop Broadcast',
      startAt: '2026-10-08T18:00:00.000Z',
      endAt: '2026-10-08T19:00:00.000Z',
    });

    const bookingItem = createItem({
      id: 'booking_1',
      sourceType: 'booking',
      startAt: '2026-10-05T14:00:00.000Z',
    });

    const allEvents = [pastGroupSession, laterGroupSession, bookingItem, nextGroupSession];
    const metrics = calculateScheduleMetrics({
      allEvents,
      referenceNow: fixedNow,
      connectedCalendarCount: 1,
    });

    expect(metrics.nextUpcomingSession).not.toBeNull();
    expect(metrics.nextUpcomingSession?.id).toBe('group_next');
    expect(metrics.nextUpcomingSession?.title).toBe('Orientation 2026');
  });

  it('calculates real attendance rate accurately without mock percentages', () => {
    const completedBooking = createItem({ id: 'c1', status: 'completed' });
    const completedBooking2 = createItem({ id: 'c2', status: 'completed' });
    const noShowBooking = createItem({ id: 'ns1', status: 'no_show' });
    const scheduledBooking = createItem({ id: 's1', status: 'confirmed' });

    const allEvents = [completedBooking, completedBooking2, noShowBooking, scheduledBooking];
    const metrics = calculateScheduleMetrics({
      allEvents,
      referenceNow: fixedNow,
      connectedCalendarCount: 1,
    });

    // 2 completed out of 3 past resolved (2 completed + 1 no-show) = 67%
    expect(metrics.attendanceRate).toBe(67);
    expect(metrics.attendanceSubtitle).toBe('2 completed • 1 no-show');

    // When 0 completed and 0 no-show:
    const emptyMetrics = calculateScheduleMetrics({
      allEvents: [scheduledBooking],
      referenceNow: fixedNow,
      connectedCalendarCount: 1,
    });
    expect(emptyMetrics.attendanceRate).toBe(100);
    expect(emptyMetrics.attendanceSubtitle).toBe('No past no-shows');
  });

  it('identifies unconfirmed bookings and sessions missing conferencing links', () => {
    const pendingBooking = createItem({
      id: 'p1',
      status: 'pending',
      title: 'Pending Consultation with John',
    });

    const sessionWithoutLink = createItem({
      id: 'no_link_1',
      sourceType: 'meeting',
      joinUrl: '',
      title: 'Session without Link',
      startAt: '2026-10-05T16:00:00.000Z',
      endAt: '2026-10-05T17:00:00.000Z',
    });

    const normalSession = createItem({
      id: 'ok_1',
      joinUrl: 'https://meet.google.com/active-link',
      status: 'confirmed',
    });

    const allEvents = [pendingBooking, sessionWithoutLink, normalSession];
    const metrics = calculateScheduleMetrics({
      allEvents,
      referenceNow: fixedNow,
      connectedCalendarCount: 0, // Disconnected calendar
    });

    expect(metrics.unconfirmedBookings).toHaveLength(1);
    expect(metrics.unconfirmedBookings[0].id).toBe('p1');

    expect(metrics.sessionsMissingLink).toHaveLength(1);
    expect(metrics.sessionsMissingLink[0].id).toBe('no_link_1');

    expect(metrics.isCalendarConnected).toBe(false);
    // 1 pending booking + 1 session missing link + 1 calendar disconnected = 3 actions
    expect(metrics.totalAttentionCount).toBe(3);
  });
});
