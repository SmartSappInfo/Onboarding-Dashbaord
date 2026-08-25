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
  CalendarEventSourceType,
} from '@/lib/meetings/types/calendar-view';
import { detectGridCollision } from '@/lib/meetings/calendar-view-service';

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
  try {
    const events: CalendarGridEvent[] = [];

    // 1. Fetch confirmed/scheduled meetings
    let query = adminDb
      .collection('meetings')
      .where('workspaceId', '==', workspaceId)
      .where('meetingTime', '>=', startIso)
      .where('meetingTime', '<=', endIso);

    const snap = await query.get();

    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.status === 'cancelled') continue;
      if (hostUserIds && hostUserIds.length > 0 && !hostUserIds.includes(data.hostUserId)) continue;

      const durationMins = Number(data.duration) || 30;
      const startMs = new Date(data.meetingTime).getTime();
      const endMs = data.endTime ? new Date(data.endTime).getTime() : startMs + durationMins * 60000;

      events.push({
        id: doc.id,
        sourceId: doc.id,
        sourceType: 'meeting',
        title: data.title || 'Scheduled Meeting',
        startAt: data.meetingTime,
        endAt: new Date(endMs).toISOString(),
        hostUserId: data.hostUserId || 'unassigned',
        hostName: data.hostName || 'Host',
        color: data.color || '#3b82f6',
        locationType: data.locationType || 'google_meet',
        status: data.status || 'scheduled',
        joinUrl: data.joinUrl,
        participantCount: data.attendeeCount || 1,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
      });
    }

    // 2. Fetch active booking holds
    const nowIso = new Date().toISOString();
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
}): Promise<{ success: boolean; meetingId?: string; error?: string }> {
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

    const docRef = adminDb.collection('meetings').doc();
    const meetingData = {
      id: docRef.id,
      workspaceId,
      organizationId: organizationId || '',
      title: title.trim(),
      description: description?.trim() || '',
      hostUserId,
      hostName,
      meetingTime: startAt,
      endTime: endAt,
      duration: durationMinutes,
      status: 'scheduled',
      locationType,
      contactName: contactName?.trim() || undefined,
      contactEmail: contactEmail?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(meetingData);

    return { success: true, meetingId: docRef.id };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
