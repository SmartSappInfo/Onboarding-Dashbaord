'use server';

import { adminDb } from './firebase-admin';
import { resolveAndRender } from './template-resolver';
import { sendMessage } from './messaging-engine';
import { computeScheduledAt } from './template-variable-utils';
import type { Meeting, ScheduledMessage, TemplateCategory, MeetingMessagingConfig, MeetingReminderSlot } from './types';
import { REMINDER_OFFSETS } from './types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Maps a reminder type string to its offset in minutes. */
const REMINDER_TYPE_TO_OFFSET: Record<string, number> = {
  meeting_reminder_15min:   REMINDER_OFFSETS.FIFTEEN_MINUTES.offsetMinutes,
  meeting_reminder_1hour:   REMINDER_OFFSETS.ONE_HOUR.offsetMinutes,
  meeting_reminder_2hours:  REMINDER_OFFSETS.TWO_HOURS.offsetMinutes,
  meeting_reminder_1day:    REMINDER_OFFSETS.ONE_DAY.offsetMinutes,
  meeting_time_up:          REMINDER_OFFSETS.TIME_UP.offsetMinutes,
};

// ---------------------------------------------------------------------------
// scheduleRemindersForMeeting
// ---------------------------------------------------------------------------

/**
 * Creates ScheduledMessage documents in Firestore for each enabled reminder
 * type. Fetches the meeting's entity contacts to determine recipients.
 */
export async function scheduleRemindersForMeeting(
  meeting: Meeting,
  enabledTypes: string[],
  orgId: string,
): Promise<void> {
  if (!meeting.meetingTime || enabledTypes.length === 0) return;

  // Resolve recipients from the entity linked to the meeting
  const recipients: Array<{ contact: string; entityId?: string }> = [];

  if (meeting.entityId) {
    const entitySnap = await adminDb.collection('entities').doc(meeting.entityId).get();
    if (entitySnap.exists) {
      const entity = entitySnap.data()!;
      const contacts: any[] = entity.entityContacts ?? [];
      for (const c of contacts) {
        if (c.email) recipients.push({ contact: c.email, entityId: meeting.entityId });
        else if (c.phone) recipients.push({ contact: c.phone, entityId: meeting.entityId });
      }
    }
  }

  if (recipients.length === 0) return;

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const reminderType of enabledTypes) {
    const offsetMinutes = REMINDER_TYPE_TO_OFFSET[reminderType];
    if (offsetMinutes === undefined) continue;

    const scheduledAt = computeScheduledAt(meeting.meetingTime, offsetMinutes);

    // Skip reminders that are already in the past
    if (new Date(scheduledAt) <= new Date()) continue;

    // Resolve the template to get templateId and channel
    let templateId: string | undefined;
    let channel: 'email' | 'sms' = 'email';
    try {
      const template = await resolveAndRender(
        'reminders' as TemplateCategory,
        reminderType,
        orgId,
        { meetingId: meeting.id, entityId: meeting.entityId },
      );
      // We need the raw template for the ID — re-query to get it
      const { resolveTemplateForOrg } = await import('./template-resolver');
      const tpl = await resolveTemplateForOrg('reminders' as TemplateCategory, reminderType, orgId);
      templateId = tpl.id;
      channel = (tpl.channel === 'email' || tpl.channel === 'sms') ? tpl.channel : 'email';
      void template; // used for side-effect validation only
    } catch {
      // No template found for this reminder type — skip
      continue;
    }

    for (const { contact, entityId } of recipients) {
      // Only send email reminders to email addresses and SMS to phone numbers
      const isEmail = contact.includes('@');
      if ((channel === 'email' && !isEmail) || (channel === 'sms' && isEmail)) continue;

      const docRef = adminDb.collection('scheduled_messages').doc();
      const msg: Omit<ScheduledMessage, 'id'> = {
        organizationId: orgId,
        templateId: templateId!,
        channel,
        recipientContact: contact,
        recipientEntityId: entityId,
        variables: { meetingId: meeting.id },
        scheduledAt,
        status: 'pending',
        reminderType,
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
// cancelRemindersForMeeting
// ---------------------------------------------------------------------------

/**
 * Sets status to 'cancelled' for all pending ScheduledMessage docs linked
 * to the given meeting.
 */
export async function cancelRemindersForMeeting(meetingId: string): Promise<void> {
  const snap = await adminDb
    .collection('scheduled_messages')
    .where('sourceEventId', '==', meetingId)
    .where('sourceEventType', '==', 'meeting')
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) return;

  const batch = adminDb.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: 'cancelled' });
  }
  await batch.commit();
}

