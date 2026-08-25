/**
 * @fileoverview Domain Types for the Interactive Meetings Calendar Hub.
 * Strictly typed interfaces for multi-view calendar rendering, grid slot calculations,
 * external collision blocks, and quick-schedule inputs.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All times stored in ISO 8601 UTC format.
 * - Zero 'any' policy strictly enforced.
 */

export type CalendarViewMode = 'day' | '3day' | 'week' | 'month' | 'agenda';

export type CalendarEventSourceType =
  | 'meeting'          // Confirmed SmartSapp meeting
  | 'booking_hold'      // 5-min temporary concurrency reservation
  | 'google_busy'       // Busy block from Google Calendar
  | 'microsoft_busy';   // Busy block from Microsoft Outlook / 365

export interface CalendarGridEvent {
  id: string;
  sourceId: string;
  sourceType: CalendarEventSourceType;
  title: string;
  startAt: string; // ISO 8601 UTC
  endAt: string;   // ISO 8601 UTC
  hostUserId: string;
  hostName?: string;
  color?: string;
  locationType?: string;
  status?: string;
  joinUrl?: string;
  participantCount?: number;
  contactName?: string;
  contactEmail?: string;
  isExternalCollision?: boolean;
}

export interface CalendarFilterConfig {
  hostUserIds?: string[];
  eventTypes?: string[];
  includeExternalBusy?: boolean;
  statusFilters?: string[];
}

export interface CalendarTimeSlot {
  timeStr: string; // e.g. "09:00", "09:30"
  hour: number;
  minute: number;
}
