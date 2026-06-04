import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { generateRegistrantToken, getPersonalizedMeetingUrl } from '@/lib/meeting-tokens';
import { sendMessage } from '@/lib/messaging-engine';
import { buildMeetingBaseVariables, buildRegistrantVariables } from '@/lib/meeting-variable-helpers';
import { createEntityFromRegistration } from '@/app/actions/meeting-lead-capture-action';
import { dispatchRegistrationWebhook, type RegistrationWebhookPayload } from '@/lib/outbound-webhook-service';
import type { Meeting, MeetingMessagingConfig } from '@/lib/types';
import { getBaseUrl } from '@/lib/utils/url-helpers';
import { scheduleRemindersForNewRegistrant } from '@/lib/reminder-actions';

/**
 * POST /api/meetings/register
 *
 * Authoritative registration endpoint. Replaces direct client-side Firestore
 * writes so that acknowledgement messages, CRM capture, and outbound webhooks
 * can execute server-side without exposing admin credentials to the browser.
 *
 * Flow:
 *  1. Validate request body
 *  2. Fetch meeting (admin SDK — authoritative, always fresh)
 *  3. Dedup: email → phone → redirect if already registered
 *  4. Capacity check → determine status
 *  5. Write registrant doc (atomic, admin SDK)
 *  6. fire-and-forget: sendAck (instant email/SMS to registrant)
 *  7. fire-and-forget: CRM entity capture → entity payload for webhook
 *  8. fire-and-forget: outbound webhook POST
 *  9. Return { token, status, personalizedMeetingUrl }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Parse body ───────────────────────────────────────────────────────
  let meetingId: string;
  let formData: Record<string, unknown>;

  try {
    const body = await req.json();
    meetingId = String(body.meetingId || '');
    formData = (body.formData as Record<string, unknown>) || {};
    if (!meetingId) throw new Error('meetingId is required');
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid request body' }, { status: 400 });
  }

  // ── 2. Fetch meeting ────────────────────────────────────────────────────
  const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
  if (!meetingSnap.exists) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }
  const meeting = { id: meetingSnap.id, ...meetingSnap.data() } as Meeting & {
    messagingConfig?: MeetingMessagingConfig;
  };

  // Resolve org ID (needed for ack + entity capture)
  const orgSnap = await adminDb.collection('workspaces')
    .doc(meeting.workspaceIds?.[0] || 'onboarding')
    .get();
  const orgId: string = orgSnap.data()?.organizationId || 'default';

  const registrantsRef = adminDb.collection(`meetings/${meetingId}/registrants`);

  // ── 3. Dedup check ─────────────────────────────────────────────────────
  const userEmail = String(formData.email || '').toLowerCase().trim();
  const userPhone = String(formData.phone || '').trim();
  const now = new Date().toISOString();

  if (userEmail || userPhone) {
    let existingSnap: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    if (userEmail) {
      const q = await registrantsRef.where('email', '==', userEmail).limit(1).get();
      if (!q.empty) existingSnap = q.docs[0];
    }
    if (!existingSnap && userPhone) {
      const q = await registrantsRef.where('phone', '==', userPhone).limit(1).get();
      if (!q.empty) existingSnap = q.docs[0];
    }

    if (existingSnap) {
      const existing = existingSnap.data();
      // If the registrant document is just a pending invite, convert them to a direct registrant
      if (existing.status === 'pending' || existing.source === 'invite') {
        await existingSnap.ref.update({
          status: 'registered',
          source: 'direct',
          registeredAt: now,
          registrationData: formData,
        });
        void scheduleRemindersForNewRegistrant(meeting, existingSnap.id, orgId).catch(err => {
          console.warn('[REGISTER] Failed to schedule reminders on conversion:', err?.message);
        });
        return NextResponse.json({
          token: existing.token,
          status: 'registered',
          personalizedMeetingUrl: existing.personalizedMeetingUrl,
          alreadyRegistered: true,
        });
      }
      return NextResponse.json({
        token: existing.token,
        status: existing.status,
        personalizedMeetingUrl: existing.personalizedMeetingUrl,
        alreadyRegistered: true,
      });
    }
  }

  // ── 4. Capacity check + status ─────────────────────────────────────────
  let status: 'approved' | 'registered' | 'waitlisted' =
    meeting.registrationMode === 'open' ? 'approved' : 'registered';

  if (meeting.capacityLimit && meeting.capacityLimit > 0) {
    const countSnap = await registrantsRef
      .where('status', 'in', ['registered', 'approved', 'attended'])
      .get();

    if (countSnap.size >= meeting.capacityLimit) {
      if (!meeting.waitlistEnabled) {
        return NextResponse.json({ error: 'Registration full' }, { status: 409 });
      }
      status = 'waitlisted';
    }
  }

  // ── 5. Write registrant doc ────────────────────────────────────────────
  const token = generateRegistrantToken();
  const baseUrl = getBaseUrl();

  // Reconstruct the public path from meeting slug + type slug
  const personalizedMeetingUrl = getPersonalizedMeetingUrl(baseUrl, meeting as any, token);

  const registrantName = String(formData.name || formData.full_name || '');

  const registrantData = {
    meetingId,
    workspaceIds: meeting.workspaceIds || [],
    token,
    status,
    source: 'direct',
    registrationData: formData,
    name: registrantName,
    email: userEmail,
    phone: userPhone,
    registeredAt: now,
    personalizedMeetingUrl,
  };

  const docRef = await registrantsRef.add(registrantData);
  const registrantId = docRef.id;

  void scheduleRemindersForNewRegistrant(meeting, registrantId, orgId).catch(err => {
    console.warn('[REGISTER] Failed to schedule reminders for new registrant:', err?.message);
  });

  const workspaceId = meeting.workspaceIds?.[0] || '';
  if (workspaceId) {
    void import('@/lib/meeting-automation-events').then(({ emitMeetingRegistrantActivity }) =>
      emitMeetingRegistrantActivity({
        type: 'meeting_registrant_added',
        organizationId: orgId,
        workspaceId,
        meetingId,
        registrantId,
        registrantName,
        registrantEmail: userEmail,
        meetingTypeId: meeting.type?.id,
      })
    );
  }

  // ── 6–8. Async side-effects (fire-and-forget) ──────────────────────────
  // All wrapped in void — they MUST NOT block the HTTP response.

  void sendAcknowledgement(meeting, {
    registrantId,
    name: registrantName,
    email: userEmail,
    phone: userPhone,
    status,
    personalizedMeetingUrl,
    registrationData: formData,
  }, orgId);

  // CRM capture + webhook — run in sequence so webhook gets entity payload
  void captureAndDispatch(meeting, {
    registrantId,
    name: registrantName,
    email: userEmail,
    phone: userPhone,
    status,
    token,
    personalizedMeetingUrl,
    registrationData: formData,
    registeredAt: now,
  }, orgId);

  // ── 9. Respond ─────────────────────────────────────────────────────────
  return NextResponse.json({ token, status, personalizedMeetingUrl });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface RegistrantInfo {
  registrantId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  personalizedMeetingUrl: string;
}

/** Sends immediate email + SMS ack to the registrant using the messaging engine */
async function sendAcknowledgement(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  registrant: RegistrantInfo & { registrationData?: Record<string, unknown> },
  orgId: string,
): Promise<void> {
  const config = meeting.messagingConfig;
  if (!config?.registrationAckEnabled) return;

  const channels = config.registrationAckChannels || [];
  if (channels.length === 0) return;

  // Resolve org timezone for locale-aware formatting
  let timezone = 'UTC';
  try {
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    if (orgSnap.exists) {
      timezone = orgSnap.data()?.settings?.defaultTimezone || 'UTC';
    }
  } catch { /* ignore */ }

  // Build variables from centralized helpers
  const variables: Record<string, string> = {
    ...buildMeetingBaseVariables(meeting, timezone),
    ...buildRegistrantVariables({
      name: registrant.name,
      email: registrant.email,
      phone: registrant.phone,
      personalizedMeetingUrl: registrant.personalizedMeetingUrl,
      status: registrant.status as any,
      registrationData: (registrant.registrationData || {}) as Record<string, any>,
    }),
  };

  const sendPromises: Promise<any>[] = [];

  if (channels.includes('email') && registrant.email && config.registrationAckEmailTemplateId) {
    sendPromises.push(
      sendMessage({
        templateId: config.registrationAckEmailTemplateId,
        senderProfileId: 'default',
        recipient: registrant.email,
        variables,
        workspaceId: meeting.workspaceIds?.[0],
      }).catch(e => console.warn('[ACK] Email send failed:', e?.message))
    );
  }

  if (channels.includes('sms') && registrant.phone && config.registrationAckSmsTemplateId) {
    sendPromises.push(
      sendMessage({
        templateId: config.registrationAckSmsTemplateId,
        senderProfileId: 'default',
        recipient: registrant.phone,
        variables,
        workspaceId: meeting.workspaceIds?.[0],
      }).catch(e => console.warn('[ACK] SMS send failed:', e?.message))
    );
  }

  await Promise.allSettled(sendPromises);
}

