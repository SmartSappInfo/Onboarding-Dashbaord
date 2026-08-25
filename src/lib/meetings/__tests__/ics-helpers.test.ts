import { describe, it, expect } from 'vitest';
import {
  generateIcsContent,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  getOffice365CalendarUrl,
  getYahooCalendarUrl,
} from '../ics-helpers';

describe('ICS & Calendar Link Helpers', () => {
  const mockPayload = {
    title: 'SmartSapp Enrollment Demo',
    description: 'Discussion on school enrollment workflow.',
    location: 'https://meet.google.com/abc-defg-hij',
    startAt: '2026-09-15T10:00:00.000Z',
    endAt: '2026-09-15T10:45:00.000Z',
    organizerName: 'SmartSapp Admissions',
    organizerEmail: 'admissions@smartsapp.com',
    attendeeName: 'Jane Doe',
    attendeeEmail: 'jane@example.com',
    uid: 'test-event-uid-12345@smartsapp.com',
  };

  it('generates a valid RFC 5545 iCalendar content string', () => {
    const ics = generateIcsContent(mockPayload);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//SmartSapp//SmartSapp Meetings 2.0//EN');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:test-event-uid-12345@smartsapp.com');
    expect(ics).toContain('DTSTART:20260915T100000Z');
    expect(ics).toContain('DTEND:20260915T104500Z');
    expect(ics).toContain('SUMMARY:SmartSapp Enrollment Demo');
    expect(ics).toContain('DESCRIPTION:Discussion on school enrollment workflow.');
    expect(ics).toContain('LOCATION:https://meet.google.com/abc-defg-hij');
    expect(ics).toContain('ORGANIZER;CN=SmartSapp Admissions:mailto:admissions@smartsapp.com');
    expect(ics).toContain('ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=Jane Doe:mailto:jane@example.com');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('generates valid Google Calendar URL', () => {
    const url = getGoogleCalendarUrl(mockPayload);
    expect(url).toContain('https://calendar.google.com/calendar/render?');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=SmartSapp+Enrollment+Demo');
    expect(url).toContain('dates=20260915T100000Z%2F20260915T104500Z');
    expect(url).toContain('location=https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij');
  });

  it('generates valid Outlook Calendar URL', () => {
    const url = getOutlookCalendarUrl(mockPayload);
    expect(url).toContain('https://outlook.live.com/calendar/0/deeplink/compose?');
    expect(url).toContain('rru=addevent');
    expect(url).toContain('subject=SmartSapp+Enrollment+Demo');
    expect(url).toContain('startdt=2026-09-15T10%3A00%3A00.000Z');
    expect(url).toContain('enddt=2026-09-15T10%3A45%3A00.000Z');
  });

  it('generates valid Office 365 URL', () => {
    const url = getOffice365CalendarUrl(mockPayload);
    expect(url).toContain('https://outlook.office.com/calendar/0/deeplink/compose?');
    expect(url).toContain('subject=SmartSapp+Enrollment+Demo');
  });

  it('generates valid Yahoo Calendar URL', () => {
    const url = getYahooCalendarUrl(mockPayload);
    expect(url).toContain('https://calendar.yahoo.com/?');
    expect(url).toContain('title=SmartSapp+Enrollment+Demo');
    expect(url).toContain('st=20260915T100000Z');
    expect(url).toContain('et=20260915T104500Z');
  });
});
