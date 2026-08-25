/**
 * @fileoverview RFC 5545 iCalendar (.ics) generator and one-click calendar sync link helpers.
 * Generates standards-compliant calendar files and deeplinks for Google Calendar, Outlook,
 * Office 365, and Yahoo Calendar.
 */

export interface CalendarEventPayload {
  title: string;
  description?: string;
  location?: string;
  /** ISO 8601 UTC timestamp */
  startAt: string;
  /** ISO 8601 UTC timestamp */
  endAt: string;
  organizerName?: string;
  organizerEmail?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  uid?: string;
}

/**
 * Formats a Date object into iCalendar UTC format (YYYYMMDDTHHmmssZ).
 */
export function formatIcsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Sanitizes and escapes text according to RFC 5545 specifications.
 */
function escapeIcsText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Generates an RFC 5545 compliant `.ics` calendar invitation string.
 */
export function generateIcsContent(event: CalendarEventPayload): string {
  const startDate = new Date(event.startAt);
  const endDate = new Date(event.endAt);
  const now = new Date();

  const uid = event.uid || `smartsapp-meeting-${startDate.getTime()}-${Math.random().toString(36).substring(2, 9)}@smartsapp.com`;
  const dtStamp = formatIcsDate(now);
  const dtStart = formatIcsDate(startDate);
  const dtEnd = formatIcsDate(endDate);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SmartSapp//SmartSapp Meetings 2.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  if (event.organizerEmail) {
    const orgName = event.organizerName ? `;CN=${escapeIcsText(event.organizerName)}` : '';
    lines.push(`ORGANIZER${orgName}:mailto:${event.organizerEmail}`);
  }

  if (event.attendeeEmail) {
    const attName = event.attendeeName ? `;CN=${escapeIcsText(event.attendeeName)}` : '';
    lines.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED${attName}:mailto:${event.attendeeEmail}`);
  }

  lines.push('STATUS:CONFIRMED');
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Generates a one-click "Add to Google Calendar" web link.
 */
export function getGoogleCalendarUrl(event: CalendarEventPayload): string {
  const dtStart = formatIcsDate(new Date(event.startAt));
  const dtEnd = formatIcsDate(new Date(event.endAt));

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${dtStart}/${dtEnd}`,
  });

  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates a one-click "Add to Outlook (Live/Hotmail)" web link.
 */
export function getOutlookCalendarUrl(event: CalendarEventPayload): string {
  const startIso = new Date(event.startAt).toISOString();
  const endIso = new Date(event.endAt).toISOString();

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: startIso,
    enddt: endIso,
  });

  if (event.description) params.set('body', event.description);
  if (event.location) params.set('location', event.location);

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generates a one-click "Add to Microsoft Office 365" web link.
 */
export function getOffice365CalendarUrl(event: CalendarEventPayload): string {
  const startIso = new Date(event.startAt).toISOString();
  const endIso = new Date(event.endAt).toISOString();

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: startIso,
    enddt: endIso,
  });

  if (event.description) params.set('body', event.description);
  if (event.location) params.set('location', event.location);

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generates a one-click "Add to Yahoo Calendar" web link.
 */
export function getYahooCalendarUrl(event: CalendarEventPayload): string {
  const dtStart = formatIcsDate(new Date(event.startAt));
  const dtEnd = formatIcsDate(new Date(event.endAt));

  const params = new URLSearchParams({
    v: '60',
    title: event.title,
    st: dtStart,
    et: dtEnd,
  });

  if (event.description) params.set('desc', event.description);
  if (event.location) params.set('in_loc', event.location);

  return `https://calendar.yahoo.com/?${params.toString()}`;
}
