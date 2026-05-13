// Pure utility — no 'use server' needed (imported by server modules)

/**
 * @fileOverview Calendar link generation utilities.
 * Generates Google Calendar URLs and ICS data from meeting parameters.
 * Used by template-resolver to populate {{calendar_link}} at send time.
 */

interface CalendarLinkParams {
  title: string;
  /** ISO 8601 date string for the event start */
  startTime: string;
  /** Duration in minutes. Defaults to 60. */
  durationMinutes?: number;
  /** Event description / body text */
  description?: string;
  /** Location string or meeting URL */
  location?: string;
}

/**
 * Formats an ISO date string into Google Calendar's required format: YYYYMMDDTHHmmssZ
 */
function toGCalDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generates a Google Calendar "Add Event" URL.
 *
 * @example
 * generateGoogleCalendarLink({
 *   title: 'Q2 Strategy Review',
 *   startTime: '2026-06-15T10:00:00Z',
 *   durationMinutes: 90,
 *   description: 'Quarterly review meeting',
 *   location: 'https://meet.example.com/abc123',
 * })
 * // → "https://calendar.google.com/calendar/event?action=TEMPLATE&text=Q2+Strategy+Review&dates=20260615T100000Z/20260615T113000Z&details=...&location=..."
 */
export function generateGoogleCalendarLink(params: CalendarLinkParams): string {
  const { title, startTime, durationMinutes = 60, description, location } = params;

  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const startStr = toGCalDate(start.toISOString());
  const endStr = toGCalDate(end.toISOString());

  const searchParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startStr}/${endStr}`,
  });

  if (description) searchParams.set('details', description);
  if (location) searchParams.set('location', location);

  return `https://calendar.google.com/calendar/event?${searchParams.toString()}`;
}

/**
 * Generates a calendar link from a Meeting document's fields.
 * Convenience wrapper used by buildVariableMap in template-resolver.ts.
 */
export function generateCalendarLinkFromMeeting(meeting: {
  heroTitle?: string;
  type?: { name?: string };
  meetingTime?: string;
  meetingLink?: string;
  durationMinutes?: number;
}): string {
  if (!meeting.meetingTime) return '';

  const title = meeting.heroTitle ?? meeting.type?.name ?? 'Meeting';

  return generateGoogleCalendarLink({
    title,
    startTime: meeting.meetingTime,
    durationMinutes: meeting.durationMinutes ?? 60,
    location: meeting.meetingLink ?? '',
  });
}
