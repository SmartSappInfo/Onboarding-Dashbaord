'use server';

import { adminDb } from '@/lib/firebase-admin';
import { generateRegistrantToken } from '@/lib/meeting-tokens';
import { sendRawMessage } from '@/lib/messaging-engine';
import type { WorkspaceEntity } from '@/lib/types';

interface BulkMeetingInviteData {
  entityIds: string[];
  meetingId: string;
  workspaceId: string;
  sendInvites: boolean; // if true, dispatch join email
}

export async function bulkRegisterParticipantsAction(data: BulkMeetingInviteData) {
  try {
    const { entityIds, meetingId, workspaceId, sendInvites } = data;

    if (entityIds.length === 0) {
      return { success: true, count: 0 };
    }

    // 1. Fetch meeting once
    const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
    if (!meetingSnap.exists) {
      throw new Error('Meeting not found');
    }
    const meeting = meetingSnap.data()!;
    const typeSlug = meeting.type?.id || 'meeting';
    const meetingSlug = meeting.meetingSlug || meeting.entitySlug || meetingSnap.id;
    const meetingTitle = meeting.title || 'Onboarding Session';

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding.smartsapp.com';
    const now = new Date().toISOString();
    
    const registrantsRef = adminDb.collection(`meetings/${meetingId}/registrants`);
    const processedResults: { id: string; name: string; email: string; link: string }[] = [];
    const chunkLimit = 450; // Safety limit under 500

    for (let i = 0; i < entityIds.length; i += chunkLimit) {
      const chunk = entityIds.slice(i, i + chunkLimit);
      const batch = adminDb.batch();

      // Fetch workspace entities to get their primary contacts
      const entityRefs = chunk.map(id =>
        adminDb.collection('workspace_entities').doc(`${workspaceId}_${id}`)
      );
      
      const entitySnapshots = await adminDb.getAll(...entityRefs);

      entitySnapshots.forEach(snap => {
        if (!snap.exists) return;
        const entity = snap.data() as WorkspaceEntity;

        const email = entity.primaryEmail?.toLowerCase().trim();
        const name = entity.primaryContactName || entity.displayName || 'Participant';

        if (!email) return; // skip if no email exists

        const token = generateRegistrantToken();
        const personalizedMeetingUrl = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/join?token=${token}`;

        const registrantDocRef = registrantsRef.doc();
        const registrantData = {
          meetingId,
          workspaceIds: [workspaceId],
          token,
          status: 'approved',
          registrationData: { name, email },
          name,
          email,
          phone: '',
          registeredAt: now,
          approvedAt: now,
          personalizedMeetingUrl,
          ...(sendInvites ? { lastInviteSentAt: now } : {}),
        };

        batch.set(registrantDocRef, registrantData);
        processedResults.push({
          id: registrantDocRef.id,
          name,
          email,
          link: personalizedMeetingUrl,
        });
      });

      await batch.commit();
    }

    // 2. Asynchronously Dispatch email invites in parallel chunk batches if requested
    if (sendInvites && processedResults.length > 0) {
      const emailResults = await Promise.allSettled(
        processedResults.map(async (reg) => {
          const subject = `Your Join Link: ${meetingTitle}`;
          const body = `Hello ${reg.name},

You are registered for the upcoming meeting: **${meetingTitle}**.

Please use your unique join link below to access the session:
${reg.link}

We look forward to seeing you there!`;

          return sendRawMessage({
            channel: 'email',
            recipient: reg.email,
            subject,
            body,
            workspaceIds: [workspaceId],
          });
        })
      );

      const failures = emailResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
      console.log(`[bulkRegisterParticipantsAction] Email dispatch finished. Success: ${processedResults.length - failures.length}, Failures: ${failures.length}`);
    }

    return {
      success: true,
      count: processedResults.length,
      message: `Successfully registered ${processedResults.length} participants.${sendInvites ? ' Invitation links have been dispatched.' : ''}`
    };
  } catch (error: any) {
    console.error('[bulkRegisterParticipantsAction] Error:', error);
    return { success: false, error: error.message };
  }
}
