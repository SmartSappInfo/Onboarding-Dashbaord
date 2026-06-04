'use server';

import { adminDb } from '@/lib/firebase-admin';
import { sendMessage } from '@/lib/messaging-engine';
import { resolveActiveTemplate } from '@/lib/template-resolver';
import { getRequestBaseUrl } from '@/lib/utils/url-helpers';
import { buildMeetingBaseVariables, buildFacilitatorVariables } from '@/lib/meeting-variable-helpers';
import { MeetingFacilitator, Meeting, MeetingMessagingConfig } from '@/lib/types';

export async function resendFacilitatorLinksAction(
  meetingId: string,
  meetingTitle: string,
  facilitators: MeetingFacilitator[],
  workspaceId: string
) {
  try {
    // 1. Fetch meeting configuration
    const meetingDoc = await adminDb.collection('meetings').doc(meetingId).get();
    if (!meetingDoc.exists) {
      throw new Error('Meeting not found.');
    }
    const meetingData = { id: meetingDoc.id, ...meetingDoc.data() } as Meeting;
    const orgId = meetingData.organizationId || 'default';
    const msgConfig = (meetingData.messagingConfig || {}) as MeetingMessagingConfig;

    // 2. Determine enabled channels (defaulting to email)
    const channels = msgConfig.facilitatorChannels || ['email'];
    const sendEmail = channels.includes('email');
    const sendSms = channels.includes('sms');

    // 3. Resolve templates for the pre-event briefing
    let emailTemplateId = msgConfig.facilitatorRemindersEmailTemplateId;
    let smsTemplateId = msgConfig.facilitatorRemindersSmsTemplateId;

    if (sendEmail && !emailTemplateId) {
      try {
        const tpl = await resolveActiveTemplate('meeting_facilitator_pre_event', orgId, 'email');
        emailTemplateId = tpl.id;
      } catch (err) {
        console.warn('[resendFacilitatorLinksAction] Email template fallback not resolved:', err);
      }
    }

    if (sendSms && !smsTemplateId) {
      try {
        const tpl = await resolveActiveTemplate('meeting_facilitator_pre_event', orgId, 'sms');
        smsTemplateId = tpl.id;
      } catch (err) {
        console.warn('[resendFacilitatorLinksAction] SMS template fallback not resolved:', err);
      }
    }

    if (!emailTemplateId && !smsTemplateId) {
      throw new Error('No template resolved for facilitator briefing.');
    }

    const baseUrl = await getRequestBaseUrl();
    const meetingVars = buildMeetingBaseVariables(meetingData);

    // 4. Send messages to facilitators
    const results = await Promise.allSettled(
      facilitators.map(async (fac) => {
        const dispatches: Promise<any>[] = [];

        // Build variables specifically for this facilitator (with full join link resolved)
        const facilitatorVars = buildFacilitatorVariables(fac, meetingData, baseUrl);

        if (sendEmail && emailTemplateId && fac.email) {
          dispatches.push(
            sendMessage({
              templateId: emailTemplateId,
              senderProfileId: 'default',
              recipient: fac.email,
              variables: {
                ...meetingVars,
                ...facilitatorVars,
              },
              workspaceId,
            }).then((res) => {
              if (!res.success) throw new Error(res.error || 'Email send failed');
              return 'email';
            })
          );
        }

        if (sendSms && smsTemplateId && fac.phone) {
          dispatches.push(
            sendMessage({
              templateId: smsTemplateId,
              senderProfileId: 'default',
              recipient: fac.phone,
              variables: {
                ...meetingVars,
                ...facilitatorVars,
              },
              workspaceId,
            }).then((res) => {
              if (!res.success) throw new Error(res.error || 'SMS send failed');
              return 'sms';
            })
          );
        }

        if (dispatches.length === 0) {
          throw new Error(`Facilitator ${fac.name} has no matching contact info or template configured.`);
        }

        await Promise.all(dispatches);
        return { facilitatorId: fac.id, success: true };
      })
    );

    const successes = results.filter((r) => r.status === 'fulfilled').length;
    const failures = results.filter((r) => r.status === 'rejected').length;

    return {
      success: failures === 0,
      message: `Sent briefing notifications successfully to ${successes} facilitator(s).${failures > 0 ? ` ${failures} failed.` : ''}`
    };
  } catch (error: any) {
    console.error('[Facilitator Actions] Error resending links:', error);
    return { success: false, message: error.message };
  }
}

export async function updateMeetingFacilitatorAction(
  meetingId: string,
  facilitatorId: string,
  updates: { name: string; bio: string; image?: string }
) {
  try {
    const meetingRef = adminDb.collection('meetings').doc(meetingId);
    const meetingSnap = await meetingRef.get();
    if (!meetingSnap.exists) {
      throw new Error('Meeting not found.');
    }
    const meetingData = meetingSnap.data() as Meeting;
    const facilitators = meetingData.facilitators || [];

    const index = facilitators.findIndex((f) => f.id === facilitatorId);
    if (index === -1) {
      throw new Error('Facilitator not found in this meeting.');
    }

    // Update fields inside the array
    facilitators[index] = {
      ...facilitators[index],
      name: updates.name,
      bio: updates.bio,
      image: updates.image !== undefined ? updates.image : facilitators[index].image,
    };

    await meetingRef.update({ facilitators });
    return { success: true };
  } catch (error: any) {
    console.error('[updateMeetingFacilitatorAction] Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function logFacilitatorAttendance(
  meetingId: string,
  facilitatorId: string,
  metadata: {
    name: string;
    token: string;
    entityId?: string;
  }
) {
  try {
    const now = new Date().toISOString();
    
    const existingAttendeeSnap = await adminDb
      .collection('attendees')
      .where('meetingId', '==', meetingId)
      .where('registrantId', '==', facilitatorId)
      .limit(1)
      .get();

    if (existingAttendeeSnap.empty) {
      await adminDb.collection('attendees').add({
        meetingId,
        entityId: metadata.entityId || '',
        parentName: metadata.name,
        childrenNames: [],
        joinedAt: now,
        registrantId: facilitatorId,
        registrantToken: metadata.token,
        role: 'facilitator',
      });
    } else {
      const docId = existingAttendeeSnap.docs[0].id;
      await adminDb.collection('attendees').doc(docId).update({
        lastRejoinedAt: now,
      });
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[logFacilitatorAttendance] Failed:', error);
    return { success: false, error: error.message };
  }
}
