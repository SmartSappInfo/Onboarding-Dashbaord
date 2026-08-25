'use server';

/**
 * @fileoverview Server Actions for Calendar Connections & 2-Way Calendar Synchronization.
 * Supports Google Calendar and Microsoft Outlook / Office 365.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All token encryption happens prior to database persistence.
 * - External calendar calls are isolated and non-blocking for core database mutations.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { CalendarConnection, CalendarSyncResult } from '@/lib/meetings/types/calendar';
import type { Booking, EventType } from '@/lib/meetings/types';
import { createGoogleCalendarEvent } from '@/lib/services/integrations/google-calendar';
import { createMicrosoftCalendarEvent } from '@/lib/services/integrations/microsoft-calendar';
import { logMeetingActivity } from '@/lib/meetings/activity-logger';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Retrieves all calendar connections for the active workspace and user.
 */
export async function getCalendarConnectionsAction(
  workspaceId: string,
  userId?: string
): Promise<{ success: boolean; connections?: CalendarConnection[]; error?: string }> {
  try {
    let query = adminDb
      .collection('calendar_connections')
      .where('workspaceId', '==', workspaceId);

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snap = await query.get();
    const connections: CalendarConnection[] = snap.docs.map(doc => {
      const data = doc.data() as CalendarConnection;
      // Do not return raw tokens to client; mask for security
      return {
        ...data,
        id: doc.id,
        accessToken: '***',
        refreshToken: '***',
      };
    });

    return { success: true, connections };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Disconnects and deletes an external calendar connection.
 */
export async function disconnectCalendarConnectionAction(
  connectionId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('calendar_connections').doc(connectionId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error('Calendar connection not found.');
    }

    const data = snap.data() as CalendarConnection;
    if (data.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    await docRef.delete();
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Toggles whether this calendar connection is queried for Free/Busy conflicts.
 */
export async function toggleCalendarConflictCheckAction(
  connectionId: string,
  checkConflicts: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await adminDb.collection('calendar_connections').doc(connectionId).update({
      checkConflicts,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Sets a specific calendar connection as the primary destination for pushing new bookings.
 */
export async function setPrimarySyncCalendarAction(
  connectionId: string,
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const batch = adminDb.batch();

    // Reset all user's calendars in workspace to isPrimaryDestination: false
    const existingSnap = await adminDb
      .collection('calendar_connections')
      .where('workspaceId', '==', workspaceId)
      .where('userId', '==', userId)
      .get();

    existingSnap.docs.forEach(doc => {
      batch.update(doc.ref, { isPrimaryDestination: false, updatedAt: new Date().toISOString() });
    });

    // Mark targeted connection as primary
    const targetRef = adminDb.collection('calendar_connections').doc(connectionId);
    batch.update(targetRef, { isPrimaryDestination: true, updatedAt: new Date().toISOString() });

    await batch.commit();
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Pushes a confirmed booking as an event to the host's primary connected calendar.
 */
export async function syncBookingToExternalCalendarAction(
  bookingId: string
): Promise<CalendarSyncResult> {
  try {
    const bookingDoc = await adminDb.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return { success: false, error: 'Booking not found.' };
    }

    const booking = bookingDoc.data() as Booking;
    const hostUserId = booking.hostUserId;

    if (!hostUserId) {
      return { success: false, error: 'Booking has no assigned host.' };
    }

    // Find host's primary calendar connection
    const connSnap = await adminDb
      .collection('calendar_connections')
      .where('workspaceId', '==', booking.workspaceId)
      .where('userId', '==', hostUserId)
      .where('isPrimaryDestination', '==', true)
      .limit(1)
      .get();

    if (connSnap.empty) {
      // No primary external calendar configured; nothing to sync
      return { success: true };
    }

    const connection = connSnap.docs[0].data() as CalendarConnection;
    const connectionId = connSnap.docs[0].id;

    const bookerName = `${booking.booker?.firstName || ''} ${booking.booker?.lastName || ''}`.trim() || 'Invitee';
    const bookerEmail = booking.booker?.email || '';
    const joinUrl = booking.joinUrl || '';

    let syncResult: CalendarSyncResult = { success: false };

    if (connection.provider === 'google_calendar') {
      const gEvent = await createGoogleCalendarEvent(connectionId, {
        title: booking.eventTypeName || 'SmartSapp Meeting',
        description: `Meeting with ${bookerName} (${bookerEmail}). Join URL: ${joinUrl}`,
        start: booking.startAt,
        end: booking.endAt,
        timezone: booking.timezone || 'UTC',
      });
      syncResult = {
        success: true,
        externalEventId: gEvent.id,
        externalEventUrl: gEvent.htmlLink,
        meetLink: gEvent.hangoutLink,
      };
    } else if (connection.provider === 'microsoft_outlook') {
      syncResult = await createMicrosoftCalendarEvent(connectionId, {
        title: booking.eventTypeName || 'SmartSapp Meeting',
        description: `<p>Meeting with <strong>${bookerName}</strong> (${bookerEmail})</p><p>Join URL: <a href="${joinUrl}">${joinUrl}</a></p>`,
        start: booking.startAt,
        end: booking.endAt,
        timezone: booking.timezone || 'UTC',
        attendeeEmail: bookerEmail,
        attendeeName: bookerName,
      });
    }

    if (syncResult.success && syncResult.externalEventId) {
      await adminDb.collection('bookings').doc(bookingId).update({
        externalCalendarEventId: syncResult.externalEventId,
        externalCalendarEventUrl: syncResult.externalEventUrl,
        updatedAt: new Date().toISOString(),
      });

      if (booking.meetingId) {
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
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Generates Google Calendar OAuth authorization URL.
 */
export async function getGoogleAuthUrlAction(
  workspaceId: string,
  organizationId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { getGoogleAuthUrl } = await import('@/lib/services/integrations/google-calendar');
    const url = await getGoogleAuthUrl(workspaceId, organizationId);
    return { success: true, url };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Generates Microsoft Calendar OAuth authorization URL.
 */
export async function getMicrosoftAuthUrlAction(
  workspaceId: string,
  organizationId?: string,
  userId?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { getMicrosoftAuthUrl } = await import('@/lib/services/integrations/microsoft-calendar');
    const url = await getMicrosoftAuthUrl(workspaceId, organizationId, userId);
    return { success: true, url };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
