'use server';

/**
 * @fileoverview Server Actions for the Meetings Calendar Hub.
 * Queries scheduled meetings, active booking holds, and external Google/Microsoft busy intervals.
 * Provides quick scheduling with collision verification.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Calendar queries are strictly time-bounded to protect against memory exhaustion.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  CalendarGridEvent,
} from '@/lib/meetings/types/calendar-view';
import type { MeetingLocationType } from '@/lib/meetings/types';
import { generateMeetingRoom, rollbackMeetingRoomAsync, type MeetingRoomResult } from '@/lib/meetings/meeting-provider-service';
import { detectGridCollision } from '@/lib/meetings/calendar-view-service';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Fetches all calendar grid events within a date range for a workspace.
 */
export async function getWorkspaceCalendarEventsAction(
  workspaceId: string,
  startIso: string,
  endIso: string,
  hostUserIds?: string[]
): Promise<{ success: boolean; events?: CalendarGridEvent[]; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const events: CalendarGridEvent[] = [];

    // 1. Fetch confirmed/scheduled meetings (supporting both workspaceIds array and legacy scalar workspaceId)
    const meetingDocsMap = new Map<string, { id: string; data: FirebaseFirestore.DocumentData }>();

    try {
      const arraySnap = await adminDb
        .collection('meetings')
        .where('workspaceIds', 'array-contains', workspaceId)
        .where('meetingTime', '>=', startIso)
        .where('meetingTime', '<=', endIso)
        .get();

      for (const doc of arraySnap.docs) {
        meetingDocsMap.set(doc.id, { id: doc.id, data: doc.data() });
      }
    } catch (arrayErr) {
      console.warn('[getWorkspaceCalendarEventsAction] workspaceIds array query notice:', arrayErr);
    }

    try {
      const scalarSnap = await adminDb
        .collection('meetings')
        .where('workspaceId', '==', workspaceId)
        .where('meetingTime', '>=', startIso)
        .where('meetingTime', '<=', endIso)
        .get();

      for (const doc of scalarSnap.docs) {
        if (!meetingDocsMap.has(doc.id)) {
          meetingDocsMap.set(doc.id, { id: doc.id, data: doc.data() });
        }
      }
    } catch (scalarErr) {
      console.warn('[getWorkspaceCalendarEventsAction] scalar workspaceId query notice:', scalarErr);
    }

    // 2. Fetch confirmed client bookings
    const bookingDocsMap = new Map<string, { id: string; data: FirebaseFirestore.DocumentData }>();
    try {
      const bookingsSnap = await adminDb
        .collection('bookings')
        .where('workspaceId', '==', workspaceId)
        .where('startAt', '>=', startIso)
        .where('startAt', '<=', endIso)
        .get();

      for (const doc of bookingsSnap.docs) {
        bookingDocsMap.set(doc.id, { id: doc.id, data: doc.data() });
      }
    } catch (bkgErr) {
      console.warn('[getWorkspaceCalendarEventsAction] bookings query notice:', bkgErr);
    }

    // 3. Deduplicate linked bookings and meetings
    // Map of meetingId -> bookingId and bookingSlug -> bookingId
    const linkedMeetingToBooking = new Map<string, string>();
    for (const [bookingId, { data: b }] of bookingDocsMap.entries()) {
      if (b.meetingId) {
        linkedMeetingToBooking.set(b.meetingId, bookingId);
      }
      linkedMeetingToBooking.set(`booking-${bookingId}`, bookingId);
    }

    const handledMeetingIds = new Set<string>();
    const handledBookingIds = new Set<string>();

    // Process meetings
    for (const [meetingId, { data }] of meetingDocsMap.entries()) {
      if (data.status === 'cancelled') continue;

      const linkedBookingId = linkedMeetingToBooking.get(meetingId) || (data.meetingSlug ? linkedMeetingToBooking.get(data.meetingSlug) : undefined);
      const linkedBooking = linkedBookingId ? bookingDocsMap.get(linkedBookingId) : undefined;
      const bData = linkedBooking?.data;

      const effectiveHostUserId = bData?.hostUserId || data.hostUserId;
      if (hostUserIds && hostUserIds.length > 0 && effectiveHostUserId && !hostUserIds.includes(effectiveHostUserId)) {
        continue;
      }

      const durationMins = Number(data.durationMinutes || data.duration) || 30;
      const startMs = new Date(data.meetingTime).getTime();
      const endMs = data.endTime ? new Date(data.endTime).getTime() : startMs + durationMins * 60000;

      if (linkedBooking) {
        handledBookingIds.add(linkedBooking.id);
        const bData = linkedBooking.data;
        const bookerFullName = [bData.booker?.firstName, bData.booker?.lastName].filter(Boolean).join(' ').trim();
        const displayTitle = bookerFullName
          ? `${bData.eventTypeName || 'Consultation'} with ${bookerFullName}`
          : data.title || 'Scheduled Meeting';

        events.push({
          id: meetingId,
          sourceId: linkedBooking.id,
          sourceType: 'meeting',
          title: displayTitle,
          startAt: data.meetingTime,
          endAt: new Date(endMs).toISOString(),
          hostUserId: bData.hostUserId || data.hostUserId || 'unassigned',
          hostName: data.hostName || 'Host',
          color: '#8b5cf6',
          locationType: bData.locationType || data.locationType || 'google_meet',
          status: bData.status || data.status || 'confirmed',
          joinUrl: data.meetingLink || data.joinUrl || bData.joinUrl,
          participantCount: 1,
          contactName: bookerFullName || data.contactName,
          contactEmail: bData.booker?.email || data.contactEmail,
        });
      } else {
        events.push({
          id: meetingId,
          sourceId: meetingId,
          sourceType: 'meeting',
          title: data.title || 'Scheduled Meeting',
          startAt: data.meetingTime,
          endAt: new Date(endMs).toISOString(),
          hostUserId: data.hostUserId || 'unassigned',
          hostName: data.hostName || 'Host',
          color: data.color || '#3b82f6',
          locationType: data.locationType || (data.meetingLink ? 'video_conference' : 'google_meet'),
          status: data.status || 'scheduled',
          joinUrl: data.meetingLink || data.joinUrl,
          participantCount: data.attendeeCount || 0,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
        });
      }

      handledMeetingIds.add(meetingId);
    }

    // Process remaining bookings that had no corresponding meeting doc in this query
    for (const [bookingId, { data: b }] of bookingDocsMap.entries()) {
      if (handledBookingIds.has(bookingId)) continue;
      if (b.status === 'cancelled') continue;
      if (hostUserIds && hostUserIds.length > 0 && b.hostUserId && !hostUserIds.includes(b.hostUserId)) continue;

      const bookerFullName = [b.booker?.firstName, b.booker?.lastName].filter(Boolean).join(' ').trim();
      const displayTitle = bookerFullName
        ? `${b.eventTypeName || 'Consultation'} with ${bookerFullName}`
        : b.eventTypeName || 'Scheduled Consultation';

      events.push({
        id: bookingId,
        sourceId: bookingId,
        sourceType: 'meeting',
        title: displayTitle,
        startAt: b.startAt,
        endAt: b.endAt,
        hostUserId: b.hostUserId || 'unassigned',
        hostName: 'Host',
        color: '#8b5cf6',
        locationType: b.locationType || 'google_meet',
        status: b.status || 'confirmed',
        joinUrl: b.joinUrl,
        participantCount: 1,
        contactName: bookerFullName || undefined,
        contactEmail: b.booker?.email || undefined,
      });

      handledBookingIds.add(bookingId);
    }

    // 4. Fetch active booking holds (temporary concurrency locks)
    const nowIso = new Date().toISOString();
    try {
      const holdsSnap = await adminDb
        .collection('booking_holds')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .where('expiresAt', '>', nowIso)
        .get();

      for (const doc of holdsSnap.docs) {
        const h = doc.data();
        if (h.startAt >= startIso && h.startAt <= endIso) {
          events.push({
            id: `hold_${doc.id}`,
            sourceId: doc.id,
            sourceType: 'booking_hold',
            title: '⏳ Pending Reservation Hold',
            startAt: h.startAt,
            endAt: h.endAt,
            hostUserId: h.hostUserId || 'unassigned',
            color: '#f59e0b',
            status: 'held',
          });
        }
      }
    } catch (holdErr) {
      console.warn('[getWorkspaceCalendarEventsAction] booking_holds query notice:', holdErr);
    }

    events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    return { success: true, events };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Quick-schedules a meeting directly from the Calendar Hub with collision validation.
 */
export async function quickScheduleMeetingAction(payload: {
  workspaceId: string;
  organizationId?: string;
  title: string;
  description?: string;
  hostUserId: string;
  hostName: string;
  startAt: string;
  durationMinutes: number;
  locationType?: string;
  contactName?: string;
  contactEmail?: string;
  forceSchedule?: boolean;
}): Promise<{ success: boolean; meetingId?: string; meetingLink?: string; error?: string }> {
  // SECURITY: Server Actions are public endpoints — require auth and verify workspace access
  await requireAuth();
  await requireWorkspace(payload.workspaceId);

  try {
    const {
      workspaceId,
      organizationId,
      title,
      description,
      hostUserId,
      hostName,
      startAt,
      durationMinutes,
      locationType = 'google_meet',
      contactName,
      contactEmail,
      forceSchedule = false,
    } = payload;

    const startMs = new Date(startAt).getTime();
    const endMs = startMs + durationMinutes * 60000;
    const endAt = new Date(endMs).toISOString();
    const now = new Date().toISOString();

    if (!title.trim()) throw new Error('Meeting title is required.');

    // Check collision unless force scheduled
    if (!forceSchedule) {
      const existingRes = await getWorkspaceCalendarEventsAction(
        workspaceId,
        new Date(startMs - 86400000).toISOString(),
        new Date(endMs + 86400000).toISOString(),
        [hostUserId]
      );

      if (existingRes.success && existingRes.events) {
        const collision = detectGridCollision(
          new Date(startAt),
          new Date(endAt),
          existingRes.events
        );

        if (collision) {
          throw new Error(`Scheduling conflict with "${collision.title}" (${new Date(collision.startAt).toLocaleTimeString()} - ${new Date(collision.endAt).toLocaleTimeString()}). Enable force schedule to override.`);
        }
      }
    }

    // Provision real conferencing link if a video provider was selected
    let meetingLink = '';
    let externalCalendarEventId: string | undefined;
    let externalCalendarEventUrl: string | undefined;
    let roomResult: MeetingRoomResult | null = null;

    const normalizedLocationType = (locationType === 'ms_teams' ? 'teams' : locationType) as MeetingLocationType;

    if (normalizedLocationType === 'google_meet' || normalizedLocationType === 'zoom' || normalizedLocationType === 'teams') {
      roomResult = await generateMeetingRoom({
        workspaceId,
        locationType: normalizedLocationType,
        title: title.trim(),
        startAt,
        endAt,
        timezone: 'UTC',
        hostUserId,
        bookerName: contactName?.trim(),
        bookerEmail: contactEmail?.trim(),
        durationMinutes,
      });

      meetingLink = roomResult.joinUrl;
      externalCalendarEventId = roomResult.externalCalendarEventId;
      externalCalendarEventUrl = roomResult.externalCalendarEventUrl;
    }

    try {
      const docRef = adminDb.collection('meetings').doc();
      const meetingData = {
        id: docRef.id,
        workspaceId,
        workspaceIds: [workspaceId],
        organizationId: organizationId || '',
        title: title.trim(),
        description: description?.trim() || '',
        hostUserId,
        hostName,
        meetingTime: startAt,
        endTime: endAt,
        duration: durationMinutes,
        durationMinutes,
        status: 'scheduled',
        locationType: normalizedLocationType,
        meetingLink,
        externalCalendarEventId,
        externalCalendarEventUrl,
        contactName: contactName?.trim() || undefined,
        contactEmail: contactEmail?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(meetingData);

      return {
        success: true,
        meetingId: docRef.id,
        meetingLink,
      };
    } catch (dbErr) {
      if (roomResult) {
        rollbackMeetingRoomAsync(roomResult).catch(rollbackErr => {
          console.error('[quickScheduleMeetingAction] Rollback compensation failed:', rollbackErr);
        });
      }
      throw dbErr;
    }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
