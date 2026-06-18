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
import { getTemplateRuntimeNeeds, hasRuntimeNeeds } from './whatsapp-domain';

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

type TemplateTextParam = { type: 'text'; text: string };
type MediaRef = { link: string } | { id: string };
type HeaderMediaParam =
  | { type: 'image'; image: MediaRef }
  | { type: 'video'; video: MediaRef }
  | { type: 'document'; document: MediaRef };

export type TemplateComponent =
  | { type: 'header'; parameters: HeaderMediaParam[] }
  | { type: 'body'; parameters: TemplateTextParam[] }
  | { type: 'button'; sub_type: string; index: string; parameters: TemplateTextParam[] };

export interface TemplatePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  };
}

/** Runtime media supplied at send time for a media-header template. */
export interface HeaderMediaRef {
  type: 'image' | 'video' | 'document';
  /** A public URL, or a Meta media id — exactly one. */
  link?: string;
  id?: string;
}

/** A dynamic button parameter (e.g. the {{1}} suffix of a URL button). */
export interface ButtonParam {
  subType: 'url' | 'quick_reply';
  index: number;
  text: string;
}

function buildHeaderComponent(media: HeaderMediaRef): TemplateComponent {
  const ref: MediaRef = media.id ? { id: media.id } : { link: media.link ?? '' };
  if (media.type === 'image') return { type: 'header', parameters: [{ type: 'image', image: ref }] };
  if (media.type === 'video') return { type: 'header', parameters: [{ type: 'video', video: ref }] };
  return { type: 'header', parameters: [{ type: 'document', document: ref }] };
}

/**
 * Build a Meta template message. Body params are the common case; the optional
 * `headerMedia` and `buttonParams` emit header/button components only when a
 * template actually has those dynamic parts. With neither supplied, the output
 * is byte-identical to the body-only payload (regression-guarded by tests).
 * Component order follows Meta's: header → body → button.
 */
export function buildTemplatePayload(input: {
  to: string;
  name: string;
  language: string;
  params: string[];
  headerMedia?: HeaderMediaRef;
  buttonParams?: ButtonParam[];
}): TemplatePayload {
  const components: TemplateComponent[] = [];

  if (input.headerMedia) components.push(buildHeaderComponent(input.headerMedia));

  if (input.params.length > 0) {
    components.push({ type: 'body', parameters: input.params.map((text) => ({ type: 'text', text })) });
  }

  for (const b of input.buttonParams ?? []) {
    components.push({
      type: 'button',
      sub_type: b.subType,
      index: String(b.index),
      parameters: [{ type: 'text', text: b.text }],
    });
  }

  return {
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: {
      name: input.name,
      language: { code: input.language },
      ...(components.length > 0 ? { components } : {}),
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
    // The engine can't supply per-send media / dynamic-URL values, so refuse
    // rather than let Meta reject. Adoption is blocked for such templates, so
    // this guards any adopted before that rule existed.
    if (hasRuntimeNeeds(getTemplateRuntimeNeeds(wa.components))) {
      throw new Error(
        `WhatsApp template "${wa.name}" needs a media header or dynamic URL value, which campaign sends don't support — use the per-message test send.`,
      );
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
