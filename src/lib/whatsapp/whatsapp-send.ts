/**
 * @fileOverview WhatsApp outbound send: pure payload/session/decision helpers
 * plus the `sendWhatsApp` orchestration the messaging engine delegates to.
 *
 * The pure helpers (payload shape, 24h window, send-mode decision) are
 * unit-tested with no I/O. `sendWhatsApp` lazily imports Firestore-backed
 * repositories so this module stays importable in pure tests and out of client
 * bundles (matching the engine's dynamic-import style).
 */

import type { MessageTemplate } from '@/lib/types';

const WINDOW_HOURS = 24;

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Whether the customer-service window is still open (≤24h since last inbound). */
export function isSessionOpen(
  lastInboundAt: string | undefined,
  now: Date = new Date(),
  windowHours = WINDOW_HOURS,
): boolean {
  if (!lastInboundAt) return false;
  const last = new Date(lastInboundAt).getTime();
  if (Number.isNaN(last)) return false;
  return now.getTime() - last <= windowHours * 3_600_000;
}

/** Meta expects digits only (E.164 without the leading '+'). */
export function normalizeWaPhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

/** Resolve positional params from the variable bag, coercing to strings. */
export function buildTemplateParams(paramMap: string[], variables: Record<string, unknown>): string[] {
  return paramMap.map((key) => {
    const v = variables?.[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

export interface TemplatePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: Array<{ type: 'body'; parameters: Array<{ type: 'text'; text: string }> }>;
  };
}

export function buildTemplatePayload(input: {
  to: string;
  name: string;
  language: string;
  params: string[];
}): TemplatePayload {
  const components =
    input.params.length > 0
      ? [{ type: 'body' as const, parameters: input.params.map((text) => ({ type: 'text' as const, text })) }]
      : undefined;
  return {
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: {
      name: input.name,
      language: { code: input.language },
      ...(components ? { components } : {}),
    },
  };
}

export interface TextPayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string };
}

export function buildTextPayload(to: string, body: string): TextPayload {
  return { messaging_product: 'whatsapp', to, type: 'text', text: { body } };
}

/** Decide how to send: bound template → 'template'; else open session → 'text'; else blocked. */
export function decideSendMode(input: { hasTemplate: boolean; sessionOpen: boolean }): 'template' | 'text' | 'blocked' {
  if (input.hasTemplate) return 'template';
  if (input.sessionOpen) return 'text';
  return 'blocked';
}

// ── Orchestration (I/O) ──────────────────────────────────────────────────────

export interface SendWhatsAppInput {
  organizationId: string;
  recipient: string;
  template: MessageTemplate;
  resolvedBody: string;
  variables: Record<string, unknown>;
}

export interface SendWhatsAppResult {
  metaMessageId: string | null;
  status: string;
}

/**
 * Send a WhatsApp message for the engine. Resolves the org connection,
 * re-checks the session window at send time (F6), enforces approved-template /
 * session rules (F5/F7), and returns the Meta message id for status
 * reconciliation. Throws a descriptive error on any guard failure (the engine
 * surfaces it the same way as the SMS hygiene block).
 */
export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const { organizationId, template, resolvedBody, variables } = input;

  const [{ WhatsAppCredentialRepository }, { WhatsAppTemplateRepository }, { MetaCloudApiClient }, { adminDb }] =
    await Promise.all([
      import('./whatsapp-credential-repository'),
      import('./whatsapp-template-repository'),
      import('./meta-cloud-client'),
      import('@/lib/firebase-admin'),
    ]);

  const creds = await WhatsAppCredentialRepository.getCredentials(organizationId);
  if (!creds) throw new Error('No WhatsApp connection configured for this organization.');

  const to = normalizeWaPhone(input.recipient);
  if (!to) throw new Error('Recipient has no valid WhatsApp phone number.');

  // Re-check the session window at SEND time, not compose time (F6).
  const sessionSnap = await adminDb.collection('whatsapp_sessions').doc(`${organizationId}_${to}`).get();
  const sessionOpen = isSessionOpen(
    sessionSnap.exists ? (sessionSnap.data()?.lastInboundAt as string | undefined) : undefined,
  );

  const hasTemplate = !!template.whatsappTemplateName;
  const mode = decideSendMode({ hasTemplate, sessionOpen });

  const client = new MetaCloudApiClient(creds);
  let payload: TemplatePayload | TextPayload;

  if (mode === 'template') {
    // F5: refuse to send a template Meta hasn't (still) approved.
    const waId = `${organizationId}_${template.whatsappTemplateName}_${template.whatsappLanguage}`;
    const wa = await WhatsAppTemplateRepository.get(waId);
    if (!wa) throw new Error(`WhatsApp template "${template.whatsappTemplateName}" not found — re-sync from Meta.`);
    if (wa.status !== 'APPROVED') {
      throw new Error(`WhatsApp template "${wa.name}" is ${wa.status}; cannot send.`);
    }
    payload = buildTemplatePayload({
      to,
      name: wa.name,
      language: wa.language,
      params: buildTemplateParams(template.whatsappParamMap ?? [], variables),
    });
  } else if (mode === 'text') {
    payload = buildTextPayload(to, resolvedBody);
  } else {
    throw new Error(
      'WhatsApp requires an approved template outside the 24-hour customer-service window.',
    );
  }

  const res = await client.sendMessage(payload);
  return { metaMessageId: res.metaMessageId, status: 'sent' };
}
