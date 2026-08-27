'use server';

/**
 * @fileoverview Server Actions for Meetings 2.0 Booking Engine & Concurrency Holds.
 * Implements atomic slot holds, booking creation, Meeting materialization, CRM capture,
 * automated reminders, calendar invite dispatching, and self-service reschedule/cancel.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Double booking protection relies on atomic Firestore transaction holds in acquireBookingHoldAction.
 * - Do not remove the hold expiration check in createBookingFromHoldAction.
 * - All timestamps must be ISO 8601 UTC.
 */

import { adminDb } from '@/lib/firebase-admin';
import { createHash, randomBytes } from 'crypto';
import type {
  EventType,
  AvailabilityProfile,
  Booking,
  BookingHold,
  BookerInfo,
  PublicBookingPageData,
  AvailableSlot,
  HostPublicProfile,
} from '@/lib/meetings/types';
import { getAvailableSlotsForRange, isSlotConflicting } from '@/lib/meetings/scheduling-engine';
import { generateIcsContent, getGoogleCalendarUrl, getOutlookCalendarUrl } from '@/lib/meetings/ics-helpers';
import { createEntityFromRegistration } from '@/app/actions/meeting-lead-capture-action';
import { sendEmail } from '@/lib/resend-service';
import { scheduleRemindersForNewRegistrant } from '@/lib/reminder-actions';

/**
 * Helper to compute SHA-256 hash of a string.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Helper to safely extract error message without using any.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Resolves all required public page data for an Event Type by its public URL slug.
 */
