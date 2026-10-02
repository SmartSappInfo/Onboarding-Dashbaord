/**
 * @fileoverview Pure Unified Meeting Service & Transformation Engine.
 * Single Source of Truth (SSOT) for normalizing, deduplicating, and status-classifying
 * events from both 'meetings' and 'bookings' collections.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure functions with zero side effects.
 * - Zero 'any' policy strictly enforced.
 */

import type { Meeting } from '@/lib/types';
import type { Booking } from './types';
import type { UnifiedMeetingItem, UnifiedMeetingStatus } from './types/unified-meeting';

/**
 * Normalizes a Firestore Meeting document into a canonical UnifiedMeetingItem.
 */
export function normalizeMeetingToUnified(
  m: Partial<Meeting> & { id: string }
): UnifiedMeetingItem {
  const duration = Number(m.durationMinutes || m.duration) || 30;
  const startIso = m.meetingTime || new Date().toISOString();
  const startMs = new Date(startIso).getTime();
  const endMs = m.endTime ? new Date(m.endTime).getTime() : startMs + duration * 60000;
  const endIso = new Date(endMs).toISOString();

  let status: UnifiedMeetingStatus = 'scheduled';
  if (m.publishStatus === 'draft') {
    status = 'pending';
  } else if (m.status === 'cancelled') {
    status = 'cancelled';
  } else if (m.status === 'ended') {
    status = 'completed';
  } else if (m.status === 'active') {
    status = 'live';
  }

  return {
    id: m.id,
    sourceType: 'meeting',
    sourceId: m.id,
    title: m.title || 'Scheduled Meeting',
    startAt: startIso,
    endAt: endIso,
    durationMinutes: duration,
    hostUserId: m.hostUserId,
    hostName: m.hostName,
    locationType: m.locationType || (m.meetingLink ? 'video_conference' : 'custom'),
    joinUrl: m.meetingLink || undefined,
    status,
    participantCount: m.attendeeCount || 0,
    contactName: m.contactName,
    contactEmail: m.contactEmail,
    typeSlug: m.type?.slug,
    typeBadge: m.type?.name,
    meetingSlug: m.meetingSlug,
    color: '#3b82f6',
    rawMeetingId: m.id,
  };
}

/**
 * Normalizes a Booking document into a canonical UnifiedMeetingItem.
 */
export function normalizeBookingToUnified(b: Booking): UnifiedMeetingItem {
  const startMs = new Date(b.startAt).getTime();
  const endMs = new Date(b.endAt).getTime();
  const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000)) || 30;

  const bookerFullName = [b.booker?.firstName, b.booker?.lastName].filter(Boolean).join(' ').trim();
  const title = bookerFullName
    ? `${b.eventTypeName || 'Consultation'} with ${bookerFullName}`
    : b.eventTypeName || 'Scheduled Consultation';

  let status: UnifiedMeetingStatus = 'scheduled';
  if (b.status === 'confirmed') status = 'confirmed';
  else if (b.status === 'pending') status = 'pending';
  else if (b.status === 'completed') status = 'completed';
  else if (b.status === 'cancelled') status = 'cancelled';
  else if (b.status === 'no_show') status = 'no_show';

  return {
    id: b.id,
    sourceType: 'booking',
    sourceId: b.id,
    title,
    startAt: b.startAt,
    endAt: b.endAt,
    durationMinutes,
    hostUserId: b.hostUserId,
    locationType: b.locationType || 'google_meet',
    joinUrl: b.joinUrl || undefined,
    status,
    participantCount: 1,
    contactName: bookerFullName || undefined,
    contactEmail: b.booker?.email || undefined,
    notes: b.booker?.notes || undefined,
    typeBadge: b.eventTypeName,
    color: '#8b5cf6',
    rawBookingId: b.id,
    rawMeetingId: b.meetingId,
  };
}

/**
 * Deduplicates unified meeting items.
 * If a booking has materialized a meeting doc, or a meeting doc has `meetingSlug: booking-${bookingId}`,
 * they are merged into one canonical entry preserving rich contact notes and live meeting links.
 */
export function deduplicateUnifiedMeetings(items: UnifiedMeetingItem[]): UnifiedMeetingItem[] {
  const result: UnifiedMeetingItem[] = [];
  const handledIds = new Set<string>();

  // Map meetingId -> booking item
  const meetingIdToBooking = new Map<string, UnifiedMeetingItem>();
  // Map bookingSlug -> booking item
  const bookingSlugToBooking = new Map<string, UnifiedMeetingItem>();
  // Set of booking IDs that have a linked meeting
  const linkedBookingIds = new Set<string>();

  for (const item of items) {
    if (item.sourceType === 'booking') {
      if (item.rawMeetingId) {
        meetingIdToBooking.set(item.rawMeetingId, item);
      }
      bookingSlugToBooking.set(`booking-${item.id}`, item);
    }
  }

  // Pre-identify which bookings have matching meetings present in this collection
  for (const item of items) {
    if (item.sourceType === 'meeting') {
      const linkedBooking =
        meetingIdToBooking.get(item.id) ||
        (item.meetingSlug ? bookingSlugToBooking.get(item.meetingSlug) : undefined);
      if (linkedBooking) {
        linkedBookingIds.add(linkedBooking.id);
      }
    }
  }

  for (const item of items) {
    if (handledIds.has(item.id)) continue;

    // If this booking has a linked meeting in this set, defer so it merges with the meeting
    if (item.sourceType === 'booking' && linkedBookingIds.has(item.id)) {
      continue;
    }

    if (item.sourceType === 'meeting') {
      // Check if this meeting was materialized from a booking
      const linkedBooking =
        meetingIdToBooking.get(item.id) ||
        (item.meetingSlug ? bookingSlugToBooking.get(item.meetingSlug) : undefined);

      if (linkedBooking) {
        // Merge canonical item: prefer booking contact details + meeting link
        result.push({
          ...linkedBooking,
          id: item.id || linkedBooking.id,
          status: item.status === 'live' ? 'live' : (linkedBooking.status || item.status),
          joinUrl: item.joinUrl || linkedBooking.joinUrl,
          rawMeetingId: item.id,
          rawBookingId: linkedBooking.id,
        });
        handledIds.add(item.id);
        handledIds.add(linkedBooking.id);
        continue;
      }
    }

    result.push(item);
    handledIds.add(item.id);
  }

  return result;
}

/**
 * Determines if a meeting is currently live.
 * Applies a 5-minute pre-meeting grace window.
 */
export function isMeetingLiveNow(
  startAt: string,
  endAt: string,
  referenceNow: Date = new Date(),
  preMeetingBufferMinutes = 5
): boolean {
  const nowMs = referenceNow.getTime();
  const startMs = new Date(startAt).getTime() - preMeetingBufferMinutes * 60000;
  const endMs = new Date(endAt).getTime();
  return nowMs >= startMs && nowMs <= endMs;
}

/**
 * Determines if a meeting has ended in the past.
 */
export function isMeetingPast(endAt: string, referenceNow: Date = new Date()): boolean {
  return referenceNow.getTime() > new Date(endAt).getTime();
}

/**
 * Sorts unified items chronologically.
 */
export function sortUnifiedMeetingsChronologically(
  items: UnifiedMeetingItem[],
  direction: 'asc' | 'desc' = 'asc'
): UnifiedMeetingItem[] {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.startAt).getTime();
    const timeB = new Date(b.startAt).getTime();
    return direction === 'asc' ? timeA - timeB : timeB - timeA;
  });
}
