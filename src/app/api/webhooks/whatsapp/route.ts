import { NextRequest } from 'next/server';
import { after } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { decrypt } from '@/lib/whatsapp/crypto-vault';
import { WhatsAppCredentialRepository } from '@/lib/whatsapp/whatsapp-credential-repository';
import { WhatsAppTemplateRepository } from '@/lib/whatsapp/whatsapp-template-repository';
import {
  verifySignature,
  parseWebhookEvents,
  isOptOutMessage,
  type ParsedWebhookEvent,
  type InboundMessageEvent,
  type StatusEvent,
} from '@/lib/whatsapp/whatsapp-webhook';
import { parseTemplateStatusEvents, type TemplateStatusEvent } from '@/lib/whatsapp/whatsapp-domain';
import type { WhatsAppConnection } from '@/lib/whatsapp/whatsapp-types';

// AES-GCM + Admin SDK need full Node crypto (spec R4).
export const runtime = 'nodejs';

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * GET — Meta verification handshake. Echoes the challenge if the supplied
 * verify token matches a configured connection.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token) {
    // Embedded Signup orgs share the platform-level verify token (one webhook
    // configured on the platform Meta app). Manual orgs use their per-connection token.
    if (process.env.META_WEBHOOK_VERIFY_TOKEN && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge ?? '', { status: 200 });
    }
    const conn = await WhatsAppCredentialRepository.findByVerifyToken(token);
    if (conn) return new Response(challenge ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

/**
 * POST — inbound messages + delivery/read statuses. Validates the HMAC
 * signature, then ACKs immediately and processes in `after()` so Meta never
 * sees a slow response (spec R2/R3).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const events = parseWebhookEvents(body);
  const templateEvents = parseTemplateStatusEvents(body);
  if (events.length === 0 && templateEvents.length === 0) return new Response('OK', { status: 200 });

  // Messages/statuses carry a phone_number_id; template-status events carry only
  // the WABA id (`entry[].id`). One delivery belongs to a single connection.
  const conn = events.length
    ? await WhatsAppCredentialRepository.getByPhoneNumberId(events[0].phoneNumberId)
    : await WhatsAppCredentialRepository.getByWabaId(templateEvents[0].wabaId);
  if (!conn) {
    // Unknown number/WABA — ACK to stop retries; nothing actionable.
    console.warn('[WA-WEBHOOK] No connection for', events[0]?.phoneNumberId ?? templateEvents[0]?.wabaId);
    return new Response('OK', { status: 200 });
  }

  // Resolve the signing secret: Embedded Signup orgs are signed with the
  // PLATFORM app secret (one Meta app); manual orgs use their own app secret.
  const appSecret =
    conn.connectionType === 'embedded_signup'
      ? process.env.META_APP_SECRET || null
      : conn.appSecret
        ? decrypt(conn.appSecret)
        : null;

  if (appSecret) {
    if (!verifySignature(rawBody, signature, appSecret)) {
      return new Response('Invalid signature', { status: 401 });
    }
  } else {
    console.warn('[WA-WEBHOOK] No app secret available; processing unverified payload for', conn.organizationId);
  }

  after(async () => {
    try {
      if (events.length) await processWebhookEvents(conn, events);
      if (templateEvents.length) await processTemplateStatusEvents(templateEvents);
    } catch (err) {
      console.error('[WA-WEBHOOK] Processing error:', (err as Error).message);
    }
  });

  return new Response('OK', { status: 200 });
}

/**
 * Apply template approval/rejection/category events to the local mirror,
 * idempotently (keyed on template + outcome, so re-delivery is a no-op). A
 * template not yet mirrored locally is skipped — a later sync reconciles it.
 */
async function processTemplateStatusEvents(events: TemplateStatusEvent[]) {
  for (const ev of events) {
    const eventKey = `tpl_${ev.metaTemplateId}_${ev.status ?? ev.category ?? 'x'}`;
    const ref = adminDb.collection('webhook_events').doc(eventKey);
    try {
      await ref.create({ provider: 'whatsapp', processedAt: new Date().toISOString() });
    } catch {
      continue; // already processed
    }
    await WhatsAppTemplateRepository.updateStatusByMetaId(ev.metaTemplateId, {
      status: ev.status,
      rejectedReason: ev.rejectedReason,
      category: ev.category,
    });
  }
}

/** Process events idempotently — each Meta event id is handled at most once. */
async function processWebhookEvents(conn: WhatsAppConnection, events: ParsedWebhookEvent[]) {
  for (const ev of events) {
    const eventKey = ev.kind === 'status' ? `${ev.metaMessageId}_${ev.status}` : ev.metaMessageId;
    const ref = adminDb.collection('webhook_events').doc(eventKey);
    try {
      // create() fails if the doc exists → idempotent skip (spec R2).
      await ref.create({ provider: 'whatsapp', processedAt: new Date().toISOString() });
    } catch {
      continue;
    }
    if (ev.kind === 'message') await handleInbound(conn, ev);
    else await handleStatus(conn, ev);
  }
}

async function handleInbound(conn: WhatsAppConnection, ev: InboundMessageEvent) {
  const now = Date.now();

  // Refresh the 24h customer-service window so free-form replies can be sent.
  await adminDb
    .collection('whatsapp_sessions')
    .doc(`${conn.organizationId}_${ev.from}`)
    .set(
      {
        organizationId: conn.organizationId,
        contactPhone: ev.from,
        lastInboundAt: ev.timestamp,
        expiresAt: new Date(now + SESSION_WINDOW_MS).toISOString(),
      },
      { merge: true },
    );

  // Opt-out keyword → suppress WhatsApp for this recipient (compliance, spec F3).
  if (isOptOutMessage(ev.text)) {
    const { suppressRecipient } = await import('@/lib/suppression-service');
    await suppressRecipient({
      recipient: ev.from,
      workspaceId: 'global',
      channel: 'whatsapp',
      reason: 'unsubscribed',
    });
  }

  // Record the inbound message so it threads into Conversations.
  await adminDb.collection('message_logs').add({
    organizationId: conn.organizationId,
    title: 'Inbound WhatsApp',
    templateId: '',
    templateName: 'Inbound',
    senderProfileId: '',
    senderName: ev.from,
    channel: 'whatsapp',
    direction: 'inbound',
    recipient: ev.from,
    body: ev.text,
    status: 'sent',
    sentAt: ev.timestamp,
    variables: {},
    workspaceIds: ['onboarding'],
    providerId: ev.metaMessageId,
    providerStatus: 'received',
    metaMessageId: ev.metaMessageId,
  });
}

async function handleStatus(conn: WhatsAppConnection, ev: StatusEvent) {
  // Reconcile the outbound log by Meta message id.
  const snap = await adminDb
    .collection('message_logs')
    .where('metaMessageId', '==', ev.metaMessageId)
    .limit(1)
    .get();

  if (snap.empty) return;
  const logDoc = snap.docs[0];
  await logDoc.ref.update({ providerStatus: ev.status, updatedAt: new Date().toISOString() });

  // Feed campaign realtime stats, mirroring the Resend webhook.
  const log = logDoc.data();
  if (log.campaignId) {
    const { updateCampaignRealtimeStat } = await import('@/lib/campaign-analytics');
    if (ev.status === 'read') await updateCampaignRealtimeStat(log.campaignId, 'totalOpened');
    else if (ev.status === 'failed') await updateCampaignRealtimeStat(log.campaignId, 'totalFailed');
  }
}