// ---------------------------------------------------------------------------
// rescheduleRemindersForMeeting
// ---------------------------------------------------------------------------

/**
 * Cancels all existing pending reminders for a meeting and re-creates them
 * based on the updated meeting time. Preserves the same reminder types.
 */
export async function rescheduleRemindersForMeeting(
  meeting: Meeting,
  orgId: string,
): Promise<void> {
  // Collect the existing reminder types before cancelling
  const snap = await adminDb
    .collection('scheduled_messages')
    .where('sourceEventId', '==', meeting.id)
    .where('sourceEventType', '==', 'meeting')
    .where('status', '==', 'pending')
    .get();

  const existingTypes = [...new Set(snap.docs.map((d) => d.data().reminderType as string).filter(Boolean))];

  await cancelRemindersForMeeting(meeting.id);

  if (existingTypes.length > 0) {
    await scheduleRemindersForMeeting(meeting, existingTypes, orgId);
  }
}

// ---------------------------------------------------------------------------
// scheduleFormReminders
// ---------------------------------------------------------------------------

/**
 * Schedules 1_day_before and 2_hours_before submission reminders for a form.
 * Creates one ScheduledMessage per recipient entity.
 */
export async function scheduleFormReminders(
  formId: string,
  deadline: string,
  orgId: string,
  recipientEntityIds: string[],
): Promise<void> {
  if (!deadline || recipientEntityIds.length === 0) return;

  const FORM_REMINDER_OFFSETS: Array<{ type: string; offsetMinutes: number }> = [
    { type: 'submission_reminder_1day',   offsetMinutes: REMINDER_OFFSETS.ONE_DAY.offsetMinutes },
    { type: 'submission_reminder_2hours', offsetMinutes: REMINDER_OFFSETS.TWO_HOURS.offsetMinutes },
  ];

  const now = new Date().toISOString();
  const batch = adminDb.batch();

  for (const entityId of recipientEntityIds) {
    // Resolve primary contact for this entity
    const entitySnap = await adminDb.collection('entities').doc(entityId).get();
    if (!entitySnap.exists) continue;

    const entity = entitySnap.data()!;
    const contacts: any[] = entity.entityContacts ?? [];
    const primary = contacts.find((c: any) => c.isPrimary) ?? contacts[0];
    if (!primary) continue;

    const recipientContact: string = primary.email ?? primary.phone ?? '';
    if (!recipientContact) continue;

    for (const { type, offsetMinutes } of FORM_REMINDER_OFFSETS) {
      const scheduledAt = computeScheduledAt(deadline, offsetMinutes);
      if (new Date(scheduledAt) <= new Date()) continue;

      // Resolve template
      let templateId: string | undefined;
      let channel: 'email' | 'sms' = 'email';
      try {
        const { resolveTemplateForOrg } = await import('./template-resolver');
        const tpl = await resolveTemplateForOrg('forms' as TemplateCategory, 'submission_reminder', orgId);
        templateId = tpl.id;
        channel = (tpl.channel === 'email' || tpl.channel === 'sms') ? tpl.channel : 'email';
      } catch {
        continue;
      }

      const docRef = adminDb.collection('scheduled_messages').doc();
      const msg: Omit<ScheduledMessage, 'id'> = {
        organizationId: orgId,
        templateId: templateId!,
        channel,
        recipientContact,
        recipientEntityId: entityId,
        variables: { formId },
        scheduledAt,
        status: 'pending',
        reminderType: type,
        sourceEventId: formId,
        sourceEventType: 'form',
        retryCount: 0,
        createdAt: now,
      };
      batch.set(docRef, msg);
    }
  }

  await batch.commit();
}

