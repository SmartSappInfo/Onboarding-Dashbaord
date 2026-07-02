'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getGoogleAuthUrl } from '@/lib/services/integrations/google-calendar';
import { getMicrosoftAuthUrl } from '@/lib/services/integrations/microsoft-teams';
import { getZoomAuthUrl } from '@/lib/services/integrations/zoom-meeting';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server Action to generate Google Calendar auth URL
 */
export async function getGoogleAuthUrlAction(
  workspaceId: string,
  orgId: string
): Promise<ActionResponse<string>> {
  try {
    const url = await getGoogleAuthUrl(workspaceId, orgId);
    return { success: true, data: url };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to generate Google auth URL' 
    };
  }
}

/**
 * Server Action to generate Microsoft Teams auth URL
 */
export async function getMicrosoftAuthUrlAction(
  workspaceId: string,
  orgId: string
): Promise<ActionResponse<string>> {
  try {
    const url = await getMicrosoftAuthUrl(workspaceId, orgId);
    return { success: true, data: url };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to generate Microsoft auth URL' 
    };
  }
}

/**
 * Server Action to generate Zoom auth URL
 */
export async function getZoomAuthUrlAction(
  workspaceId: string,
  orgId: string
): Promise<ActionResponse<string>> {
  try {
    const url = await getZoomAuthUrl(workspaceId, orgId);
    return { success: true, data: url };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to generate Zoom auth URL' 
    };
  }
}

/**
 * Server Action to disconnect a calendar connection
 */
export async function disconnectConnectionAction(
  connectionId: string
): Promise<ActionResponse<void>> {
  try {
    await adminDb.collection('calendar_connections').doc(connectionId).delete();
    return { success: true };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to disconnect connection' 
    };
  }
}

/**
 * Server Action to fetch booking page details by slug
 */
export async function getBookingPageBySlugAction(
  slug: string
): Promise<ActionResponse<BookingPage>> {
  try {
    const snap = await adminDb.collection('booking_pages')
      .where('slug', '==', slug)
      .where('publishStatus', '==', 'published')
      .limit(1)
      .get();
    
    if (snap.empty) {
      return { success: false, error: 'Booking page not found' };
    }
    
    const data = snap.docs[0].data() as BookingPage;
    return { success: true, data };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to retrieve booking page' 
    };
  }
}

export async function getAvailableSlotsAction(
  availabilityId: string,
  dateStr: string,
  durationMinutes?: number
): Promise<ActionResponse<TimeSlot[]>> {
  try {
    const { calculateFreeSlots } = await import('@/lib/services/scheduler/availability');
    const slots = await calculateFreeSlots(availabilityId, dateStr, durationMinutes);
    return { success: true, data: slots };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to calculate slots' 
    };
  }
}

/**
 * Server Action with Firestore Transaction to confirm a slot and create a booking + meeting record.
 * Provisioning video meeting links (Zoom/Google Meet/Teams) inline depending on host connection.
 */
