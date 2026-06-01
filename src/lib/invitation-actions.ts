'use server';

import { adminDb } from './firebase-admin';
import { sendMessage } from './messaging-engine';
import { MeetingRegistrant, Meeting, MeetingInvitationSlot } from './types';

import { getInvitationOffsetMinutes, calculateChannelTriggerTime } from './invitation-utils';

/**
 * Processes automated meeting invitations for 'pending' registrants based on the
 * meeting's messagingConfig.invitationSeries.
 * Evaluates the conditions (e.g., '1_week', '1_day') against the meetingTime
 * and sends the appropriate template if it hasn't been sent yet.
 */
export async function processMeetingInvitations(): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // Fetch only active/upcoming meetings (or meetings within the last 24 hours)
    // to avoid scanning historic meetings or collectionGroup queries.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const meetingsSnap = await adminDb.collection('meetings')
      .where('meetingTime', '>=', cutoff)
      .get();

    if (meetingsSnap.empty) {
      return { sent, skipped, failed };
    }

    const orgTimezones = new Map<string, string>();

    // Process each meeting
    for (const meetingDoc of meetingsSnap.docs) {
      const meetingId = meetingDoc.id;
      const meeting = meetingDoc.data() as Meeting;
      const config = meeting.messagingConfig;

      // Skip meetings where scheduled invitations are disabled or not set
      if (!config?.invitationsEnabled || !config.invitationSeries || config.invitationSeries.length === 0 || !meeting.meetingTime) {
        continue;
      }

      // Skip cancelled or ended meetings
      if (meeting.status === 'cancelled' || meeting.status === 'ended') {
        continue;
      }

      const meetingTime = new Date(meeting.meetingTime);

      // Fetch pending registrants for this specific meeting subcollection
      const pendingSnap = await adminDb.collection(`meetings/${meetingId}/registrants`)
        .where('status', '==', 'pending')
        .get();

      if (pendingSnap.empty) {
        continue;
      }

      // Resolve organization's default timezone
      const orgId = meeting.organizationId || 'default';
      let timezone = 'UTC';
      if (orgTimezones.has(orgId)) {
        timezone = orgTimezones.get(orgId)!;
      } else {
        try {
          const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
          if (orgSnap.exists) {
            timezone = orgSnap.data()?.settings?.defaultTimezone || 'UTC';
          }
          orgTimezones.set(orgId, timezone);
        } catch (err) {
          console.warn(`[processMeetingInvitations] Failed to fetch organization timezone for org ${orgId}:`, err);
        }
      }

      // Process registrants for this meeting
      for (const doc of pendingSnap.docs) {
        const regData = doc.data() as MeetingRegistrant;
        let sentAny = false;

        // Sort all enabled stages by offset ascending (closest to meeting first)
        const enabledStages = config.invitationSeries
          .filter(stage => stage.enabled)
          .sort((a, b) => getInvitationOffsetMinutes(a.id) - getInvitationOffsetMinutes(b.id));

        for (const stage of enabledStages) {
          const emailTriggerTime = calculateChannelTriggerTime(meetingTime, stage, 'email', timezone);
          const smsTriggerTime = calculateChannelTriggerTime(meetingTime, stage, 'sms', timezone);

          const emailDue = emailTriggerTime <= now;
          const smsDue = smsTriggerTime <= now;

          const emailKey = `${stage.id}_email`;
          const smsKey = `${stage.id}_sms`;

          // Track what we need to send
          const promises = [];

          const canSendEmail = stage.channels.includes('email') && 
                               stage.emailTemplateId && 
                               regData.email && 
                               emailDue && 
                               !regData.sentInvitations?.[emailKey] &&
                               !regData.sentInvitations?.[stage.id]; // legacy check

          const canSendSms = stage.channels.includes('sms') && 
                             stage.smsTemplateId && 
                             regData.phone && 
                             smsDue && 
                             !regData.sentInvitations?.[smsKey] &&
                             !regData.sentInvitations?.[stage.id]; // legacy check

          if (canSendEmail) {
            promises.push(sendMessage({
              templateId: stage.emailTemplateId!,
              senderProfileId: 'default',
              recipient: regData.email!,
              variables: { _meetingId: meetingId },
              workspaceId: regData.workspaceIds?.[0],
              entityId: regData.entityId
            }).then(res => ({ channel: 'email', success: res.success })));
          }

          if (canSendSms) {
            promises.push(sendMessage({
              templateId: stage.smsTemplateId!,
              senderProfileId: 'default',
              recipient: regData.phone!,
              variables: { _meetingId: meetingId },
              workspaceId: regData.workspaceIds?.[0],
              entityId: regData.entityId
            }).then(res => ({ channel: 'sms', success: res.success })));
          }

          if (promises.length > 0) {
            const results = await Promise.allSettled(promises);
            let emailSuccess = false;
            let smsSuccess = false;

            results.forEach(r => {
              if (r.status === 'fulfilled' && r.value.success) {
                if (r.value.channel === 'email') emailSuccess = true;
                if (r.value.channel === 'sms') smsSuccess = true;
              }
            });

            if (emailSuccess || smsSuccess) {
              sentAny = true;
              const updateData: Record<string, any> = {
                lastInviteSentAt: nowIso
              };
              if (emailSuccess) {
                updateData[`sentInvitations.${emailKey}`] = nowIso;
                sent++;
              }
              if (smsSuccess) {
                updateData[`sentInvitations.${smsKey}`] = nowIso;
                sent++;
              }
              await doc.ref.update(updateData);
            } else {
              failed += promises.length;
            }

            // Only send one stage per run to avoid spamming if they just got added
            break;
          }
        }

        if (!sentAny) {
          skipped++;
        }
      }
    }

    return { sent, skipped, failed };
  } catch (error) {
    console.error('[processMeetingInvitations] Error:', error);
    throw error;
  }
}
