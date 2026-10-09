// @vitest-environment jsdom
/**
 * Test Suite for Event Calendar & Live Countdown Utilities
 */

import { describe, it, expect, vi } from 'vitest';
import {
  formatUtcIcsDate,
  generateEventIcs,
  generateCalendarWebUrls,
  getEventLiveCountdown,
  downloadEventIcs,
} from '../event-calendar-utils';
import type { LiveEvent } from '@/lib/types/events';

describe('event-calendar-utils', () => {
  const sampleEvent: LiveEvent = {
    id: 'evt-202',
    organizationId: 'org-test',
    portalId: 'portal-test',
    workspaceIds: ['events'],
    title: 'Advanced Next.js Architecture Masterclass',
    slug: 'advanced-nextjs-masterclass',
    description: 'Deep dive into Server Actions, Streaming, and Emil Kowalski Animations.',
    type: 'masterclass',
    instructorName: 'Alex Rivera',
    meetingProvider: 'zoom',
    meetingUrl: 'https://zoom.us/j/1234567890',
    scheduledStartTime: '2026-11-20T14:00:00.000Z',
    scheduledEndTime: '2026-11-20T15:30:00.000Z',
    durationMinutes: 90,
    registeredCount: 45,
    attendedCount: 0,
    status: 'scheduled',
    isPublic: true,
    createdAt: '2026-09-25T12:00:00.000Z',
    updatedAt: '2026-09-25T12:00:00.000Z',
  };

  it('formats UTC ISO date to ICS format', () => {
    expect(formatUtcIcsDate('2026-11-20T14:00:00.000Z')).toBe('20261120T140000Z');
    expect(formatUtcIcsDate('invalid-date')).toBe('');
  });

  it('generates valid RFC 5545 .ics content', () => {
    const ics = generateEventIcs(sampleEvent);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('UID:evt-202@smartsapp.com');
    expect(ics).toContain('DTSTART:20261120T140000Z');
    expect(ics).toContain('DTEND:20261120T153000Z');
    expect(ics).toContain('SUMMARY:Advanced Next.js Architecture Masterclass');
    expect(ics).toContain('URL:https://zoom.us/j/1234567890');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('generates web calendar URLs for Google, Outlook, and Yahoo', () => {
    const urls = generateCalendarWebUrls(sampleEvent);
    expect(urls.google).toContain('calendar.google.com/calendar/render');
    expect(urls.google).toContain('text=Advanced%20Next.js');
    expect(urls.outlook).toContain('outlook.live.com/calendar/0/deeplink/compose');
    expect(urls.yahoo).toContain('calendar.yahoo.com/?v=60');
  });

  it('calculates countdown states accurately', () => {
    // 1. Future event in 2 days
    const now = Date.now();
    const futureStart = new Date(now + 2 * 86400000 + 3600000).toISOString();
    const futureEnd = new Date(now + 2 * 86400000 + 7200000).toISOString();
    const countdownFuture = getEventLiveCountdown(futureStart, futureEnd);
    expect(countdownFuture.isLive).toBe(false);
    expect(countdownFuture.isPast).toBe(false);
    expect(countdownFuture.days).toBeGreaterThanOrEqual(2);
    expect(countdownFuture.label).toContain('In 2d');

    // 2. Currently live event
    const liveStart = new Date(now - 1000 * 60 * 10).toISOString();
    const liveEnd = new Date(now + 1000 * 60 * 50).toISOString();
    const countdownLive = getEventLiveCountdown(liveStart, liveEnd);
    expect(countdownLive.isLive).toBe(true);
    expect(countdownLive.label).toBe('Live Now');

    // 3. Past event
    const pastStart = new Date(now - 1000 * 60 * 120).toISOString();
    const pastEnd = new Date(now - 1000 * 60 * 60).toISOString();
    const countdownPast = getEventLiveCountdown(pastStart, pastEnd);
    expect(countdownPast.isPast).toBe(true);
    expect(countdownPast.label).toBe('Ended');
  });

  it('triggers client-side .ics download without error', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    expect(() => downloadEventIcs(sampleEvent)).not.toThrow();
    expect(clickSpy).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();

    clickSpy.mockRestore();
  });
});