export async function getPublicBookingPageDataAction(
  slug: string
): Promise<{ success: boolean; data?: PublicBookingPageData; error?: string }> {
  try {
    const cleanSlug = slug.toLowerCase().trim();

    // 1. Fetch Event Type by slug
    const eventTypesSnap = await adminDb
      .collection('event_types')
      .where('slug', '==', cleanSlug)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (eventTypesSnap.empty) {
      return { success: false, error: 'Event type not found or is inactive.' };
    }

    const eventDoc = eventTypesSnap.docs[0];
    const eventType = { id: eventDoc.id, ...eventDoc.data() } as EventType;

    // 2. Fetch Availability Profile (custom or default for the workspace)
    let availabilityProfile: AvailabilityProfile | null = null;

    if (eventType.availabilityProfileId) {
      const availSnap = await adminDb
        .collection('availability_profiles')
        .doc(eventType.availabilityProfileId)
        .get();

      if (availSnap.exists) {
        availabilityProfile = { id: availSnap.id, ...availSnap.data() } as AvailabilityProfile;
      }
    }

    if (!availabilityProfile) {
      // Fall back to default profile for workspace
      const defaultAvailSnap = await adminDb
        .collection('availability_profiles')
        .where('workspaceId', '==', eventType.workspaceId)
        .where('isDefault', '==', true)
        .limit(1)
        .get();

      if (!defaultAvailSnap.empty) {
        availabilityProfile = {
          id: defaultAvailSnap.docs[0].id,
          ...defaultAvailSnap.docs[0].data(),
        } as AvailabilityProfile;
      }
    }

    if (!availabilityProfile) {
      // Return a safe fallback standard Monday-Friday profile if not found
      availabilityProfile = {
        id: 'fallback-default',
        workspaceId: eventType.workspaceId,
        organizationId: eventType.organizationId,
        name: 'Standard Working Hours',
        timezone: 'UTC',
        isDefault: true,
        weeklyRules: [
          { dayOfWeek: 1, intervals: [{ start: '09:00', end: '17:00' }], isAvailable: true },
          { dayOfWeek: 2, intervals: [{ start: '09:00', end: '17:00' }], isAvailable: true },
          { dayOfWeek: 3, intervals: [{ start: '09:00', end: '17:00' }], isAvailable: true },
          { dayOfWeek: 4, intervals: [{ start: '09:00', end: '17:00' }], isAvailable: true },
          { dayOfWeek: 5, intervals: [{ start: '09:00', end: '17:00' }], isAvailable: true },
          { dayOfWeek: 6, intervals: [], isAvailable: false },
          { dayOfWeek: 0, intervals: [], isAvailable: false },
        ],
        overrides: [],
        minimumNoticeMinutes: 120,
        maximumBookingHorizonDays: 30,
        defaultBufferBeforeMinutes: 0,
        defaultBufferAfterMinutes: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // 3. Fetch Host User Profile if configured
    let hostProfile: HostPublicProfile | undefined;
    if (eventType.hostUserId) {
      const userSnap = await adminDb.collection('users').doc(eventType.hostUserId).get();
      if (userSnap.exists) {
        const userData = userSnap.data()!;
        hostProfile = {
          id: userSnap.id,
          name: userData.displayName || userData.name || userData.email || 'Session Host',
          email: userData.email || '',
          avatarUrl: userData.photoURL || userData.avatarUrl || '',
          role: userData.role || 'Host',
          bio: userData.bio || '',
        };
      }
    }

    // 4. Fetch Workspace branding
    let workspaceName: string | undefined;
    let workspaceLogo: string | undefined;
    if (eventType.workspaceId) {
      const wsSnap = await adminDb.collection('workspaces').doc(eventType.workspaceId).get();
      if (wsSnap.exists) {
        const wsData = wsSnap.data()!;
        workspaceName = wsData.name || '';
        workspaceLogo = wsData.logoUrl || '';
      }
    }

    return {
      success: true,
      data: {
        eventType,
        availabilityProfile,
        hostProfile,
        workspaceName,
        workspaceLogo,
      },
    };
  } catch (error) {
    console.error('[getPublicBookingPageDataAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Computes available slots for an Event Type over a given date range.
 */
export async function getAvailableSlotsAction(params: {
  eventTypeId: string;
  startDate: string;
  endDate: string;
  visitorTimezone: string;
}): Promise<{ success: boolean; slots?: Record<string, AvailableSlot[]>; error?: string }> {
  try {
    const { eventTypeId, startDate, endDate, visitorTimezone } = params;

    // 1. Fetch event type
    const eventDoc = await adminDb.collection('event_types').doc(eventTypeId).get();
    if (!eventDoc.exists) {
      return { success: false, error: 'Event type not found.' };
    }
    const eventType = { id: eventDoc.id, ...eventDoc.data() } as EventType;

    // 2. Fetch linked availability profile
    let availabilityProfile: AvailabilityProfile | null = null;
    if (eventType.availabilityProfileId) {
      const availSnap = await adminDb
        .collection('availability_profiles')
        .doc(eventType.availabilityProfileId)
        .get();
      if (availSnap.exists) {
        availabilityProfile = { id: availSnap.id, ...availSnap.data() } as AvailabilityProfile;
      }
    }

    if (!availabilityProfile) {
      const defaultAvailSnap = await adminDb
        .collection('availability_profiles')
        .where('workspaceId', '==', eventType.workspaceId)
        .where('isDefault', '==', true)
        .limit(1)
        .get();

      if (!defaultAvailSnap.empty) {
        availabilityProfile = {
          id: defaultAvailSnap.docs[0].id,
          ...defaultAvailSnap.docs[0].data(),
        } as AvailabilityProfile;
      }
    }

    if (!availabilityProfile) {
      return { success: false, error: 'No availability schedule configured.' };
    }

    // 3. Fetch confirmed bookings in window
    const bookingsSnap = await adminDb
      .collection('bookings')
      .where('eventTypeId', '==', eventTypeId)
      .where('status', 'in', ['confirmed', 'held'])
      .get();

    const existingBookings = bookingsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        startAt: d.startAt as string,
        endAt: d.endAt as string,
      };
    });

    // 4. Fetch active unexpired holds
    const now = new Date();
    const holdsSnap = await adminDb
      .collection('booking_holds')
      .where('eventTypeId', '==', eventTypeId)
      .where('status', '==', 'active')
      .get();

    const activeHolds = holdsSnap.docs
      .map(doc => {
        const d = doc.data();
        return {
          startAt: d.startAt as string,
          endAt: d.endAt as string,
          expiresAt: d.expiresAt as string,
        };
      })
      .filter(h => new Date(h.expiresAt).getTime() > now.getTime());

    // 5. Fetch External Calendar Conflicts if host has connected calendars
    const externalBusyIntervals: Array<{ start: string; end: string }> = [];
    if (eventType.hostUserId) {
      try {
        const connectionsSnap = await adminDb
          .collection('calendar_connections')
          .where('workspaceId', '==', eventType.workspaceId)
          .where('userId', '==', eventType.hostUserId)
          .where('checkConflicts', '==', true)
          .get();

        for (const connDoc of connectionsSnap.docs) {
          const conn = connDoc.data() as { provider?: string; status?: string };
          if (conn.status === 'connected') {
            if (conn.provider === 'google_calendar') {
              const { queryGoogleFreeBusy } = await import('@/lib/services/integrations/google-calendar');
              const gBusy = await queryGoogleFreeBusy(connDoc.id, `${startDate}T00:00:00Z`, `${endDate}T23:59:59Z`);
              externalBusyIntervals.push(...gBusy);
            } else if (conn.provider === 'microsoft_outlook') {
              const { queryMicrosoftFreeBusy } = await import('@/lib/services/integrations/microsoft-calendar');
              const mBusy = await queryMicrosoftFreeBusy(connDoc.id, `${startDate}T00:00:00Z`, `${endDate}T23:59:59Z`);
              externalBusyIntervals.push(...mBusy);
            }
          }
        }
      } catch (calErr) {
        console.warn('[getAvailableSlotsAction] External calendar query fallback:', calErr);
      }
    }

    // 6. Run pure scheduling engine
    const slots = getAvailableSlotsForRange({
      eventType,
      availabilityProfile,
      startDate,
      endDate,
      visitorTimezone,
      existingBookings,
      activeHolds,
      externalBusyIntervals,
      now,
    });

    return { success: true, slots };
  } catch (error) {
    console.error('[getAvailableSlotsAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Acquires an atomic 5-minute lock (BookingHold) on a specific slot to prevent double-booking collisions.
 */
export async function acquireBookingHoldAction(input: {
  eventTypeId: string;
  startAt: string;
  endAt: string;
  sessionId: string;
}): Promise<{ success: boolean; holdId?: string; expiresAt?: string; error?: string }> {
  try {
    const { eventTypeId, startAt, endAt, sessionId } = input;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString(); // 5 minutes TTL

    const slotStart = new Date(startAt);
    const slotEnd = new Date(endAt);

    // Fetch event type for workspaceId
    const eventDoc = await adminDb.collection('event_types').doc(eventTypeId).get();
    if (!eventDoc.exists) {
      return { success: false, error: 'Event type not found.' };
    }
    const eventType = eventDoc.data() as EventType;

    const holdDocRef = adminDb.collection('booking_holds').doc();

    // Run atomic transaction to ensure slot has no collision
    await adminDb.runTransaction(async tx => {
      // 1. Check existing confirmed bookings
      const bookingsQuery = adminDb
        .collection('bookings')
        .where('eventTypeId', '==', eventTypeId)
        .where('status', 'in', ['confirmed', 'held']);

      const bookingsSnap = await tx.get(bookingsQuery);
      const bookedIntervals = bookingsSnap.docs.map(d => ({
        start: new Date(d.data().startAt),
        end: new Date(d.data().endAt),
      }));

      // 2. Check active holds
      const holdsQuery = adminDb
        .collection('booking_holds')
        .where('eventTypeId', '==', eventTypeId)
        .where('status', '==', 'active');

      const holdsSnap = await tx.get(holdsQuery);
      for (const hDoc of holdsSnap.docs) {
        const hData = hDoc.data() as BookingHold;
        if (new Date(hData.expiresAt).getTime() > now.getTime() && hData.sessionId !== sessionId) {
          bookedIntervals.push({
            start: new Date(hData.startAt),
            end: new Date(hData.endAt),
          });
        }
      }

      // Check conflict
      if (isSlotConflicting(slotStart, slotEnd, bookedIntervals, 0, 0)) {
        throw new Error('This time slot is no longer available. Please select another slot.');
      }

      // Write new hold
      const newHold: BookingHold = {
        id: holdDocRef.id,
        workspaceId: eventType.workspaceId,
        organizationId: eventType.organizationId,
        eventTypeId,
        schedulingProfileId: eventType.schedulingProfileId,
        hostUserId: eventType.hostUserId,
        startAt,
        endAt,
        sessionId,
        expiresAt,
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      tx.set(holdDocRef, newHold);
    });

    return {
      success: true,
      holdId: holdDocRef.id,
      expiresAt,
    };
  } catch (error) {
    console.error('[acquireBookingHoldAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Finalizes the reservation: converts hold into confirmed Booking, materializes Meeting record,
 * links CRM contact, and triggers confirmation communications.
 */
export async function createBookingFromHoldAction(input: {
  holdId: string;
  sessionId: string;
  booker: BookerInfo;
  visitorTimezone: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  bookingId?: string;
  manageToken?: string;
  joinUrl?: string;
  error?: string;
}> {
  try {
    const { holdId, sessionId, booker, visitorTimezone, idempotencyKey } = input;
    const now = new Date();

    const holdDocRef = adminDb.collection('booking_holds').doc(holdId);
    const bookingDocRef = adminDb.collection('bookings').doc();
    const meetingDocRef = adminDb.collection('meetings').doc();

    const rawManageToken = randomBytes(24).toString('hex');
    const manageTokenHash = hashToken(rawManageToken);

    let eventType: EventType;
    let finalBooking: Booking;

    // Run transaction to convert hold and create booking
    await adminDb.runTransaction(async tx => {
      const holdSnap = await tx.get(holdDocRef);
      if (!holdSnap.exists) {
        throw new Error('Booking hold not found or has expired.');
      }

      const holdData = holdSnap.data() as BookingHold;

      if (holdData.status !== 'active') {
        throw new Error('This booking reservation has already been completed or cancelled.');
      }

      if (new Date(holdData.expiresAt).getTime() < now.getTime()) {
        throw new Error('Your reservation hold has expired. Please re-select a time slot.');
      }

      if (holdData.sessionId !== sessionId) {
        throw new Error('Invalid booking session.');
      }

      // Fetch Event Type
      const eventDoc = await tx.get(adminDb.collection('event_types').doc(holdData.eventTypeId));
      if (!eventDoc.exists) {
        throw new Error('Event type not found.');
      }
      eventType = { id: eventDoc.id, ...eventDoc.data() } as EventType;

      // Determine Join Link
      let joinUrl = eventType.locationDetails || '';
      if (eventType.locationType === 'google_meet' && !joinUrl) {
        joinUrl = `https://meet.google.com/new`;
      }

      finalBooking = {
        id: bookingDocRef.id,
        workspaceId: holdData.workspaceId,
        organizationId: holdData.organizationId,
        eventTypeId: holdData.eventTypeId,
        eventTypeName: eventType.name,
        schedulingProfileId: holdData.schedulingProfileId,
        hostUserId: holdData.hostUserId,
        meetingId: meetingDocRef.id,
        booker,
        startAt: holdData.startAt,
        endAt: holdData.endAt,
        timezone: visitorTimezone,
        locationType: eventType.locationType,
        locationDetails: eventType.locationDetails,
        joinUrl,
        status: 'confirmed',
        bookingSource: 'booking_page',
        manageTokenHash,
        idempotencyKey,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      // 1. Create Booking document
      tx.set(bookingDocRef, finalBooking);

      // 2. Mark Hold as converted
      tx.update(holdDocRef, {
        status: 'converted',
        updatedAt: now.toISOString(),
      });

      // 3. Materialize Meeting Document for full platform parity
      tx.set(meetingDocRef, {
        id: meetingDocRef.id,
        title: `${eventType.name} with ${booker.firstName} ${booker.lastName}`,
        meetingSlug: `booking-${bookingDocRef.id}`,
        workspaceIds: [holdData.workspaceId],
        organizationId: holdData.organizationId,
        meetingTime: holdData.startAt,
        meetingLink: joinUrl,
        durationMinutes: eventType.durationMinutes,
        type: {
          id: eventType.id,
          name: eventType.name,
          slug: eventType.slug,
          description: eventType.description || '',
          isCustom: true,
        },
        publishStatus: 'published',
        status: 'scheduled',
        registrationEnabled: true,
        autoTags: eventType.autoTags || [],
        autoAutomations: eventType.autoAutomations || [],
        createdAt: now.toISOString(),
      });
    });

    // ── Post-Transaction Async Operations (Supervised & Non-blocking) ──

    // 1. CRM Lead Capture
    if (booker.email || booker.phone) {
      createEntityFromRegistration({
        meetingId: meetingDocRef.id,
        workspaceId: finalBooking!.workspaceId,
        organizationId: finalBooking!.organizationId,
        registrantId: bookingDocRef.id,
        registrationData: {
          name: `${booker.firstName} ${booker.lastName}`.trim(),
          email: booker.email,
          phone: booker.phone,
          notes: booker.notes,
          ...(booker.customResponses || {}),
        },
        entityMapping: {
          nameField: 'name',
          emailField: 'email',
          phoneField: 'phone',
        },
        autoTags: eventType!.autoTags || [],
        autoAutomations: eventType!.autoAutomations || [],
      }).catch(err => {
        console.warn('[createBookingFromHoldAction] CRM capture warning:', err?.message);
      });
    }

    // 2. Dispatch Confirmation Email with .ICS Calendar Attachment
    if (booker.email) {
      const icsContent = generateIcsContent({
        title: `${eventType!.name} - SmartSapp`,
        description: `Booking with ${booker.firstName} ${booker.lastName}.\nLocation: ${finalBooking!.joinUrl || 'Online'}`,
        location: finalBooking!.joinUrl,
        startAt: finalBooking!.startAt,
        endAt: finalBooking!.endAt,
        attendeeName: `${booker.firstName} ${booker.lastName}`.trim(),
        attendeeEmail: booker.email,
      });

      sendEmail({
        to: booker.email,
        subject: `Confirmed: ${eventType!.name}`,
        html: `<p>Hello ${booker.firstName},</p><p>Your booking for <strong>${eventType!.name}</strong> has been confirmed.</p><p><strong>Time:</strong> ${new Date(finalBooking!.startAt).toLocaleString()}</p><p><strong>Join Link:</strong> <a href="${finalBooking!.joinUrl}">${finalBooking!.joinUrl}</a></p>`,
        attachments: [
          {
            filename: 'invite.ics',
            content: Buffer.from(icsContent).toString('base64'),
            type: 'text/calendar',
          },
        ],
      }).catch(err => {
        console.warn('[createBookingFromHoldAction] Confirmation email warning:', err?.message);
      });
    }

    // 3. Background 2-Way External Calendar Sync
    try {
      const { syncBookingToExternalCalendarAction } = await import('./calendar-connection-actions');
      syncBookingToExternalCalendarAction(bookingDocRef.id).catch(err => {
        console.warn('[createBookingFromHoldAction] Background external calendar sync error:', err);
      });
    } catch (syncErr) {
      console.warn('[createBookingFromHoldAction] Sync trigger failed:', syncErr);
    }

    return {
      success: true,
      bookingId: bookingDocRef.id,
      manageToken: rawManageToken,
      joinUrl: finalBooking!.joinUrl,
    };
  } catch (error) {
    console.error('[createBookingFromHoldAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Self-service or administrative booking cancellation.
 */
export async function cancelBookingAction(input: {
  bookingId: string;
  manageToken?: string;
  reason?: string;
  cancelledBy?: 'host' | 'attendee' | 'system';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { bookingId, manageToken, reason, cancelledBy } = input;
    const now = new Date().toISOString();

    const bookingRef = adminDb.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return { success: false, error: 'Booking not found.' };
    }

    const booking = bookingSnap.data() as Booking;

    if (booking.status === 'cancelled') {
      return { success: true };
    }

    // Verify manage token if provided
    if (manageToken && booking.manageTokenHash) {
      if (hashToken(manageToken) !== booking.manageTokenHash) {
        return { success: false, error: 'Unauthorized to cancel this booking.' };
      }
    }

    // 1. Update Booking status
    await bookingRef.update({
      status: 'cancelled',
      cancellationReason: reason || (cancelledBy === 'host' ? 'Cancelled by host' : 'Cancelled by attendee'),
      cancelledBy: cancelledBy || 'attendee',
      cancelledAt: now,
      updatedAt: now,
    });

    // 2. Update materialized Meeting status if present
    if (booking.meetingId) {
      await adminDb
        .collection('meetings')
        .doc(booking.meetingId)
        .update({
          status: 'cancelled',
          updatedAt: now,
        })
        .catch(() => {});
    }

    return { success: true };
  } catch (error) {
    console.error('[cancelBookingAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Self-service or administrative booking rescheduling.
 */
export async function rescheduleBookingAction(input: {
  bookingId: string;
  newHoldId: string;
  sessionId: string;
  manageToken?: string;
  reason?: string;
}): Promise<{ success: boolean; newStartAt?: string; error?: string }> {
  try {
    const { bookingId, newHoldId, sessionId, manageToken, reason } = input;
    const now = new Date();

    const bookingRef = adminDb.collection('bookings').doc(bookingId);
    const holdRef = adminDb.collection('booking_holds').doc(newHoldId);

    let newStartAt = '';
    let newEndAt = '';

    await adminDb.runTransaction(async tx => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw new Error('Original booking not found.');

      const booking = bookingSnap.data() as Booking;

      // Verify token
      if (manageToken && booking.manageTokenHash) {
        if (hashToken(manageToken) !== booking.manageTokenHash) {
          throw new Error('Unauthorized to reschedule this booking.');
        }
      }

      const holdSnap = await tx.get(holdRef);
      if (!holdSnap.exists) throw new Error('New reservation hold expired or invalid.');

      const holdData = holdSnap.data() as BookingHold;
      if (holdData.status !== 'active' || new Date(holdData.expiresAt).getTime() < now.getTime()) {
        throw new Error('New reservation hold has expired. Please re-select a time.');
      }

      if (holdData.sessionId !== sessionId) {
        throw new Error('Invalid session.');
      }

      newStartAt = holdData.startAt;
      newEndAt = holdData.endAt;

      // 1. Update Booking record
      tx.update(bookingRef, {
        startAt: newStartAt,
        endAt: newEndAt,
        status: 'confirmed',
        rescheduledAt: now.toISOString(),
        rescheduledFromId: bookingId,
        cancellationReason: reason || null,
        updatedAt: now.toISOString(),
      });

      // 2. Mark new hold as converted
      tx.update(holdRef, {
        status: 'converted',
        updatedAt: now.toISOString(),
      });

      // 3. Update materialized Meeting record
      if (booking.meetingId) {
        tx.update(adminDb.collection('meetings').doc(booking.meetingId), {
          meetingTime: newStartAt,
          updatedAt: now.toISOString(),
        });
      }
    });

    return { success: true, newStartAt };
  } catch (error) {
    console.error('[rescheduleBookingAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
