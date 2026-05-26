'use server';

import { adminDb } from '@/lib/firebase-admin';

interface AttendanceResult {
  success: boolean;
  error?: string;
}

/**
 * Logs a meeting attendance event when a registrant transitions from 
 * the Waiting Room to the actual meeting link.
 * 
 * This is triggered ONLY on redirect — landing on the join page alone
 * does NOT count as attendance.
 */
export async function logMeetingAttendance(
  meetingId: string,
  registrantId: string,
  metadata: {
    registrantName: string;
    registrantToken: string;
    entityId?: string;
    childrenNames?: string[];
  }
): Promise<AttendanceResult> {
  try {
    const now = new Date().toISOString();

    // 1. Update registrant status to 'attended'
    const registrantRef = adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('registrants')
      .doc(registrantId);

    const registrantSnap = await registrantRef.get();
    const registrantData = registrantSnap.data();

    await registrantRef.update({
      status: 'attended',
      attendedAt: now,
    });

    const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
    const meeting = meetingSnap.data();
    const workspaceId = meeting?.workspaceIds?.[0] || '';
    if (workspaceId) {
      const { emitMeetingRegistrantActivity } = await import('@/lib/meeting-automation-events');
      void emitMeetingRegistrantActivity({
        type: 'meeting_registrant_attended',
        organizationId: meeting?.organizationId || 'default',
        workspaceId,
        meetingId,
        registrantId,
        entityId: metadata.entityId || registrantData?.entityId,
        registrantName: metadata.registrantName,
        meetingTypeId: meeting?.type?.id,
      });
    }

    // 2. Create an attendee record for reporting
    await adminDb.collection('attendees').add({
      meetingId,
      entityId: metadata.entityId || '',
      parentName: metadata.registrantName,
      childrenNames: metadata.childrenNames || [],
      joinedAt: now,
      registrantId,
      registrantToken: metadata.registrantToken,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[logMeetingAttendance] Failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validates a registrant token against the database.
 * Returns the registrant data if valid, null otherwise.
 */
export async function validateRegistrantToken(
  meetingId: string,
  token: string
): Promise<{
  valid: boolean;
  registrant?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    status: string;
    token: string;
    registeredAt: string;
    attendedAt?: string;
    registrationData: Record<string, any>;
  };
}> {
  try {
    const registrantsRef = adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('registrants');
    
    const snapshot = await registrantsRef
      .where('token', '==', token)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { valid: false };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      valid: true,
      registrant: {
        id: doc.id,
        name: data.name || '',
        email: data.email,
        phone: data.phone,
        status: data.status,
        token: data.token,
        registeredAt: data.registeredAt,
        attendedAt: data.attendedAt,
        registrationData: data.registrationData || {},
      },
    };
  } catch (error: any) {
    console.error('[validateRegistrantToken] Failed:', error);
    return { valid: false };
  }
}

/**
 * Manually toggles a registrant's attendance status from the admin UI.
 */
export async function toggleRegistrantAttendance(
  meetingId: string,
  registrantId: string,
  attended: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const registrantRef = adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('registrants')
      .doc(registrantId);

    const registrantSnap = await registrantRef.get();
    const registrantData = registrantSnap.data();
    const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
    const meeting = meetingSnap.data();
    const workspaceId = meeting?.workspaceIds?.[0] || '';

    await registrantRef.update({
      status: attended ? 'attended' : 'no_show',
      attendedAt: attended ? new Date().toISOString() : null,
    });

    if (workspaceId) {
      const { emitMeetingRegistrantActivity } = await import('@/lib/meeting-automation-events');
      void emitMeetingRegistrantActivity({
        type: attended ? 'meeting_registrant_attended' : 'meeting_registrant_no_show',
        organizationId: meeting?.organizationId || 'default',
        workspaceId,
        meetingId,
        registrantId,
        entityId: registrantData?.entityId,
        registrantName: registrantData?.name,
        meetingTypeId: meeting?.type?.id,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('[toggleRegistrantAttendance] Failed:', error);
    return { success: false, error: error.message };
  }
}