interface WebhookRegistrantInfo extends RegistrantInfo {
  token: string;
  registrationData: Record<string, unknown>;
  registeredAt: string;
}

/**
 * Runs CRM entity capture then dispatches the outbound webhook with
 * the full entity payload included.
 */
async function captureAndDispatch(
  meeting: Meeting & { messagingConfig?: MeetingMessagingConfig },
  registrant: WebhookRegistrantInfo,
  orgId: string,
): Promise<void> {
  const workspaceId = meeting.workspaceIds?.[0] || 'onboarding';
  let entityPayload: (Record<string, unknown> & { id: string; isNew?: boolean }) | null = null;

  // ── CRM lead capture ────────────────────────────────────────────────────
  if (meeting.createEntity && meeting.entityMapping) {
    try {
      const result = await createEntityFromRegistration({
        meetingId: meeting.id,
        workspaceId,
        organizationId: orgId,
        registrantId: registrant.registrantId,
        registrationData: registrant.registrationData as Record<string, any>,
        entityMapping: meeting.entityMapping as any,
        autoTags: meeting.autoTags || [],
        autoAutomations: meeting.autoAutomations || [],
      });

      if (result.success && result.entityId) {
        // Fetch the entity doc to include its full data in the webhook
        try {
          const entitySnap = await adminDb.collection('workspace_entities').doc(result.entityId).get();
          if (entitySnap.exists) {
            entityPayload = {
              id: result.entityId,
              isNew: result.isNew,
              ...entitySnap.data(),
            } as Record<string, unknown> & { id: string; isNew?: boolean };
          }
        } catch (e: any) {
          console.warn('[ENTITY FETCH] Could not fetch entity for webhook:', e?.message);
        }
      }
    } catch (e: any) {
      console.warn('[CAPTURE] Entity capture failed:', e?.message);
    }
  }

  // ── Outbound webhook ────────────────────────────────────────────────────
  const config = meeting.messagingConfig;
  if (!config?.registrationWebhookEnabled || !config?.registrationWebhookUrl) return;

  const payload: RegistrationWebhookPayload = {
    event: 'meeting.registration.created',
    timestamp: new Date().toISOString(),
    meeting: {
      id: meeting.id,
      heroTitle: meeting.heroTitle,
      meetingTime: meeting.meetingTime,
      type: meeting.type,
      meetingLink: meeting.meetingLink,
      meetingSlug: meeting.meetingSlug,
      workspaceIds: meeting.workspaceIds,
    },
    registrant: {
      id: registrant.registrantId,
      name: registrant.name,
      email: registrant.email,
      phone: registrant.phone,
      status: registrant.status as 'approved' | 'waitlisted' | 'registered',
      token: registrant.token,
      registeredAt: registrant.registeredAt,
      personalizedMeetingUrl: registrant.personalizedMeetingUrl,
      registrationData: registrant.registrationData,
    },
    entity: entityPayload,
  };

  await dispatchRegistrationWebhook({
    url: config.registrationWebhookUrl,
    secret: config.registrationWebhookSecret,
    meetingId: meeting.id,
    payload,
  });
}
