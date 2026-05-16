'use server';

import { adminDb } from '@/lib/firebase-admin';
import { generateRegistrantToken } from '@/lib/meeting-tokens';
import { sendRawMessage } from '@/lib/messaging-engine';

export async function deleteRegistrantAction(meetingId: string, registrantId: string) {
  try {
    await adminDb.collection(`meetings/${meetingId}/registrants`).doc(registrantId).delete();
    return { success: true };
  } catch (error: any) {
    console.error('[deleteRegistrantAction]', error);
    return { success: false, error: error.message };
  }
}

export async function updateRegistrantStatusAction(meetingId: string, registrantId: string, newStatus: string) {
  try {
    await adminDb.collection(`meetings/${meetingId}/registrants`).doc(registrantId).update({
      status: newStatus,
      ...(newStatus === 'approved' ? { approvedAt: new Date().toISOString() } : {}),
      ...(newStatus === 'cancelled' ? { cancelledAt: new Date().toISOString() } : {})
    });
    return { success: true };
  } catch (error: any) {
    console.error('[updateRegistrantStatusAction]', error);
    return { success: false, error: error.message };
  }
}

export async function sendRegistrantJoinLinkAction(
  meetingId: string,
  meetingTitle: string,
  registrants: { id: string; name: string; email?: string; personalizedMeetingUrl?: string }[],
  workspaceId: string
) {
  try {
    const results = await Promise.allSettled(
      registrants.map(async (reg) => {
        if (!reg.email) {
          throw new Error(`Registrant ${reg.name} has no email address.`);
        }
        if (!reg.personalizedMeetingUrl) {
          throw new Error(`Registrant ${reg.name} has no join link.`);
        }

        const subject = `Your Join Link: ${meetingTitle}`;
        const body = `
Hello ${reg.name},

You are registered for the upcoming meeting: **${meetingTitle}**.

Please use your unique join link below to access the session:
${reg.personalizedMeetingUrl}

We look forward to seeing you there!
`;

        const res = await sendRawMessage({
          channel: 'email',
          recipient: reg.email,
          subject,
          body,
          workspaceIds: [workspaceId]
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to send email');
        }

        // Update last invite sent
        await adminDb.collection(`meetings/${meetingId}/registrants`).doc(reg.id).update({
          lastInviteSentAt: new Date().toISOString()
        });

        return { id: reg.id, success: true };
      })
    );

    const successes = results.filter((r) => r.status === 'fulfilled').length;
    const failures = results.filter((r) => r.status === 'rejected').length;

    return {
      success: failures === 0,
      message: `Sent ${successes} emails successfully. ${failures > 0 ? `${failures} failed.` : ''}`
    };
  } catch (error: any) {
    console.error('[sendRegistrantJoinLinkAction]', error);
    return { success: false, message: error.message };
  }
}

export async function adminRegisterParticipantAction(
  meetingId: string,
  formData: { name: string; email: string; phone?: string }
) {
  try {
    const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
    if (!meetingSnap.exists) {
      throw new Error('Meeting not found');
    }
    const meeting = meetingSnap.data()!;

    const registrantsRef = adminDb.collection(`meetings/${meetingId}/registrants`);

    // Basic Dedup Check
    const userEmail = formData.email.toLowerCase().trim();
    if (userEmail) {
      const q = await registrantsRef.where('email', '==', userEmail).limit(1).get();
      if (!q.empty) {
        throw new Error('User with this email is already registered.');
      }
    }

    const token = generateRegistrantToken();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding.smartsapp.com';
    const typeSlug = meeting.type?.id || 'meeting';
    const meetingSlug = meeting.meetingSlug || meeting.entitySlug || meetingSnap.id;
    const personalizedMeetingUrl = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/join?token=${token}`;

    const now = new Date().toISOString();

    const registrantData = {
      meetingId,
      workspaceIds: meeting.workspaceIds || [],
      token,
      status: 'approved', // Admin registration defaults to approved
      registrationData: formData,
      name: formData.name,
      email: userEmail,
      phone: formData.phone || '',
      registeredAt: now,
      approvedAt: now,
      personalizedMeetingUrl,
    };

    const docRef = await registrantsRef.add(registrantData);

    return { success: true, registrantId: docRef.id };
  } catch (error: any) {
    console.error('[adminRegisterParticipantAction]', error);
    return { success: false, error: error.message };
  }
}
