/**
 * @fileoverview Pure Universal Multi-Calendar Link & Web Exporter.
 * Generates 1-click web links for Google Calendar, Outlook Web, Outlook Desktop, Yahoo, and Apple Calendar (.ics).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Handles UTC timestamp formatting and strict URI escaping.
 */

import type {
  CalendarEventPayload,
  UniversalCalendarLinks,
} from './types/calendar-links';

/**
 * Formats a Date or ISO string into UTC compact format `YYYYMMDDTHHmmssZ`.
 */
function formatUtcCompact(isoDate: string): string {
  const d = new Date(isoDate);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hours = pad(d.getUTCHours());
  const minutes = pad(d.getUTCMinutes());
  const seconds = pad(d.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generates direct web calendar URLs for all major calendar services.
 */
export function generateUniversalCalendarLinks(
  payload: CalendarEventPayload
): UniversalCalendarLinks {
  const { title, description = '', location = '', startAt, endAt, meetingUrl = '' } = payload;

  const startUtc = formatUtcCompact(startAt);
  const endUtc = formatUtcCompact(endAt);

  const fullDesc = meetingUrl ? `${description}\n\nJoin Meeting: ${meetingUrl}`.trim() : description;

  // 1. Google Calendar URL
  const googleParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startUtc}/${endUtc}`,
    details: fullDesc,
    location: location || meetingUrl,
  });
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?${googleParams.toString()}`;

  // 2. Outlook Web (Office 365)
  const outlookParams = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    startdt: startAt,
    enddt: endAt,
    body: fullDesc,
    location: location || meetingUrl,
  });
  const outlookWebUrl = `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams.toString()}`;

  // 3. Outlook Live / Desktop
  const outlookDesktopUrl = `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`;

  // 4. Yahoo Calendar
  const yahooParams = new URLSearchParams({
    v: '60',
    view: 'd',
    type: '20',
    title,
    st: startUtc,
    et: endUtc,
    desc: fullDesc,
    in_loc: location || meetingUrl,
  });
  const yahooCalendarUrl = `https://calendar.yahoo.com/?${yahooParams.toString()}`;

  // 5. Apple Calendar / .ics data URI fallback
  const icsDownloadUrl = `/api/meetings/ics?title=${encodeURIComponent(title)}&start=${encodeURIComponent(startAt)}&end=${encodeURIComponent(endAt)}`;

  return {
    googleCalendarUrl,
    outlookWebUrl,
    outlookDesktopUrl,
    yahooCalendarUrl,
    icsDownloadUrl,
  };
}
