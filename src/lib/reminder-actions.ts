'use server';

import { adminDb } from './firebase-admin';
import { resolveAndRender } from './template-resolver';
import { sendMessage, sendRawMessage } from './messaging-engine';
import { computeScheduledAt } from './template-variable-utils';
import { buildMeetingBaseVariables, buildRegistrantVariables, buildFacilitatorVariables } from './meeting-variable-helpers';
import type { Meeting, ScheduledMessage, TemplateCategory, MeetingMessagingConfig, MeetingReminderSlot, MeetingInvitationSlot, MeetingRegistrant } from './types';
import { REMINDER_OFFSETS } from './types';
import { calculateChannelTriggerTime } from './invitation-utils';
import { getBaseUrl, getRequestBaseUrl } from './utils/url-helpers';
import { getPersonalizedMeetingUrl } from './meeting-tokens';

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

      const safeContact = contact.replace(/[^a-zA-Z0-9]/g, '_');
      const docId = `meeting_std_${meeting.id}_${safeContact}_${reminderType}`;
      const docRef = adminDb.collection('scheduled_messages').doc(docId);
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
 * Cancels all existing pending reminders and invitations for a meeting and re-creates them
 * based on the updated meeting time and configuration.
 */
export async function rescheduleRemindersForMeeting(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig; enabledReminders?: string[] },
  orgId: string,
  meetingTimeChanged = false
): Promise<void> {
  // 1. Cancel all pending scheduled messages linked to this meeting
  await cancelRemindersForMeeting(meeting.id);

  const promises: Promise<void>[] = [];

  // 2. Schedule standard contact reminders if enabled
  if (meeting.enabledReminders && meeting.enabledReminders.length > 0) {
    promises.push(scheduleRemindersForMeeting(meeting, meeting.enabledReminders, orgId));
  }

  // 3. Schedule facilitator pre-event alerts if enabled or templates are selected
  const hasFacilitatorTemplates = !!(
    meeting.messagingConfig?.facilitatorRemindersEmailTemplateId ||
    meeting.messagingConfig?.facilitatorRemindersSmsTemplateId
  );
  if (meeting.messagingConfig?.facilitatorRemindersEnabled || hasFacilitatorTemplates) {
    promises.push(scheduleFacilitatorAlerts(meeting, orgId, 'pre_event'));
  }

  // 4. Schedule custom reminders (to registrants) if configured
  if (meeting.messagingConfig?.reminders?.length) {
    promises.push(scheduleMessagingConfigReminders(meeting, orgId));
  }

  // 5. Schedule custom invitations if enabled
  if (meeting.messagingConfig?.invitationsEnabled) {
    promises.push(scheduleMeetingInvitations(meeting, orgId, meetingTimeChanged));
  }

  await Promise.all(promises);
}

/**
 * Schedules or re-schedules invitation messages in scheduled_messages collection
 * for all pending registrants.
 */