// ---------------------------------------------------------------------------
// processScheduledMessages
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;

/**
 * Processes all pending ScheduledMessages whose scheduledAt <= now.
 * Sends each via the messaging engine and updates status to 'sent' or 'failed'.
 * Failed messages are retried up to MAX_RETRIES times before being marked failed.
 */
export async function processScheduledMessages(): Promise<{ sent: number; failed: number }> {
  const nowIso = new Date().toISOString();

  const snap = await adminDb
    .collection('scheduled_messages')
    .where('status', '==', 'pending')
    .where('scheduledAt', '<=', nowIso)
    .get();

  let sent = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const msg = { id: doc.id, ...doc.data() } as ScheduledMessage;

    try {
      const result = await sendMessage({
        templateId: msg.templateId,
        senderProfileId: 'default',
        recipient: msg.recipientContact,
        variables: msg.variables ?? {},
        entityId: msg.recipientEntityId ?? null,
        workspaceId: msg.workspaceId,
      });

      if (result.success) {
        await doc.ref.update({ status: 'sent', sentAt: new Date().toISOString() });
        sent++;
      } else {
        throw new Error(result.error ?? 'Unknown send error');
      }
    } catch (err: any) {
      const retryCount = (msg.retryCount ?? 0) + 1;
      if (retryCount >= MAX_RETRIES) {
        await doc.ref.update({
          status: 'failed',
          retryCount,
          error: err.message ?? 'Unknown error',
        });
        failed++;
      } else {
        // Back off: retry after 5 minutes per attempt
        const retryAt = new Date(Date.now() + retryCount * 5 * 60 * 1000).toISOString();
        await doc.ref.update({
          retryCount,
          scheduledAt: retryAt,
          error: err.message ?? 'Unknown error',
        });
      }
    }
  }

  return { sent, failed };
}

// ---------------------------------------------------------------------------
// scheduleMessagingConfigReminders  (Phase 8 — slot-based)
// ---------------------------------------------------------------------------

/**
 * Creates ScheduledMessage docs from the messagingConfig.reminders[] slots.
 * Each enabled slot with a valid templateId is scheduled at
 * meetingTime – offsetMinutes for ALL registrants of the meeting.
 */
export async function scheduleMessagingConfigReminders(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  orgId: string,
): Promise<void> {
  const config = meeting.messagingConfig;
  if (!config?.reminders?.length || !meeting.meetingTime) return;

  const enabledSlots = config.reminders.filter(s => s.enabled && s.channels.length > 0);
  if (enabledSlots.length === 0) return;

  // Gather registrant contacts
  const regSnap = await adminDb
    .collection('meeting_registrants')
    .where('meetingId', '==', meeting.id)
    .where('status', 'in', ['registered', 'approved'])
    .get();

  if (regSnap.empty) return;

  const recipients: Array<{ contact: string; channel: 'email' | 'sms' }> = [];
  for (const doc of regSnap.docs) {
    const reg = doc.data();
    if (reg.email) recipients.push({ contact: reg.email, channel: 'email' });
    if (reg.phone) recipients.push({ contact: reg.phone, channel: 'sms' });
  }

  if (recipients.length === 0) return;

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const slot of enabledSlots) {
    const scheduledAt = computeScheduledAt(meeting.meetingTime, slot.offsetMinutes);
    if (new Date(scheduledAt) <= new Date()) continue;

    for (const ch of slot.channels) {
      const templateId = ch === 'email' ? slot.emailTemplateId : slot.smsTemplateId;
      if (!templateId) continue;

      const matchingRecipients = recipients.filter(r => r.channel === ch);
      for (const { contact } of matchingRecipients) {
        const docRef = adminDb.collection('scheduled_messages').doc();
        const msg: Omit<ScheduledMessage, 'id'> = {
          organizationId: orgId,
          templateId,
          channel: ch,
          recipientContact: contact,
          variables: { meetingId: meeting.id },
          scheduledAt,
          status: 'pending',
          reminderType: `messaging_slot_${slot.id}`,
          sourceEventId: meeting.id,
          sourceEventType: 'meeting',
          retryCount: 0,
          createdAt: now,
        };
        batch.set(docRef, msg);
      }
    }
  }

  await batch.commit();
}

