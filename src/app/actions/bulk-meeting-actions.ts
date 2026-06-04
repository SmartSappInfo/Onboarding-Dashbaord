'use server';

import { adminDb } from '@/lib/firebase-admin';
import { generateRegistrantToken, getPersonalizedMeetingUrl } from '@/lib/meeting-tokens';
import { sendRawMessage, sendMessage } from '@/lib/messaging-engine';
import type { WorkspaceEntity, MeetingRegistrant } from '@/lib/types';
import { getBaseUrl, getRequestBaseUrl } from '@/lib/utils/url-helpers';

interface BulkMeetingInviteData {
  entityIds: string[];
  meetingId: string;
  workspaceId: string;
  sendInvites: boolean; // if true, dispatch join alerts
  templateId?: string;
  selectedContactIds?: string[]; // Optional: specific contacts to register
  channels?: ('email' | 'sms')[]; // Optional: active channels to send templates to
}

export async function bulkRegisterParticipantsAction(data: BulkMeetingInviteData) {
  try {
    const { entityIds, meetingId, workspaceId, sendInvites, selectedContactIds, channels } = data;

    if (entityIds.length === 0) {
      return { success: true, count: 0 };
    }

    // 1. Fetch meeting once
    const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
    if (!meetingSnap.exists) {
      throw new Error('Meeting not found');
    }
    const meeting = meetingSnap.data()!;
    let typeSlug = 'parent-engagement';
    if (meeting.type) {
      if (typeof meeting.type === 'string') {
        typeSlug = meeting.type === 'parent' ? 'parent-engagement' : meeting.type;
      } else if (meeting.type.slug) {
        typeSlug = meeting.type.slug === 'parent' ? 'parent-engagement' : meeting.type.slug;
      } else if (meeting.type.id) {
        typeSlug = meeting.type.id === 'parent' ? 'parent-engagement' : meeting.type.id;
      }
    }
    const meetingSlug = meeting.meetingSlug || meeting.entitySlug || meetingSnap.id;
    const meetingTitle = meeting.title || 'Onboarding Session';

    const baseUrl = await getRequestBaseUrl();
    const now = new Date().toISOString();
    
    const registrantsRef = adminDb.collection(`meetings/${meetingId}/registrants`);
    const processedResults: { id: string; entityId: string; name: string; email: string; phone: string; link: string }[] = [];
    const chunkLimit = 450; // Safety limit under 500

    for (let i = 0; i < entityIds.length; i += chunkLimit) {
      const chunk = entityIds.slice(i, i + chunkLimit);
      const batch = adminDb.batch();

      // Fetch core entities to get their canonical contacts list
      const entityRefs = chunk.map(id =>
        adminDb.collection('entities').doc(id)
      );
      
      const entitySnapshots = await adminDb.getAll(...entityRefs);

      entitySnapshots.forEach(snap => {
        if (!snap.exists) return;
        const entity = snap.data() as any;

        // Filter contacts based on user selection or fallback to primary contact
        const contactsToRegister = (entity.entityContacts || []).filter((c: any) => {
          if (selectedContactIds && selectedContactIds.length > 0) {
            return selectedContactIds.includes(c.id);
          }
          return c.isPrimary;
        });

        // If no contacts are explicitly filtered or present, fall back to the primary contact
        if (contactsToRegister.length === 0 && (!selectedContactIds || selectedContactIds.length === 0)) {
          const primary = (entity.entityContacts || []).find((c: any) => c.isPrimary);
          if (primary && primary.email) {
            contactsToRegister.push(primary);
          }
        }

        contactsToRegister.forEach((contact: any) => {
          const email = contact.email?.toLowerCase().trim();
          if (!email) return;

          const name = contact.name || 'Participant';
          const token = generateRegistrantToken();
          const personalizedMeetingUrl = getPersonalizedMeetingUrl(baseUrl, { id: meetingSnap.id, ...meeting } as any, token);

          const registrantDocRef = registrantsRef.doc();
          const registrantData: Omit<MeetingRegistrant, 'id'> = {
            meetingId,
            workspaceIds: [workspaceId],
            entityId: snap.id, // Link back to the core entity ID
            token,
            status: sendInvites ? 'pending' : 'approved',
            registrationData: { name, email },
            name,
            email,
            phone: contact.phone || '',
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
            entityId: registrantData.entityId || '',
            name,
            email,
            phone: contact.phone || '',
            link: personalizedMeetingUrl,
          });
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

      const activeChannels = channels || ['email', 'sms'];
      const sendEmail = activeChannels.includes('email');
      const sendSms = activeChannels.includes('sms');

      const emailResults = await Promise.allSettled(
        processedResults.map(async (reg) => {
          const promises = [];
          
          if (sendEmail) {
            if (emailTemplateId) {
              promises.push(sendMessage({
                templateId: emailTemplateId,
                senderProfileId: 'default',
                recipient: reg.email,
                variables: { _meetingId: meetingId },
                workspaceId,
                entityId: reg.entityId
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
          }

          if (sendSms && smsTemplateId && reg.phone) {
             promises.push(sendMessage({
                templateId: smsTemplateId,
                senderProfileId: 'default',
                recipient: reg.phone,
                variables: { _meetingId: meetingId },
                workspaceId,
                entityId: reg.entityId
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
