/**
 * {{Org_name}} Experience Platform — Event Calendar & Provider Bridge Test Suite
 *
 * Validates RFC 5545 compliance for .ics calendar export, universal web calendar
 * URL generation (Google, Outlook, Yahoo), and meeting URL security sanitization.
 */

import { describe, it, expect } from 'vitest';
import { EventService } from '../event-service';
import type { LiveEvent } from '@/lib/types/events';

describe('EventService — Calendar & Provider Security Bridge', () => {
  const mockEvent: LiveEvent = {
    id: 'evt-test-101',
    organizationId: 'org-test',
    portalId: 'portal-test',
    workspaceIds: ['events'],
    title: 'Live Workshop: React 19 & Next.js Architecture',
    slug: 'live-workshop-react-19',
    description: 'Explore Server Actions, Optimistic UI, and Emil Kowalski Animations.',
    type: 'workshop',
    instructorName: 'Sarah Connor',
    instructorTitle: 'Principal Staff Engineer',
    meetingProvider: 'zoom',
    meetingUrl: 'https://zoom.us/j/9876543210',
    meetingId: '9876543210',
    meetingPasscode: 'zoomPass789',
    scheduledStartTime: '2026-10-15T15:00:00.000Z',
    scheduledEndTime: '2026-10-15T16:30:00.000Z',
    durationMinutes: 90,
    registeredCount: 12,
    attendedCount: 0,
    status: 'scheduled',
    isPublic: true,
    createdAt: '2026-09-25T12:00:00.000Z',
    updatedAt: '2026-09-25T12:00:00.000Z',
  };

  describe('RFC 5545 .ics Calendar Export', () => {
    it('generates a valid, RFC 5545 compliant VCALENDAR string', () => {
      const ics = EventService.generateEventIcs(mockEvent);

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//SmartSapp//Experience Platform//EN');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain(`UID:evt-test-101@smartsapp.com`);
      expect(ics).toContain('DTSTART:20261015T150000Z');
      expect(ics).toContain('DTEND:20261015T163000Z');
      expect(ics).toContain('SUMMARY:Live Workshop: React 19 & Next.js Architecture');
      expect(ics).toContain('LOCATION:https://zoom.us/j/9876543210');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('END:VCALENDAR');
    });

    it('escapes commas, semicolons, and newlines in summary and description according to RFC 5545', () => {
      const eventWithSpecialChars: LiveEvent = {
        ...mockEvent,
        title: 'Project Review, Q3; Final Planning',
        description: 'Line 1\nLine 2, with comma; and semicolon.',
      };

      const ics = EventService.generateEventIcs(eventWithSpecialChars);
      expect(ics).toContain('SUMMARY:Project Review\\, Q3\\; Final Planning');
      expect(ics).toContain('Line 1\\nLine 2\\, with comma\\; and semicolon.');
    });
  });

  describe('Web Calendar URLs Generation', () => {
    it('generates accurate Google Calendar, Outlook Web, and Yahoo URLs', () => {
      const urls = EventService.generateCalendarWebUrls(mockEvent);

      // 1. Google Calendar
      expect(urls.google).toContain('calendar.google.com/calendar/render?action=TEMPLATE');
      expect(urls.google).toContain('text=Live%20Workshop%3A%20React%2019');
      expect(urls.google).toContain('dates=20261015T150000Z/20261015T163000Z');
      expect(urls.google).toContain('location=https%3A%2F%2Fzoom.us%2Fj%2F9876543210');

      // 2. Outlook Web
      expect(urls.outlook).toContain('outlook.live.com/calendar/0/deeplink/compose');
      expect(urls.outlook).toContain('subject=Live%20Workshop%3A%20React%2019');
      expect(urls.outlook).toContain('startdt=2026-10-15T15%3A00%3A00.000Z');
      expect(urls.outlook).toContain('enddt=2026-10-15T16%3A30%3A00.000Z');

      // 3. Yahoo Calendar
      expect(urls.yahoo).toContain('calendar.yahoo.com/?v=60');
      expect(urls.yahoo).toContain('title=Live%20Workshop%3A%20React%2019');
      expect(urls.yahoo).toContain('st=20261015T150000Z');
      expect(urls.yahoo).toContain('dur=0130');
    });
  });

  describe('Meeting URL Security Sanitization', () => {
    it('accepts valid HTTPS meeting links', () => {
      expect(EventService.sanitizeMeetingUrl('https://zoom.us/j/1234567890')).toBe(
        'https://zoom.us/j/1234567890'
      );
      expect(EventService.sanitizeMeetingUrl('https://meet.google.com/abc-defg-hij')).toBe(
        'https://meet.google.com/abc-defg-hij'
      );
      expect(EventService.sanitizeMeetingUrl('https://teams.microsoft.com/l/meetup-join/123')).toBe(
        'https://teams.microsoft.com/l/meetup-join/123'
      );
    });

    it('rejects javascript: and data: URI XSS exploits and returns safe empty string', () => {
      expect(EventService.sanitizeMeetingUrl('javascript:alert(1)')).toBe('');
      expect(EventService.sanitizeMeetingUrl('JAVASCRIPT:alert(document.cookie)')).toBe('');
      expect(EventService.sanitizeMeetingUrl('data:text/html,<script>alert(1)</script>')).toBe('');
      expect(EventService.sanitizeMeetingUrl('vbscript:msgbox("hacked")')).toBe('');
      expect(EventService.sanitizeMeetingUrl('   ')).toBe('');
    });
  });
});
