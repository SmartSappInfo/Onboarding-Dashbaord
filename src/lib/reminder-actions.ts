'use server';

import { adminDb } from './firebase-admin';
import { resolveAndRender } from './template-resolver';
import { sendMessage } from './messaging-engine';
import { computeScheduledAt } from './template-variable-utils';
import { buildMeetingBaseVariables, buildRegistrantVariables, buildFacilitatorVariables } from './meeting-variable-helpers';
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
  meeting_reminder_2days:   REMINDER_OFFSETS.TWO_DAYS.offsetMinutes,
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
        'meetings' as TemplateCategory,
        reminderType,
        orgId,
        { meetingId: meeting.id, entityId: meeting.entityId },
      );
      // We need the raw template for the ID — re-query to get it
      const { resolveTemplateForOrg } = await import('./template-resolver');
      const tpl = await resolveTemplateForOrg('meetings' as TemplateCategory, reminderType, orgId);
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

  const MAX_BATCH_SIZE = 450;
  let batch = adminDb.batch();
  let opCount = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    opCount++;

    if (opCount >= MAX_BATCH_SIZE) {
      await batch.commit();
      batch = adminDb.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }
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

  // Gather registrant docs (need full data for variable injection)
  const regSnap = await adminDb
    .collection('meetings').doc(meeting.id).collection('registrants')
    .where('status', 'in', ['registered', 'approved'])
    .get();

  if (regSnap.empty) return;

  // Build per-registrant variable maps keyed by contact
  const registrants = regSnap.docs.map(doc => {
    const reg = doc.data();
    const regVars = buildRegistrantVariables({
      name: reg.name || '',
      email: reg.email || '',
      phone: reg.phone || '',
      personalizedMeetingUrl: reg.personalizedMeetingUrl || '',
      status: reg.status || '',
      registrationData: reg.registrationData || {},
    });
    return { email: reg.email, phone: reg.phone, vars: regVars };
  });

  // Build meeting base variables once
  const meetingVars = buildMeetingBaseVariables(meeting);

  const MAX_BATCH_SIZE = 450;
  let currentBatch = adminDb.batch();
  let opCount = 0;
  const now = new Date().toISOString();

  for (const slot of enabledSlots) {
    const scheduledAt = computeScheduledAt(meeting.meetingTime, slot.offsetMinutes);
    if (new Date(scheduledAt) <= new Date()) continue;

    for (const ch of slot.channels) {
      const templateId = ch === 'email' ? slot.emailTemplateId : slot.smsTemplateId;
      if (!templateId) continue;

      for (const reg of registrants) {
        const contact = ch === 'email' ? reg.email : reg.phone;
        if (!contact) continue;

        const docRef = adminDb.collection('scheduled_messages').doc();
        const msg: Omit<ScheduledMessage, 'id'> = {
          organizationId: orgId,
          templateId,
          channel: ch,
          recipientContact: contact,
          variables: { ...meetingVars, ...reg.vars },
          scheduledAt,
          status: 'pending',
          reminderType: `messaging_slot_${slot.id}`,
          sourceEventId: meeting.id,
          sourceEventType: 'meeting',
          retryCount: 0,
          createdAt: now,
        };
        currentBatch.set(docRef, msg);
        opCount++;

        if (opCount >= MAX_BATCH_SIZE) {
          await currentBatch.commit();
          currentBatch = adminDb.batch();
          opCount = 0;
        }
      }
    }
  }

  if (opCount > 0) await currentBatch.commit();
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
  const facilitators = meeting.facilitators || [];
  if (!facilitators.length || !config) return;

  // Check if the requested alert type is enabled
  if (alertType === 'pre_event' && !config.facilitatorRemindersEnabled) return;
  if (alertType === 'post_event' && !config.facilitatorPostEventEnabled) return;

  if (facilitators.length === 0) return;

  const now = new Date().toISOString();
  const channels = config.facilitatorChannels || ['email'];

  // For pre-event: schedule 1 hour before. For post-event: schedule immediately.
  const scheduledAt = alertType === 'pre_event' && meeting.meetingTime
    ? computeScheduledAt(meeting.meetingTime, 60) // 1 hour before
    : now;

  // Skip past pre-event alerts
  if (alertType === 'pre_event' && new Date(scheduledAt) <= new Date()) return;

  // Build meeting base variables once
  const meetingVars = buildMeetingBaseVariables(meeting);

  const batch = adminDb.batch();

    for (const ch of channels) {
    const templateType = alertType === 'pre_event'
      ? 'meeting_facilitator_pre_event'
      : 'meeting_facilitator_post_event';

    let templateId: string | undefined;
    try {
      const { resolveTemplateForOrg } = await import('./template-resolver');
      const tpl = await resolveTemplateForOrg('meetings' as TemplateCategory, templateType, orgId);
      // Only use templates matching this channel
      if (tpl.channel !== ch) continue;
      templateId = tpl.id;
    } catch {
      // No template found for this channel — skip
      continue;
    }

    for (const f of facilitators) {
      const contact = ch === 'email' ? f.email : f.phone;
      if (!contact) continue;

      // Build per-facilitator variables
      const facilitatorVars = buildFacilitatorVariables(f);

      const docRef = adminDb.collection('scheduled_messages').doc();
      const msg: Omit<ScheduledMessage, 'id'> = {
        organizationId: orgId,
        templateId: templateId!,
        channel: ch as 'email' | 'sms',
        recipientContact: contact,
        variables: { ...meetingVars, ...facilitatorVars, alertType },
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

// ---------------------------------------------------------------------------
// sendFacilitatorNewRegistrationAlert  (Phase 2 — instant notification)
// ---------------------------------------------------------------------------

/**
 * Sends an immediate notification to all facilitators when a new registrant
 * signs up. Uses the `meeting_facilitator_new_registration` template.
 */
export async function sendFacilitatorNewRegistrationAlert(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  registrantData: { name: string; email: string; phone?: string; entityName?: string },
  orgId: string,
): Promise<void> {
  const config = meeting.messagingConfig;
  const facilitators = meeting.facilitators || [];
  // Reuse the facilitator reminders toggle — if they get pre-event alerts, they get registration alerts
  if (!config?.facilitatorRemindersEnabled || facilitators.length === 0) return;

  const channels = config.facilitatorChannels || ['email'];
  const now = new Date().toISOString();

  // Count current registrants (async-defer-await: start early)
  const countPromise = adminDb.collection('meetings').doc(meeting.id).collection('registrants')
    .where('status', 'in', ['registered', 'approved'])
    .get();

  // Build meeting base variables once
  const meetingVars = buildMeetingBaseVariables(meeting);

  const batch = adminDb.batch();

  for (const ch of channels) {
    const templateType = 'meeting_facilitator_new_registration';
    let templateId: string | undefined;
    try {
      const { resolveTemplateForOrg } = await import('./template-resolver');
      const tpl = await resolveTemplateForOrg('meetings' as TemplateCategory, templateType, orgId);
      if (tpl.channel !== ch) continue;
      templateId = tpl.id;
    } catch {
      continue;
    }

    const regSnap = await countPromise;

    for (const f of facilitators) {
      const contact = ch === 'email' ? f.email : f.phone;
      if (!contact) continue;

      // Per-facilitator + per-registrant context
      const facilitatorVars = buildFacilitatorVariables(f);

      const docRef = adminDb.collection('scheduled_messages').doc();
      const msg: Omit<ScheduledMessage, 'id'> = {
        organizationId: orgId,
        templateId: templateId!,
        channel: ch as 'email' | 'sms',
        recipientContact: contact,
        variables: {
          ...meetingVars,
          ...facilitatorVars,
          // New registrant details (kept as contact_* for backward compat)
          contact_name: registrantData.name,
          contact_email: registrantData.email,
          contact_phone: registrantData.phone || '',
          entity_name: registrantData.entityName || '',
          registration_time: now,
          registrant_count: String(regSnap.size),
        },
        scheduledAt: now, // immediate
        status: 'pending',
        reminderType: 'facilitator_new_registration',
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
// schedulePostEventMessages  (Phase 3 — post-event dispatch)
// ---------------------------------------------------------------------------

/**
 * Schedules post-event thank-you messages to attendees and (optionally)
 * absentee follow-up messages to no-shows.
 *
 * Also triggers the facilitator post-event debrief alert.
 */
export async function schedulePostEventMessages(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  orgId: string,
): Promise<{ thankYouCount: number; absenteeCount: number }> {
  const config = meeting.messagingConfig;
  if (!config?.postEventEnabled) return { thankYouCount: 0, absenteeCount: 0 };

  const channels = config.postEventChannels || ['email'];
  const delayMs = (config.postEventDelayMinutes || 60) * 60 * 1000;
  const scheduledAt = new Date(Date.now() + delayMs).toISOString();
  const now = new Date().toISOString();

  // Fetch all registrants (full docs for variable injection)
  const regSnap = await adminDb.collection('meetings').doc(meeting.id).collection('registrants')
    .where('status', 'in', ['registered', 'approved', 'attended'])
    .get();

  if (regSnap.empty) return { thankYouCount: 0, absenteeCount: 0 };

  const allRegs = regSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      email: data.email as string | undefined,
      phone: data.phone as string | undefined,
      status: data.status as string | undefined,
      vars: buildRegistrantVariables({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        personalizedMeetingUrl: data.personalizedMeetingUrl || '',
        status: data.status || '',
        registrationData: data.registrationData || {},
      }),
    };
  });

  // Split by attendance
  const attended = config.postEventAudience === 'all_registrants'
    ? allRegs
    : allRegs.filter(r => r.status === 'attended');
  const absentees = config.postEventAbsenteeEnabled
    ? allRegs.filter(r => r.status !== 'attended')
    : [];

  // Build meeting base variables once (includes recording_url, brochure_url, etc.)
  const meetingVars = buildMeetingBaseVariables(meeting);

  const MAX_BATCH_SIZE = 450;
  let currentBatch = adminDb.batch();
  let opCount = 0;
  let thankYouCount = 0;
  let absenteeCount = 0;

  // Helper to schedule a group of messages
  const scheduleGroup = async (
    recipients: typeof allRegs,
    templateType: string,
    counter: 'thankyou' | 'absentee',
  ) => {
    for (const ch of channels) {
      let templateId: string | undefined;
      try {
        const { resolveTemplateForOrg } = await import('./template-resolver');
        const tpl = await resolveTemplateForOrg('meetings' as TemplateCategory, templateType, orgId);
        if (tpl.channel !== ch) continue;
        templateId = tpl.id;
      } catch {
        continue;
      }

      for (const reg of recipients) {
        const contact = ch === 'email' ? reg.email : reg.phone;
        if (!contact) continue;

        const docRef = adminDb.collection('scheduled_messages').doc();
        const msg: Omit<ScheduledMessage, 'id'> = {
          organizationId: orgId,
          templateId: templateId!,
          channel: ch as 'email' | 'sms',
          recipientContact: contact,
          variables: { ...meetingVars, ...reg.vars },
          scheduledAt,
          status: 'pending',
          reminderType: `post_event_${counter}`,
          sourceEventId: meeting.id,
          sourceEventType: 'meeting',
          retryCount: 0,
          createdAt: now,
        };
        currentBatch.set(docRef, msg);
        opCount++;
        if (counter === 'thankyou') thankYouCount++;
        else absenteeCount++;

        if (opCount >= MAX_BATCH_SIZE) {
          await currentBatch.commit();
          currentBatch = adminDb.batch();
          opCount = 0;
        }
      }
    }
  };

  // Schedule thank-you and absentee messages
  await scheduleGroup(attended, 'meeting_post_event_thankyou', 'thankyou');
  if (absentees.length > 0) {
    await scheduleGroup(absentees, 'meeting_post_event_absentee', 'absentee');
  }

  if (opCount > 0) await currentBatch.commit();

  // Trigger facilitator post-event debrief (non-blocking)
  void scheduleFacilitatorAlerts(meeting, orgId, 'post_event');

  return { thankYouCount, absenteeCount };
}
