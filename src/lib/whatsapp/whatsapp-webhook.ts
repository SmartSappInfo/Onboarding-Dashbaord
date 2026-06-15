/**
 * @fileOverview Pure WhatsApp webhook helpers: HMAC signature verification
 * (constant-time), Meta payload parsing, and opt-out detection. No I/O — the
 * route handler wires these to Firestore.
 */

import crypto from 'crypto';

/**
 * Verify Meta's `X-Hub-Signature-256` header against the raw body using the
 * org's app secret. Constant-time compare (spec R2).
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface InboundMessageEvent {
  kind: 'message';
  metaMessageId: string;
  from: string; // sender phone (digits)
  text: string;
  timestamp: string; // ISO
  phoneNumberId: string;
}

export interface StatusEvent {
  kind: 'status';
  metaMessageId: string;
  status: string; // sent | delivered | read | failed
  recipient: string;
  conversationId?: string;
  phoneNumberId: string;
}

export type ParsedWebhookEvent = InboundMessageEvent | StatusEvent;

interface MetaMessage {
  id: string;
  from: string;
  timestamp?: string;
  text?: { body?: string };
  button?: { text?: string };
}
interface MetaStatus {
  id: string;
  status: string;
  recipient_id: string;
  conversation?: { id?: string };
}

/** Flatten Meta's nested webhook body into a normalized event list. */
export function parseWebhookEvents(body: unknown): ParsedWebhookEvent[] {
  const events: ParsedWebhookEvent[] = [];
  const entries = (body as { entry?: unknown[] } | null)?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value ?? {};
      const phoneNumberId =
        ((value.metadata as { phone_number_id?: string })?.phone_number_id) ?? '';

      for (const m of (value.messages as MetaMessage[] | undefined) ?? []) {
        events.push({
          kind: 'message',
          metaMessageId: m.id,
          from: m.from,
          text: m.text?.body ?? m.button?.text ?? '',
          timestamp: m.timestamp
            ? new Date(Number(m.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
          phoneNumberId,
        });
      }

      for (const s of (value.statuses as MetaStatus[] | undefined) ?? []) {
        events.push({
          kind: 'status',
          metaMessageId: s.id,
          status: s.status,
          recipient: s.recipient_id,
          conversationId: s.conversation?.id,
          phoneNumberId,
        });
      }
    }
  }
  return events;
}

const OPT_OUT_RE = /^\s*(stop|unsubscribe|cancel|end|quit|opt-?out)\s*$/i;

/** Whether an inbound message is a standalone opt-out keyword. */
export function isOptOutMessage(text: string): boolean {
  return OPT_OUT_RE.test(text || '');
}
