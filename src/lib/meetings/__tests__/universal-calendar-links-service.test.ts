import { describe, it, expect } from 'vitest';
import { generateUniversalCalendarLinks } from '../universal-calendar-links-service';

describe('Universal Multi-Calendar Links Service', () => {
  it('generates well-formatted 1-click links for Google, Outlook, and Yahoo', () => {
    const payload = {
      title: 'Strategy & Architecture Session',
      description: 'Reviewing Phase 9 architecture',
      location: 'Google Meet',
      startAt: '2026-08-25T14:00:00.000Z',
      endAt: '2026-08-25T15:00:00.000Z',
      meetingUrl: 'https://meet.google.com/abc-def-ghi',
    };

    const links = generateUniversalCalendarLinks(payload);

    expect(links.googleCalendarUrl).toContain('calendar.google.com/calendar/render');
    expect(links.googleCalendarUrl).toContain('Strategy+%26+Architecture+Session');
    expect(links.googleCalendarUrl).toContain('20260825T140000Z');

    expect(links.outlookWebUrl).toContain('outlook.office.com/calendar');
    expect(links.yahooCalendarUrl).toContain('calendar.yahoo.com');
    expect(links.icsDownloadUrl).toContain('/api/meetings/ics');
  });
});
