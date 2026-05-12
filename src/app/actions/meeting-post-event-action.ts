'use server';

import { adminDb } from '@/lib/firebase-admin';
import { computeScheduledAt } from '@/lib/template-variable-utils';
import type { Meeting, ScheduledMessage, MeetingMessagingConfig } from '@/lib/types';

// ---------------------------------------------------------------------------
// scheduleMeetingPostEvent  (Phase 8)
// ---------------------------------------------------------------------------

/**
 * Schedules post-event follow-up messages for a meeting.
 * Respects messagingConfig.postEventEnabled, postEventDelayMinutes,
 * postEventAudience, and postEventChannels.
 *
 * Called after the meeting is saved/published. The actual sending is handled
 * by the processScheduledMessages() cron.
 */
export async function scheduleMeetingPostEvent(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  orgId: string,
): Promise<void> {
  const config = meeting.messagingConfig;
  if (!config?.postEventEnabled || !meeting.meetingTime) return;

  const channels = config.postEventChannels || [];
  if (channels.length === 0) return;

  // Calculate post-event time: meetingTime + duration + delay
  // Since we don't track duration, use meetingTime + 1 hour (assumed) + delay
  const meetingEnd = new Date(meeting.meetingTime);
  meetingEnd.setHours(meetingEnd.getHours() + 1); // assume 1 hour duration
  const delayMs = (config.postEventDelayMinutes || 60) * 60 * 1000;
  const scheduledAt = new Date(meetingEnd.getTime() + delayMs).toISOString();

  // Skip if already in the past
  if (new Date(scheduledAt) <= new Date()) return;

  // Determine audience
  const audienceFilter = config.postEventAudience === 'attendees_only'
    ? ['attended']
    : ['registered', 'approved', 'attended'];

  // Fetch registrants matching audience
  const regSnap = await adminDb
    .collection('meeting_registrants')
    .where('meetingId', '==', meeting.id)
    .where('status', 'in', audienceFilter)
    .get();

  if (regSnap.empty) return;

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const ch of channels) {
    const templateId = ch === 'email'
      ? config.postEventEmailTemplateId
      : config.postEventSmsTemplateId;

    if (!templateId) continue;

    for (const regDoc of regSnap.docs) {
      const reg = regDoc.data();
      const contact = ch === 'email' ? reg.email : reg.phone;
      if (!contact) continue;

      const docRef = adminDb.collection('scheduled_messages').doc();
      const msg: Omit<ScheduledMessage, 'id'> = {
        organizationId: orgId,
        templateId,
        channel: ch,
        recipientContact: contact,
        variables: {
          meetingId: meeting.id,
          registrantName: reg.name || '',
        },
        scheduledAt,
        status: 'pending',
        reminderType: 'post_event_followup',
        sourceEventId: meeting.id,
        sourceEventType: 'meeting',
        retryCount: 0,
        createdAt: now,
      };
      batch.set(docRef, msg);
    }
  }

  await batch.commit();
}

// ---------------------------------------------------------------------------
// cancelMeetingPostEvent
// ---------------------------------------------------------------------------

/**
 * Cancels any pending post-event follow-up messages for a meeting.
 * Used when the meeting is rescheduled or the post-event config changes.
 */
export async function cancelMeetingPostEvent(meetingId: string): Promise<void> {
  const snap = await adminDb
    .collection('scheduled_messages')
    .where('sourceEventId', '==', meetingId)
    .where('sourceEventType', '==', 'meeting')
    .where('reminderType', '==', 'post_event_followup')
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) return;

  const batch = adminDb.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: 'cancelled' });
  }
  await batch.commit();
}
