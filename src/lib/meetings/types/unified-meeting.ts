/**
 * @fileoverview Unified Meeting Domain Model (Meetings 2.0).
 * Provides a canonical, strongly-typed interface unifying 1:1 client appointments ('bookings')
 * and group broadcasts/orientations/workshops ('meetings').
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Single Source of Truth for timeline, dashboard cards, and calendar event normalization.
 * - Zero 'any' policy strictly enforced.
 */

export type UnifiedEventSourceType = 'meeting' | 'booking';

export type UnifiedMeetingStatus =
  | 'scheduled'
  | 'confirmed'
  | 'live'
  | 'completed'
  | 'cancelled'
  | 'pending'
  | 'no_show';

export interface UnifiedMeetingItem {
  /** Canonical ID (prefers meetingId when linked) */
  id: string;
  sourceType: UnifiedEventSourceType;
  sourceId: string;
  title: string;
  /** ISO 8601 UTC string */
  startAt: string;
  /** ISO 8601 UTC string */
  endAt: string;
  durationMinutes: number;
  hostUserId?: string;
  hostName?: string;
  locationType: string;
  joinUrl?: string;
  status: UnifiedMeetingStatus;
  participantCount: number;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  typeSlug?: string;
  typeBadge?: string;
  meetingSlug?: string;
  color?: string;
  rawMeetingId?: string;
  rawBookingId?: string;
}
