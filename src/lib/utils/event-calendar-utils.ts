/**
 * {{Org_name}} Experience Platform — Event Calendar & Countdown Utilities
 *
 * Client and server compatible utilities for RFC 5545 compliant .ics calendar generation,
 * Google / Outlook / Yahoo web calendar deep-links, browser download helpers,
 * and live session countdown timers conforming to Emil Kowalski animation patterns.
 */

import type { LiveEvent } from '@/lib/types/events';

export interface CalendarWebUrls {
  google: string;
  outlook: string;
  yahoo: string;
}

export interface LiveCountdownState {
  label: string;
  isLive: boolean;
  isPast: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Format an ISO date string into UTC ICS timestamp format: YYYYMMDDTHHMMSSZ
 */
export function formatUtcIcsDate(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Escape text for RFC 5545 VCALENDAR properties.
 */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Generate RFC 5545 compliant VCALENDAR (.ics) content for Apple iCal, Outlook, and Google Calendar.
 */
export function generateEventIcs(
  event: Pick<LiveEvent, 'id' | 'title' | 'description' | 'scheduledStartTime' | 'scheduledEndTime' | 'meetingUrl'> & {
    createdAt?: string;
  }
): string {
  const dtStamp = formatUtcIcsDate(event.createdAt || new Date().toISOString());
  const dtStart = formatUtcIcsDate(event.scheduledStartTime);
  const dtEnd = formatUtcIcsDate(event.scheduledEndTime);
  const summary = escapeIcsText(event.title);
  const description = escapeIcsText(event.description || '');
  const location = escapeIcsText(event.meetingUrl);
  const uid = `${event.id}@smartsapp.com`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SmartSapp//Experience Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `URL:${event.meetingUrl}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Generate 1-click web calendar links for Google Calendar, Outlook Web, and Yahoo Calendar.
 */
export function generateCalendarWebUrls(
  event: Pick<LiveEvent, 'title' | 'description' | 'scheduledStartTime' | 'scheduledEndTime' | 'meetingUrl'>
): CalendarWebUrls {
  const dtStart = formatUtcIcsDate(event.scheduledStartTime);
  const dtEnd = formatUtcIcsDate(event.scheduledEndTime);
  const title = encodeURIComponent(event.title);
  const details = encodeURIComponent(event.description || '');
  const location = encodeURIComponent(event.meetingUrl);

  // Google Calendar
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}&location=${location}`;

  // Outlook Web
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&startdt=${encodeURIComponent(event.scheduledStartTime)}&enddt=${encodeURIComponent(event.scheduledEndTime)}&body=${details}&location=${location}`;

  // Yahoo Calendar duration in HHMM format
  const startMs = new Date(event.scheduledStartTime).getTime();
  const endMs = new Date(event.scheduledEndTime).getTime();
  const durationMins = Math.max(15, Math.round((endMs - startMs) / 60000));
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  const dur = `${String(hours).padStart(2, '0')}${String(mins).padStart(2, '0')}`;
  const yahoo = `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${title}&st=${dtStart}&dur=${dur}&desc=${details}&in_loc=${location}`;

  return { google, outlook, yahoo };
}

/**
 * Browser helper to trigger a direct .ics file download.
 */
export function downloadEventIcs(
  event: Pick<LiveEvent, 'id' | 'title' | 'slug' | 'description' | 'scheduledStartTime' | 'scheduledEndTime' | 'meetingUrl'> & {
    createdAt?: string;
  }
): void {
  if (typeof document === 'undefined') return;

  const icsString = generateEventIcs(event);
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileSlug = event.slug || event.id;
  link.setAttribute('download', `${fileSlug}-calendar.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Calculates live session relative countdown state with accuracy down to the second.
 */
export function getEventLiveCountdown(
  scheduledStartTime: string,
  scheduledEndTime: string
): LiveCountdownState {
  const now = Date.now();
  const startMs = new Date(scheduledStartTime).getTime();
  const endMs = new Date(scheduledEndTime).getTime();

  if (now >= startMs && now <= endMs) {
    return {
      label: 'Live Now',
      isLive: true,
      isPast: false,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  if (now > endMs) {
    return {
      label: 'Ended',
      isLive: false,
      isPast: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const diffMs = Math.max(0, startMs - now);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  let label = '';
  if (days > 0) {
    label = `In ${days}d ${hours}h`;
  } else if (hours > 0) {
    label = `In ${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    label = `In ${minutes}m ${seconds}s`;
  } else {
    label = `Starting in ${seconds}s`;
  }

  return {
    label,
    isLive: false,
    isPast: false,
    days,
    hours,
    minutes,
    seconds,
  };
}
