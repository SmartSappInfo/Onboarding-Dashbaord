/**
 * Calendar Synchronization Service (SSOT)
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - This is a pure server-side service module (NO 'use server' directive).
 * - It must NOT be exported directly as a public RPC endpoint.
 * - Callers in server actions (like syncBookingToExternalCalendarAction) must perform
 *   workspace authorization checks (requireWorkspace) before invoking this service.
 * - Public booking workflows (like createBookingFromHoldAction) can invoke this safely
 *   in background after atomic transaction confirmation.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Booking } from '@/lib/meetings/types';
import type { CalendarConnection } from '@/lib/types';
import { resolveWorkspaceConnection } from './meeting-provider-service';
import { createGoogleCalendarEvent } from '@/lib/services/integrations/google-calendar';
import { createZoomMeeting } from '@/lib/services/integrations/zoom-meeting';
import { createMicrosoftCalendarEvent } from '@/lib/services/integrations/microsoft-calendar';
import { logMeetingActivity } from '@/lib/meetings/activity-logger';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export interface CalendarSyncResult {
  success: boolean;
  externalEventId?: string;
  externalEventUrl?: string;
  meetLink?: string;
  error?: string;
}

/**
 * Internal system engine to push a confirmed booking as an event to the host's connected calendar.
 * Can be safely invoked by internal server tasks on public bookings without active user sessions.
 */
export async function syncBookingToExternalCalendar(
  bookingId: string
): Promise<CalendarSyncResult> {
  if (!bookingId || typeof bookingId !== 'string') {
    return { success: false, error: 'Invalid booking ID provided.' };
  }

  try {
    const bookingDoc = await adminDb.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return { success: false, error: 'Booking not found.' };
    }

    const booking = { id: bookingDoc.id, ...bookingDoc.data() } as Booking;

    // If external calendar event was already created during booking provisioning, do not duplicate
    if (booking.externalCalendarEventId) {
      return {
        success: true,
        externalEventId: booking.externalCalendarEventId,
        externalEventUrl: booking.externalCalendarEventUrl,
      };
    }

    const hostUserId = booking.hostUserId;

    // Resolve connection using 3-tier fallback (Host Primary -> Host General -> Workspace System)
    let connection: CalendarConnection | null = null;

    if (booking.locationType === 'google_meet') {
      connection = await resolveWorkspaceConnection(booking.workspaceId, 'google_calendar', hostUserId);
    } else if (booking.locationType === 'zoom') {
      connection = await resolveWorkspaceConnection(booking.workspaceId, 'zoom', hostUserId);
    } else if (booking.locationType === 'teams') {
      connection = await resolveWorkspaceConnection(booking.workspaceId, 'microsoft_teams', hostUserId);
    }

    // If no specific conferencing connection match, check if host has any primary calendar destination
    if (!connection) {
      connection = (await resolveWorkspaceConnection(booking.workspaceId, 'google_calendar', hostUserId))
        || (await resolveWorkspaceConnection(booking.workspaceId, 'microsoft_outlook', hostUserId));
    }

    if (!connection) {
      // No external calendar configured; nothing to sync
      return { success: true };
    }

    const connectionId = connection.id;
    const bookerName = `${booking.booker?.firstName || ''} ${booking.booker?.lastName || ''}`.trim() || 'Invitee';
    const bookerEmail = booking.booker?.email?.trim() || '';
    const joinUrl = booking.joinUrl || '';

    // Validate email format to prevent upstream API 400 rejection
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookerEmail);

    // Calculate duration with NaN guard
    const startMs = new Date(booking.startAt).getTime();
    const endMs = new Date(booking.endAt).getTime();
    const durationMinutes = (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs)
      ? Math.max(15, Math.round((endMs - startMs) / 60000))
      : 30;

    let syncResult: CalendarSyncResult = { success: false };

    if (connection.provider === 'google_calendar') {
      const gEvent = await createGoogleCalendarEvent(connectionId, {
        title: booking.eventTypeName || 'SmartSapp Meeting',
        description: `Meeting with ${bookerName} (${bookerEmail}). Join URL: ${joinUrl}`,
        start: booking.startAt,
        end: booking.endAt,
        timezone: booking.timezone || 'UTC',
        attendees: isValidEmail ? [{ email: bookerEmail, displayName: bookerName }] : undefined,
      });
      syncResult = {
        success: true,
        externalEventId: gEvent.id,
        externalEventUrl: gEvent.htmlLink,
        meetLink: gEvent.hangoutLink,
      };
    } else if (connection.provider === 'zoom') {
      const zMeeting = await createZoomMeeting(connectionId, {
        topic: booking.eventTypeName || 'SmartSapp Meeting',
        start: booking.startAt,
        durationMinutes,
        timezone: booking.timezone || 'UTC',
      });
      syncResult = {
        success: true,
        externalEventId: String(zMeeting.id),
        externalEventUrl: zMeeting.start_url,
        meetLink: zMeeting.join_url,
      };
    } else if (connection.provider === 'microsoft_outlook' || (connection.provider as string) === 'microsoft_teams') {
      syncResult = await createMicrosoftCalendarEvent(connectionId, {
        title: booking.eventTypeName || 'SmartSapp Meeting',
        description: `<p>Meeting with <strong>${bookerName}</strong> (${bookerEmail})</p><p>Join URL: <a href="${joinUrl}">${joinUrl}</a></p>`,
        start: booking.startAt,
        end: booking.endAt,
        timezone: booking.timezone || 'UTC',
        attendeeEmail: isValidEmail ? bookerEmail : undefined,
        attendeeName: bookerName,
      });
    }

    if (syncResult.success && syncResult.externalEventId) {
      const updateData: Record<string, string> = {
        externalCalendarEventId: syncResult.externalEventId,
        externalCalendarEventUrl: syncResult.externalEventUrl || '',
        updatedAt: new Date().toISOString(),
      };

      if (syncResult.meetLink && (!booking.joinUrl || booking.joinUrl.endsWith('/new'))) {
        updateData.joinUrl = syncResult.meetLink;
      }

      await adminDb.collection('bookings').doc(bookingId).update(updateData);

      if (booking.meetingId) {
        const meetingUpdate: Record<string, string> = {
          updatedAt: new Date().toISOString(),
        };
        if (syncResult.meetLink && (!booking.joinUrl || booking.joinUrl.endsWith('/new'))) {
          meetingUpdate.meetingLink = syncResult.meetLink;
        }
        await adminDb.collection('meetings').doc(booking.meetingId).update(meetingUpdate);

        await logMeetingActivity({
          workspaceId: booking.workspaceId,
          meetingId: booking.meetingId,
          actorType: 'system',
          type: 'meeting_created',
          description: `Synced event to host's ${connection.provider} calendar`,
        });
      }
    }

    return syncResult;
  } catch (err) {
    console.error('[syncBookingToExternalCalendar] Sync error:', err);
    return { success: false, error: getErrorMessage(err) };
  }
}
