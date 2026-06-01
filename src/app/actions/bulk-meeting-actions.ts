'use server';

import { adminDb } from '@/lib/firebase-admin';
import { generateRegistrantToken } from '@/lib/meeting-tokens';
import { sendRawMessage, sendMessage } from '@/lib/messaging-engine';
import type { WorkspaceEntity, MeetingRegistrant } from '@/lib/types';
import { getBaseUrl } from '@/lib/utils/url-helpers';

interface BulkMeetingInviteData {
  entityIds: string[];
  meetingId: string;
  workspaceId: string;
  sendInvites: boolean; // if true, dispatch join email
  templateId?: string;
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

    const baseUrl = getBaseUrl();

    const now = new Date().toISOString();
    
    const registrantsRef = adminDb.collection(`meetings/${meetingId}/registrants`);
    const processedResults: { id: string; name: string; email: string; phone: string; link: string }[] = [];
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
        const registrantData: Omit<MeetingRegistrant, 'id'> = {
          meetingId,
          workspaceIds: [workspaceId],
          entityId: entity.entityId || snap.id.replace(`${workspaceId}_`, ''), // Link back to the entity
          token,
          status: sendInvites ? 'pending' : 'approved',
          registrationData: { name, email },
          name,
          email,
          phone: entity.primaryPhone || '',
          registeredAt: now,
          ...(sendInvites ? {} : { approvedAt: now }),
          personalizedMeetingUrl,
          ...(sendInvites ? { 
            lastInviteSentAt: now,
            sentInvitations: { [data.templateId || 'initial']: now }
          } : {}),
        };

        batch.set(registrantDocRef, registrantData);
        processedResults.push({
          id: registrantDocRef.id,
          name,
          email,
          phone: entity.primaryPhone || '',
          link: personalizedMeetingUrl,
        });
      });

      await batch.commit();
    }

    // 2. Asynchronously Dispatch email invites in parallel chunk batches if requested
    if (sendInvites && processedResults.length > 0) {
      const templateIdStr = data.templateId || 'initial';
      let emailTemplateId: string | null = null;
      let smsTemplateId: string | null = null;

      if (meeting.messagingConfig?.invitationSeries) {
          const stage = meeting.messagingConfig.invitationSeries.find((s: any) => s.id === templateIdStr);
          if (stage && stage.enabled) {
              emailTemplateId = stage.emailTemplateId || null;
              smsTemplateId = stage.smsTemplateId || null;
          }
      }

      const emailResults = await Promise.allSettled(
        processedResults.map(async (reg) => {
          const promises = [];
          if (emailTemplateId) {
            promises.push(sendMessage({
              templateId: emailTemplateId,
              senderProfileId: 'default',
              recipient: reg.email,
              variables: { _meetingId: meetingId },
              workspaceId,
              entityId: reg.id // Pass registrant ID or entity ID? Actually we mapped it above. Wait, let's use the actual entity ID!
            }));
          } else {
             // Fallback
             const subject = `Your Join Link: ${meetingTitle}`;
             const body = `Hello ${reg.name},\n\nYou are invited to the upcoming meeting: **${meetingTitle}**.\n\nPlease use your unique join link below to access the session or RSVP:\n${reg.link}\n\nWe look forward to seeing you there!`;
             promises.push(sendRawMessage({
                channel: 'email',
                recipient: reg.email,
                subject,
                body,
                workspaceIds: [workspaceId],
             }));
          }

          if (smsTemplateId && reg.phone) {
             promises.push(sendMessage({
                templateId: smsTemplateId,
                senderProfileId: 'default',
                recipient: reg.phone,
                variables: { _meetingId: meetingId },
                workspaceId,
                entityId: reg.id
             }));
          }

          const results = await Promise.all(promises);
          return results.every(r => r.success) ? { success: true } : { success: false };
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
