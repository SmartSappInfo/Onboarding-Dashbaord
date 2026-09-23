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
 * 
 * NOTE (Senior Architectural Remediation C-1):
 * - Zoom and standalone video rooms are provisioned prior to the transaction in generateMeetingRoom.
 * - This service pushes an event to the host's actual connected CALENDAR (Google Calendar or Microsoft Outlook).
 * - Zoom is a video provider, NOT a calendar destination. We never call createZoomMeeting here,
 *   preventing duplicate Zoom meeting generation on host accounts.
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

    // Resolve calendar connection using 3-tier fallback (Host Primary -> Host General -> Workspace System)
    let connection: CalendarConnection | null = null;

    if (booking.locationType === 'google_meet') {
      connection = await resolveWorkspaceConnection(booking.workspaceId, 'google_calendar', hostUserId);
    } else {
      // For Zoom, Teams, phone, in-person, or custom:
      // Push an event to host's primary connected calendar (Google Calendar or Microsoft Outlook)
      connection = (await resolveWorkspaceConnection(booking.workspaceId, 'google_calendar', hostUserId))
        || (await resolveWorkspaceConnection(booking.workspaceId, 'microsoft_outlook', hostUserId));
    }

    if (!connection) {
      // No external calendar configured; room is already provisioned or offline
      return { success: true };
    }

    const connectionId = connection.id;
    const bookerName = `${booking.booker?.firstName || ''} ${booking.booker?.lastName || ''}`.trim() || 'Invitee';
    const bookerEmail = booking.booker?.email?.trim() || '';
    const joinUrl = booking.joinUrl || '';

    // Validate email format to prevent upstream API 400 rejection
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookerEmail);

    let syncResult: CalendarSyncResult = { success: false };

    if (connection.provider === 'google_calendar') {
      const isMeetLocation = booking.locationType === 'google_meet';
      const gEvent = await createGoogleCalendarEvent(connectionId, {
        title: booking.eventTypeName || 'SmartSapp Meeting',
        description: `Meeting with ${bookerName} (${bookerEmail}).${joinUrl ? ` Join URL: ${joinUrl}` : ''}`,
        location: joinUrl || undefined,
        start: booking.startAt,
        end: booking.endAt,
        timezone: booking.timezone || 'UTC',
        attendees: isValidEmail ? [{ email: bookerEmail, displayName: bookerName }] : undefined,
        // Only provision Google Meet conferencing if the location type is explicitly google_meet;
        // otherwise retain the existing video URL (e.g. Zoom) without competing conferences.
        createMeetConference: isMeetLocation,
      });
      syncResult = {
        success: true,
        externalEventId: gEvent.id,
        externalEventUrl: gEvent.htmlLink,
        meetLink: gEvent.hangoutLink,
      };
    } else if (connection.provider === 'microsoft_outlook' || (connection.provider as string) === 'microsoft_teams') {
      const isTeamsLocation = booking.locationType === 'teams' || (booking.locationType as string) === 'microsoft_teams';
      syncResult = await createMicrosoftCalendarEvent(connectionId, {
        title: booking.eventTypeName || 'SmartSapp Meeting',
        description: `<p>Meeting with <strong>${bookerName}</strong> (${bookerEmail})</p>${joinUrl ? `<p>Join URL: <a href="${joinUrl}">${joinUrl}</a></p>` : ''}`,
        location: joinUrl || undefined,
        start: booking.startAt,
        end: booking.endAt,
        timezone: booking.timezone || 'UTC',
        attendeeEmail: isValidEmail ? bookerEmail : undefined,
        attendeeName: bookerName,
        isOnlineMeeting: isTeamsLocation,
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
