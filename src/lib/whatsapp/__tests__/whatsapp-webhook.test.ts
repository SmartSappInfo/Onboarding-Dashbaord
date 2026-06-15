import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  verifySignature,
  parseWebhookEvents,
  isOptOutMessage,
} from '../whatsapp-webhook';

/**
 * Phase 5 — inbound webhook helpers. Signature verification (spec R2) and
 * payload parsing are the security/correctness core; pinned here with no I/O.
 */

const SECRET = 'app-secret-123';
function sign(body: string, secret = SECRET): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifySignature', () => {
  it('accepts a valid HMAC-SHA256 signature', () => {
    const body = '{"hello":"world"}';
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const body = '{"hello":"world"}';
    expect(verifySignature('{"hello":"evil"}', sign(body), SECRET)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const body = '{"a":1}';
    expect(verifySignature(body, sign(body, 'other'), SECRET)).toBe(false);
  });

  it('rejects missing or malformed headers', () => {
    expect(verifySignature('{}', null, SECRET)).toBe(false);
    expect(verifySignature('{}', 'deadbeef', SECRET)).toBe(false);
  });
});

describe('parseWebhookEvents', () => {
  it('extracts inbound messages', () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'pn_1' },
                messages: [
                  { id: 'wamid.IN', from: '233200000000', timestamp: '1750000000', text: { body: 'Hello' } },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseWebhookEvents(body);
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.kind).toBe('message');
    if (ev.kind === 'message') {
      expect(ev.metaMessageId).toBe('wamid.IN');
      expect(ev.from).toBe('233200000000');
      expect(ev.text).toBe('Hello');
      expect(ev.phoneNumberId).toBe('pn_1');
      expect(ev.timestamp).toBe(new Date(1750000000 * 1000).toISOString());
    }
  });

  it('extracts delivery statuses', () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'pn_1' },
                statuses: [
                  { id: 'wamid.OUT', status: 'delivered', recipient_id: '233200000000', conversation: { id: 'conv_1' } },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseWebhookEvents(body);
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.kind).toBe('status');
    if (ev.kind === 'status') {
      expect(ev.metaMessageId).toBe('wamid.OUT');
      expect(ev.status).toBe('delivered');
      expect(ev.conversationId).toBe('conv_1');
    }
  });

  it('returns [] for an empty or malformed body', () => {
    expect(parseWebhookEvents({})).toEqual([]);
    expect(parseWebhookEvents(null)).toEqual([]);
    expect(parseWebhookEvents({ entry: [{ changes: [{ value: {} }] }] })).toEqual([]);
  });

  it('reads button replies as text', () => {
    const body = {
      entry: [{ changes: [{ value: { metadata: { phone_number_id: 'p' }, messages: [{ id: 'm', from: 'x', button: { text: 'STOP' } }] } }] }],
    };
    const events = parseWebhookEvents(body);
    expect(events[0].kind === 'message' && events[0].text).toBe('STOP');
  });
});

describe('isOptOutMessage', () => {
  it('detects opt-out keywords (case/space-insensitive)', () => {
    for (const t of ['STOP', 'stop', '  Stop  ', 'UNSUBSCRIBE', 'cancel', 'opt-out']) {
      expect(isOptOutMessage(t)).toBe(true);
    }
  });
  it('ignores normal messages', () => {
    expect(isOptOutMessage('I want to stop by tomorrow')).toBe(false);
    expect(isOptOutMessage('Hello')).toBe(false);
    expect(isOptOutMessage('')).toBe(false);
  });
});