export async function createBookingAction(
  params: {
    bookingPageId: string;
    scheduledTime: string; // ISO String UTC
    visitorName: string;
    visitorEmail: string;
    visitorPhone?: string;
    answers: Record<string, string | string[]>;
  }
): Promise<ActionResponse<string>> {
  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      // 1. Fetch Booking Page
      const pageRef = adminDb.collection('booking_pages').doc(params.bookingPageId);
      const pageDoc = await transaction.get(pageRef);
      if (!pageDoc.exists) {
        throw new Error('Booking page configuration not found');
      }
      const page = pageDoc.data() as BookingPage;

      // 2. Double Booking check inside transaction
      const existingBookingsQuery = adminDb.collection('bookings')
        .where('bookingPageId', '==', params.bookingPageId)
        .where('scheduledTime', '==', params.scheduledTime)
        .where('status', '==', 'confirmed');
      
      const existingBookings = await transaction.get(existingBookingsQuery);
      if (!existingBookings.empty) {
        throw new Error('This slot has already been booked by another user. Please choose a different time.');
      }

      const bookingId = uuidv4();
      const meetingId = uuidv4();
      const now = new Date().toISOString();

      let meetingLink = '';

      // 3. Resolve conferencing integration if configured
      if (page.meetingProvider !== 'PHONE' && page.meetingProvider !== 'IN_PERSON') {
        // Query connections for this workspace
        const connSnap = await adminDb.collection('calendar_connections')
          .where('workspaceId', '==', page.workspaceId)
          .get();
        
        if (page.meetingProvider === 'GOOGLE_MEET') {
          const googleConn = connSnap.docs.find(doc => doc.data().provider === 'google_calendar');
          if (googleConn) {
            const { createGoogleCalendarEvent } = await import('@/lib/services/integrations/google-calendar');
            const endEvent = new Date(new Date(params.scheduledTime).getTime() + page.durationMinutes * 60 * 1000).toISOString();
            const event = await createGoogleCalendarEvent(googleConn.id, {
              title: `${page.title}: ${params.visitorName}`,
              start: params.scheduledTime,
              end: endEvent,
              timezone: 'UTC',
            });
            meetingLink = event.hangoutLink || event.htmlLink;
          }
        } else if (page.meetingProvider === 'MICROSOFT_TEAMS') {
          const msConn = connSnap.docs.find(doc => doc.data().provider === 'microsoft_teams');
          if (msConn) {
            const { createMicrosoftTeamsMeeting } = await import('@/lib/services/integrations/microsoft-teams');
            const endEvent = new Date(new Date(params.scheduledTime).getTime() + page.durationMinutes * 60 * 1000).toISOString();
            const event = await createMicrosoftTeamsMeeting(msConn.id, {
              title: `${page.title}: ${params.visitorName}`,
              start: params.scheduledTime,
              end: endEvent,
            });
            meetingLink = event.joinWebUrl;
          }
        } else if (page.meetingProvider === 'ZOOM') {
          const zoomConn = connSnap.docs.find(doc => doc.data().provider === 'zoom');
          if (zoomConn) {
            const { createZoomMeeting } = await import('@/lib/services/integrations/zoom-meeting');
            const event = await createZoomMeeting(zoomConn.id, {
              topic: `${page.title}: ${params.visitorName}`,
              start: params.scheduledTime,
              durationMinutes: page.durationMinutes,
              timezone: 'UTC',
            });
            meetingLink = event.join_url;
          }
        }
      }

      // Default fallback link if none created
      if (!meetingLink) {
        meetingLink = `${process.env.NEXT_PUBLIC_APP_URL}/meetings/joining/${meetingId}`;
      }

      // 4. Create standard CRM Meeting record
      const crmMeeting: Meeting = {
        id: meetingId,
        title: `${page.title}: ${params.visitorName}`,
        meetingSlug: `book_${bookingId}`,
        workspaceIds: [page.workspaceId],
        meetingTime: params.scheduledTime,
        meetingLink,
        type: { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
        publishStatus: 'published',
        status: 'scheduled',
        durationMinutes: page.durationMinutes,
        organizationId: page.organizationId,
      };
      
      const meetingRef = adminDb.collection('meetings').doc(meetingId);
      transaction.set(meetingRef, crmMeeting);

      // 5. Create Booking record
      const bookingRecord: BookingResponse = {
        id: bookingId,
        bookingPageId: params.bookingPageId,
        organizationId: page.organizationId,
        workspaceId: page.workspaceId,
        visitorName: params.visitorName,
        visitorEmail: params.visitorEmail,
        visitorPhone: params.visitorPhone,
        answers: params.answers,
        scheduledTime: params.scheduledTime,
        durationMinutes: page.durationMinutes,
        meetingId,
        status: 'confirmed',
        createdAt: now,
      };

      const bookingRef = adminDb.collection('bookings').doc(bookingId);
      transaction.set(bookingRef, bookingRecord);

      return bookingId;
    });

    // Proactively trigger reminder schedules outside transaction boundary
    try {
      const meetingSnap = await adminDb.collection('meetings').doc(result).get();
      if (meetingSnap.exists) {
        const { scheduleRemindersForMeeting } = await import('@/lib/reminder-actions');
        // Enable default reminder notifications (e.g. 1 hour, 1 day before)
        await scheduleRemindersForMeeting(
          meetingSnap.data() as Meeting, 
          ['meeting_reminder_1hour', 'meeting_reminder_1day'], 
          params.visitorEmail
        );
      }
    } catch {
      // Non-blocking fallback if background reminders trigger fails
    }

    return { success: true, data: result };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Booking creation failed' 
    };
  }
}

/**
 * Server Action to save or update a Booking Page configuration template.
 */
export async function saveBookingPageAction(
  page: Omit<BookingPage, 'createdAt' | 'updatedAt'>
): Promise<ActionResponse<string>> {
  try {
    const now = new Date().toISOString();
    const docRef = adminDb.collection('booking_pages').doc(page.id);
    const existingDoc = await docRef.get();

    const record: BookingPage = {
      ...page,
      createdAt: existingDoc.exists ? (existingDoc.data()?.createdAt as string) : now,
      updatedAt: now,
    };

    await docRef.set(record, { merge: true });
    return { success: true, data: page.id };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to save booking page configuration' 
    };
  }
}

/**
 * Server Action to delete a Booking Page.
 */
export async function deleteBookingPageAction(
  id: string
): Promise<ActionResponse<void>> {
  try {
    await adminDb.collection('booking_pages').doc(id).delete();
    return { success: true };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to delete booking page' 
    };
  }
}

/**
 * Server Action to ensure a default Working Schedule availability document exists for a workspace.
 * Resolves standard 9AM - 5PM, Monday through Friday, in local Timezone.
 */
export async function ensureWorkspaceAvailabilityAction(
  workspaceId: string,
  orgId: string,
  userId: string
): Promise<ActionResponse<string>> {
  try {
    const docRef = adminDb.collection('user_availabilities').doc(workspaceId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      return { success: true, data: workspaceId };
    }

    const defaultSchedule: WorkingDay[] = [
      { day: 'monday', slots: [{ start: '09:00', end: '17:00' }] },
      { day: 'tuesday', slots: [{ start: '09:00', end: '17:00' }] },
      { day: 'wednesday', slots: [{ start: '09:00', end: '17:00' }] },
      { day: 'thursday', slots: [{ start: '09:00', end: '17:00' }] },
      { day: 'friday', slots: [{ start: '09:00', end: '17:00' }] },
    ];

    const availabilityRecord: UserAvailability = {
      id: workspaceId,
      organizationId: orgId,
      workspaceId,
      userId,
      weeklySchedule: defaultSchedule,
      timezone: 'America/New_York',
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 10,
      minimumNoticeHours: 4,
      maximumNoticeDays: 30,
    };

    await docRef.set(availabilityRecord);
    return { success: true, data: workspaceId };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to provision default availability' 
    };
  }
}

export interface TimeSlot {
  start: string;
  end: string;
}

import type { BookingPage, BookingResponse, WorkingDay, UserAvailability, Meeting } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';