export async function scheduleMeetingInvitations(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  orgId: string,
  meetingTimeChanged = false
): Promise<void> {
  const config = meeting.messagingConfig;
  if (!config?.invitationsEnabled || !config.invitationSeries || config.invitationSeries.length === 0 || !meeting.meetingTime) {
    return;
  }

  // Fetch all pending registrants for this meeting
  const pendingSnap = await adminDb
    .collection(`meetings/${meeting.id}/registrants`)
    .where('status', '==', 'pending')
    .get();

  if (pendingSnap.empty) {
    return;
  }

  // First, cancel any existing pending invitation messages in scheduled_messages for this meeting
  // to avoid duplicates when re-scheduling.
  const existingSnap = await adminDb
    .collection('scheduled_messages')
    .where('sourceEventId', '==', meeting.id)
    .where('sourceEventType', '==', 'meeting')
    .where('status', '==', 'pending')
    .get();

  const batch = adminDb.batch();
  let deleteCount = 0;
  for (const doc of existingSnap.docs) {
    const data = doc.data();
    if (data.reminderType === 'meeting_invitation' || data.reminderType?.startsWith('meeting_invitation_')) {
      batch.delete(doc.ref);
      deleteCount++;
    }
  }
  if (deleteCount > 0) {
    await batch.commit();
  }

  // Resolve timezone
  let timezone = 'UTC';
  try {
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    if (orgSnap.exists) {
      timezone = orgSnap.data()?.settings?.defaultTimezone || 'UTC';
    }
  } catch (err) {
    console.warn(`[scheduleMeetingInvitations] Failed to fetch organization timezone:`, err);
  }

  const enabledSlots = config.invitationSeries.filter(s => s.enabled);
  if (enabledSlots.length === 0) return;

  const baseUrl = await getRequestBaseUrl();
  let typeSlug = 'parent-engagement';
  const mType = meeting.type as any;
  if (mType) {
    if (typeof mType === 'string') {
      typeSlug = mType === 'parent' ? 'parent-engagement' : mType;
    } else if (mType.slug) {
      typeSlug = mType.slug === 'parent' ? 'parent-engagement' : mType.slug;
    } else if (mType.id) {
      typeSlug = mType.id === 'parent' ? 'parent-engagement' : mType.id;
    }
  }
  const meetingSlug = meeting.meetingSlug || meeting.entitySlug || meeting.id;

  const meetingTime = new Date(meeting.meetingTime);
  const meetingVars = buildMeetingBaseVariables(meeting, timezone);

  const MAX_BATCH_SIZE = 450;
  let currentBatch = adminDb.batch();
  let opCount = 0;
  const now = new Date();
  const nowIso = now.toISOString();

  for (const slot of enabledSlots) {
    // Calculate channel-specific scheduled trigger dates
    const emailTriggerTime = calculateChannelTriggerTime(meetingTime, slot, 'email', timezone);
    const smsTriggerTime = calculateChannelTriggerTime(meetingTime, slot, 'sms', timezone);

    for (const doc of pendingSnap.docs) {
      const reg = doc.data() as MeetingRegistrant;
      const token = reg.token;
      if (!token) continue;

      const rsvpGoingUrl = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=${token}&response=going`;
      const rsvpDeclinedUrl = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=${token}&response=not_going`;
      const rsvpLaterUrl = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=${token}&response=later`;

      const regVars = buildRegistrantVariables({
        name: reg.name || '',
        email: reg.email || '',
        phone: reg.phone || '',
        personalizedMeetingUrl: reg.personalizedMeetingUrl || '',
        status: reg.status || 'pending',
        registrationData: reg.registrationData || {},
      });

      const invitationVars = {
        ...meetingVars,
        ...regVars,
        meetingId: meeting.id,
        rsvpGoingUrl,
        rsvpDeclinedUrl,
        rsvpLaterUrl,
        rsvp_going_url: rsvpGoingUrl,
        rsvp_declined_url: rsvpDeclinedUrl,
        rsvp_later_url: rsvpLaterUrl,
        meeting_registrant_one_click_link: `${baseUrl}/meetings/${typeSlug}/${meetingSlug}?token=${token}`,
      };

      for (const ch of slot.channels) {
        const templateId = ch === 'email' ? slot.emailTemplateId : slot.smsTemplateId;
        if (!templateId) continue;

        const contact = ch === 'email' ? reg.email : reg.phone;
        if (!contact) continue;

        // Skip if this invitation channel was already sent to this registrant
        const stageKey = `${slot.id}_${ch}`;
        const wasSent = reg.sentInvitations?.[stageKey] || reg.sentInvitations?.[slot.id];
        if (wasSent) {
          if (slot.id === 'initial' || !meetingTimeChanged) {
            continue;
          }
        }

        const triggerTime = ch === 'email' ? emailTriggerTime : smsTriggerTime;
        if (triggerTime <= now) continue; // skip if past due

        const docId = `meeting_inv_${meeting.id}_${doc.id}_${slot.id}_${ch}`;
        const docRef = adminDb.collection('scheduled_messages').doc(docId);
        const msg: Omit<ScheduledMessage, 'id'> = {
          organizationId: orgId,
          templateId,
          channel: ch,
          recipientContact: contact,
          recipientEntityId: reg.entityId || undefined,
          variables: invitationVars,
          scheduledAt: triggerTime.toISOString(),
          status: 'pending',
          reminderType: `meeting_invitation_${slot.id}`,
          sourceEventId: meeting.id,
          sourceEventType: 'meeting',
          retryCount: 0,
          createdAt: nowIso,
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

  if (opCount > 0) {
    await currentBatch.commit();
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
  const now = new Date();

  const snap = await adminDb
    .collection('scheduled_messages')
    .where('status', '==', 'pending')
    .where('scheduledAt', '<=', nowIso)
    .get();

  let sent = 0;
  let failed = 0;
  const meetingCache = new Map<string, Meeting | null>();

  for (const doc of snap.docs) {
    const msg = { id: doc.id, ...doc.data() } as ScheduledMessage;

    try {
      const meetingId = msg.variables?.meetingId || (msg.sourceEventType === 'meeting' ? msg.sourceEventId : null);
      
      let meetingData: Meeting | null = null;
      if (meetingId) {
        if (!meetingCache.has(meetingId)) {
          const mSnap = await adminDb.collection('meetings').doc(meetingId).get();
          meetingCache.set(meetingId, mSnap.exists ? (mSnap.data() as Meeting) : null);
        }
        meetingData = meetingCache.get(meetingId) || null;
      }

      if (meetingData) {
        if (meetingData.status === 'cancelled' || meetingData.status === 'ended') {
          await doc.ref.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
          continue;
        }

        const isPreEvent = msg.reminderType === 'meeting_invitation' ||
                           msg.reminderType?.startsWith('meeting_invitation_') ||
                           msg.reminderType === 'meeting_reminder' ||
                           msg.reminderType?.startsWith('meeting_reminder_') ||
                           (msg.scheduledAt && new Date(msg.scheduledAt) <= new Date(meetingData.meetingTime));

        if (isPreEvent) {
          const duration = meetingData.durationMinutes ?? 60;
          const meetingEndTime = new Date(new Date(meetingData.meetingTime).getTime() + duration * 60 * 1000);
          if (now > meetingEndTime) {
            await doc.ref.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
            continue;
          }
        }
      }

      if (meetingId && msg.recipientContact) {
        const isEmail = msg.recipientContact.includes('@');
        const regSnap = await adminDb
          .collection('meetings')
          .doc(meetingId)
          .collection('registrants')
          .where(isEmail ? 'email' : 'phone', '==', msg.recipientContact.toLowerCase().trim())
          .limit(1)
          .get();

        if (!regSnap.empty) {
          const regData = regSnap.docs[0].data();
          if (regData.status === 'cancelled') {
            await doc.ref.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
            continue;
          }
          // Auto-cancel scheduled invitation messages if registrant is no longer pending
          if ((msg.reminderType === 'meeting_invitation' || msg.reminderType?.startsWith('meeting_invitation_')) && regData.status !== 'pending') {
            await doc.ref.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
            continue;
          }
        }
      }

      let result: { success: boolean; error?: string; logId?: string };

      if (!msg.templateId || msg.templateId === 'raw') {
        result = await sendRawMessage({
          channel: msg.channel as 'email' | 'sms' | 'in_app' | 'push',
          recipient: msg.recipientContact,
          body: msg.customBody || '',
          subject: msg.channel === 'email' ? (msg.customSubject || undefined) : undefined,
          previewText: msg.customPreviewText || undefined,
          senderProfileId: msg.senderProfileId || 'default',
          organizationId: msg.organizationId,
          variables: msg.variables ?? {},
          workspaceIds: msg.workspaceId ? [msg.workspaceId] : undefined,
          entityId: msg.recipientEntityId || undefined,
        });
      } else {
        result = await sendMessage({
          templateId: msg.templateId,
          senderProfileId: msg.senderProfileId || 'default',
          organizationId: msg.organizationId,
          recipient: msg.recipientContact,
          variables: msg.variables ?? {},
          entityId: msg.recipientEntityId ?? null,
          workspaceId: msg.workspaceId,
          body: msg.customBody || undefined,
          subject: msg.customSubject || undefined,
          previewText: msg.customPreviewText || undefined,
        });
      }

      if (result.success) {
        await doc.ref.update({ status: 'sent', sentAt: new Date().toISOString() });
        sent++;
      } else {
        throw new Error(result.error ?? 'Unknown send error');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      const retryCount = (msg.retryCount ?? 0) + 1;
      if (retryCount >= MAX_RETRIES) {
        await doc.ref.update({
          status: 'failed',
          retryCount,
          error: errMsg,
        });
        failed++;
      } else {
        // Back off: retry after 5 minutes per attempt
        const retryAt = new Date(Date.now() + retryCount * 5 * 60 * 1000).toISOString();
        await doc.ref.update({
          retryCount,
          scheduledAt: retryAt,
          error: errMsg,
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
    return { id: doc.id, email: reg.email, phone: reg.phone, vars: regVars };
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

        const docId = `meeting_rem_${meeting.id}_${reg.id}_${slot.id}_${ch}`;
        const docRef = adminDb.collection('scheduled_messages').doc(docId);
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

  // Check if the requested alert type is enabled or templates are selected
  const hasPreEventTemplates = !!(config.facilitatorRemindersEmailTemplateId || config.facilitatorRemindersSmsTemplateId);
  const isPreEventEnabled = config.facilitatorRemindersEnabled || hasPreEventTemplates;

  const hasPostEventTemplates = !!(config.facilitatorPostEventEmailTemplateId || config.facilitatorPostEventSmsTemplateId);
  const isPostEventEnabled = config.facilitatorPostEventEnabled || hasPostEventTemplates;

  if (alertType === 'pre_event' && !isPreEventEnabled) return;
  if (alertType === 'post_event' && !isPostEventEnabled) return;

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
  const baseUrl = await getRequestBaseUrl();

  const batch = adminDb.batch();

  for (const ch of channels) {
    let templateId: string | undefined;
    
    // Try explicitly configured templates first
    if (alertType === 'pre_event') {
      templateId = ch === 'email' ? config.facilitatorRemindersEmailTemplateId : config.facilitatorRemindersSmsTemplateId;
    } else {
      templateId = ch === 'email' ? config.facilitatorPostEventEmailTemplateId : config.facilitatorPostEventSmsTemplateId;
    }

    if (!templateId) {
      const templateType = alertType === 'pre_event'
        ? 'meeting_facilitator_pre_event'
        : 'meeting_facilitator_post_event';

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
    }

    for (const f of facilitators) {
      const contact = ch === 'email' ? f.email : f.phone;
      if (!contact) continue;

      // Build per-facilitator variables
      const facilitatorVars = buildFacilitatorVariables(f, meeting, baseUrl);

      const safeContact = contact.replace(/[^a-zA-Z0-9]/g, '_');
      const docId = `meeting_fac_${meeting.id}_${safeContact}_${alertType}_${ch}`;
      const docRef = adminDb.collection('scheduled_messages').doc(docId);
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
  const baseUrl = await getRequestBaseUrl();

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
      const facilitatorVars = buildFacilitatorVariables(f, meeting, baseUrl);

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

/**
 * Schedules custom messaging config reminders for a single newly registered participant.
 * Fetches the registrant details, checks if status is registered/approved,
 * and schedules all enabled reminders for the user deterministically.
 */
export async function scheduleRemindersForNewRegistrant(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  registrantId: string,
  orgId: string,
): Promise<void> {
  const config = meeting.messagingConfig;
  if (!config?.reminders?.length || !meeting.meetingTime) return;

  const enabledSlots = config.reminders.filter(s => s.enabled && s.channels.length > 0);
  if (enabledSlots.length === 0) return;

  // Fetch the registrant doc
  const regSnap = await adminDb
    .collection('meetings').doc(meeting.id).collection('registrants').doc(registrantId)
    .get();

  if (!regSnap.exists) return;
  const reg = regSnap.data()!;

  // Skip if they are not approved or registered
  if (reg.status !== 'registered' && reg.status !== 'approved') return;

  const regVars = buildRegistrantVariables({
    name: reg.name || '',
    email: reg.email || '',
    phone: reg.phone || '',
    personalizedMeetingUrl: reg.personalizedMeetingUrl || '',
    status: reg.status || '',
    registrationData: reg.registrationData || {},
  });

  const meetingVars = buildMeetingBaseVariables(meeting);
  const now = new Date().toISOString();
  const batch = adminDb.batch();

  for (const slot of enabledSlots) {
    const scheduledAt = computeScheduledAt(meeting.meetingTime, slot.offsetMinutes);
    if (new Date(scheduledAt) <= new Date()) continue;

    for (const ch of slot.channels) {
      const templateId = ch === 'email' ? slot.emailTemplateId : slot.smsTemplateId;
      if (!templateId) continue;

      const contact = ch === 'email' ? reg.email : reg.phone;
      if (!contact) continue;

      const docId = `meeting_rem_${meeting.id}_${registrantId}_${slot.id}_${ch}`;
      const docRef = adminDb.collection('scheduled_messages').doc(docId);
      const msg: Omit<ScheduledMessage, 'id'> = {
        organizationId: orgId,
        templateId,
        channel: ch,
        recipientContact: contact,
        variables: { ...meetingVars, ...regVars },
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

  await batch.commit();
}

/**
 * Automatically ends any active or scheduled meetings that have been completed
 * for more than 1 hour (i.e. now >= meetingTime + durationMinutes + 1 Hour).
 * Triggers their post-event follow-up messages automatically.
 */
export async function autoEndCompletedMeetings(): Promise<{ endedCount: number; errors: string[] }> {
  let endedCount = 0;
  const errors: string[] = [];

  try {
    const now = new Date();
    // Query only active/scheduled meetings
    const meetingsSnap = await adminDb.collection('meetings')
      .where('status', 'in', ['scheduled', 'active'])
      .get();

    if (meetingsSnap.empty) {
      return { endedCount, errors };
    }

    for (const meetingDoc of meetingsSnap.docs) {
      const meetingId = meetingDoc.id;
      const meeting = meetingDoc.data() as Meeting;

      if (!meeting.meetingTime) {
        continue;
      }

      const meetingTime = new Date(meeting.meetingTime);
      const duration = meeting.durationMinutes ?? 60;
      // Auto-end trigger is duration + 1 Hour after meeting start time
      const autoEndCutoff = new Date(meetingTime.getTime() + (duration + 60) * 60 * 1000);

      if (now >= autoEndCutoff) {
        try {
          const orgId = meeting.organizationId || 'default';
          // Dynamically import endMeetingAction to prevent circular dependencies
          const { endMeetingAction } = await import('@/app/actions/meeting-post-event-action');
          const result = await endMeetingAction(meetingId, orgId);
          if (result.success) {
            endedCount++;
            console.log(`[AUTO-END] Successfully ended meeting: ${meetingId} (${meeting.entityName || 'Meeting'})`);
          } else {
            throw new Error(result.error);
          }
        } catch (err: unknown) {
          const errMsg = `Failed to end meeting ${meetingId}: ${err instanceof Error ? err.message : 'Unknown error'}`;
          console.error(`[AUTO-END] ${errMsg}`);
          errors.push(errMsg);
        }
      }
    }

    return { endedCount, errors };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AUTO-END] Global error auto-ending meetings:', msg);
    return { endedCount, errors: [msg] };
  }
}

/**
 * Processes all scheduled campaigns whose scheduledAt <= now.
 * Uses a Firestore transaction lock (setting status to 'dispatching') to prevent double-processing.
 */
export async function processScheduledCampaigns(): Promise<{ processedCount: number; errors: string[] }> {
  const nowIso = new Date().toISOString();
  const errors: string[] = [];
  let processedCount = 0;

  try {
    const snap = await adminDb
      .collection('message_campaigns')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', nowIso)
      .limit(5)
      .get();

    if (snap.empty) {
      return { processedCount, errors };
    }

    const { dispatchCampaign } = await import('./campaign-dispatch');

    for (const doc of snap.docs) {
      const campaignId = doc.id;

      // 1. Transaction to atomically set status from 'scheduled' to 'dispatching'
      let locked = false;
      try {
        await adminDb.runTransaction(async (transaction) => {
          const campaignRef = adminDb.collection('message_campaigns').doc(campaignId);
          const campaignDoc = await transaction.get(campaignRef);

          if (!campaignDoc.exists) {
            throw new Error('Campaign document not found');
          }

          const currentStatus = campaignDoc.data()?.status as string;
          if (currentStatus === 'scheduled') {
            transaction.update(campaignRef, {
              status: 'dispatching',
              updatedAt: new Date().toISOString()
            });
            locked = true;
          }
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        console.error(`[CRON-CAMPAIGN] Lock acquisition failed for ${campaignId}:`, msg);
        errors.push(`Lock failed for ${campaignId}: ${msg}`);
        continue;
      }

      if (!locked) {
        console.warn(`[CRON-CAMPAIGN] Campaign ${campaignId} was already locked or modified by another worker.`);
        continue;
      }

      // 2. Dispatch locked campaign
      try {
        console.log(`[CRON-CAMPAIGN] Starting dispatch for campaign ${campaignId}`);
        const result = await dispatchCampaign(campaignId);
        
        if (result.success) {
          processedCount++;
          console.log(`[CRON-CAMPAIGN] Successfully dispatched campaign: ${campaignId}`);
        } else {
          throw new Error(result.error || 'Unknown dispatch error');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown dispatch error';
        console.error(`[CRON-CAMPAIGN] Dispatch failed for campaign ${campaignId}:`, errMsg);
        
        // Revert status to failed so it doesn't get stuck in 'dispatching'
        try {
          await adminDb.collection('message_campaigns').doc(campaignId).update({
            status: 'failed',
            error: errMsg,
            updatedAt: new Date().toISOString()
          });
        } catch (updateErr: unknown) {
          console.error(`[CRON-CAMPAIGN] Failed to mark campaign ${campaignId} as failed:`, updateErr);
        }

        errors.push(`Dispatch failed for ${campaignId}: ${errMsg}`);
      }
    }
  } catch (error: unknown) {
    const globalMsg = error instanceof Error ? error.message : 'Unknown global error';
    console.error('[CRON-CAMPAIGN] Global error in processScheduledCampaigns:', globalMsg);
    errors.push(`Global error: ${globalMsg}`);
  }

  return { processedCount, errors };
}