// ---------------------------------------------------------------------------
// scheduleRegistrationAck  (Phase 8 — instant confirmation)
// ---------------------------------------------------------------------------

/**
 * Sends immediate acknowledgement to a registrant after signup,
 * using the template configured in messagingConfig.
 */
export async function scheduleRegistrationAck(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  registrantEmail: string | undefined,
  registrantPhone: string | undefined,
  orgId: string,
): Promise<void> {
  const config = meeting.messagingConfig;
  if (!config?.registrationAckEnabled) return;

  const channels = config.registrationAckChannels || [];
  if (channels.length === 0) return;

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const ch of channels) {
    const contact = ch === 'email' ? registrantEmail : registrantPhone;
    const templateId = ch === 'email'
      ? config.registrationAckEmailTemplateId
      : config.registrationAckSmsTemplateId;

    if (!contact || !templateId) continue;

    const docRef = adminDb.collection('scheduled_messages').doc();
    const msg: Omit<ScheduledMessage, 'id'> = {
      organizationId: orgId,
      templateId,
      channel: ch,
      recipientContact: contact,
      variables: { meetingId: meeting.id },
      scheduledAt: now, // immediate
      status: 'pending',
      reminderType: 'registration_ack',
      sourceEventId: meeting.id,
      sourceEventType: 'meeting',
      retryCount: 0,
      createdAt: now,
    };
    batch.set(docRef, msg);
  }

  await batch.commit();
}

// ---------------------------------------------------------------------------
// scheduleFacilitatorAlerts  (Phase 8 — internal team)
// ---------------------------------------------------------------------------

/**
 * Sends facilitator alerts (pre-event or post-event) to the configured
 * facilitator team members. Uses workspace_users to resolve contact info.
 */
export async function scheduleFacilitatorAlerts(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  orgId: string,
  alertType: 'pre_event' | 'post_event',
): Promise<void> {
  const config = meeting.messagingConfig;
  if (!config?.facilitatorUserIds?.length) return;

  // Check if the requested alert type is enabled
  if (alertType === 'pre_event' && !config.facilitatorRemindersEnabled) return;
  if (alertType === 'post_event' && !config.facilitatorPostEventEnabled) return;

  // Resolve facilitator contacts from workspace_users
  const contacts: Array<{ email?: string; phone?: string }> = [];
  for (const userId of config.facilitatorUserIds) {
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (userSnap.exists) {
      const u = userSnap.data()!;
      contacts.push({ email: u.email, phone: u.phone });
    }
  }

  if (contacts.length === 0) return;

  const batch = adminDb.batch();
  const now = new Date().toISOString();
  const channels = config.facilitatorChannels || ['email'];

  // For pre-event: schedule 1 hour before. For post-event: schedule immediately.
  const scheduledAt = alertType === 'pre_event' && meeting.meetingTime
    ? computeScheduledAt(meeting.meetingTime, 60) // 1 hour before
    : now;

  // Skip past pre-event alerts
  if (alertType === 'pre_event' && new Date(scheduledAt) <= new Date()) return;

  for (const ch of channels) {
    // Use a generic facilitator template — resolved at send time
    for (const c of contacts) {
      const contact = ch === 'email' ? c.email : c.phone;
      if (!contact) continue;

      const docRef = adminDb.collection('scheduled_messages').doc();
      const msg: Omit<ScheduledMessage, 'id'> = {
        organizationId: orgId,
        templateId: `facilitator_${alertType}`, // resolved by template engine
        channel: ch as 'email' | 'sms',
        recipientContact: contact,
        variables: { meetingId: meeting.id, alertType },
        scheduledAt,
        status: 'pending',
        reminderType: `facilitator_${alertType}`,
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
