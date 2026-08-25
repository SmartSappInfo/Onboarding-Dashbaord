/**
 * @fileoverview Domain Types for Universal Multi-Calendar Links.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure schemas.
 * - Zero 'any' policy strictly enforced.
 */

export interface UniversalCalendarLinks {
  googleCalendarUrl: string;
  outlookWebUrl: string;
  outlookDesktopUrl: string;
  yahooCalendarUrl: string;
  icsDownloadUrl: string;
}

export interface CalendarEventPayload {
  title: string;
  description?: string;
  location?: string;
  startAt: string; // ISO 8601 UTC
  endAt: string;   // ISO 8601 UTC
  meetingUrl?: string;
}
