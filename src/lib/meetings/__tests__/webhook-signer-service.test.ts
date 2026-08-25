import { describe, it, expect } from 'vitest';
import {
  signWebhookPayload,
  verifyWebhookSignature,
  buildWebhookEventPayload,
} from '../webhook-signer-service';

describe('Webhook HMAC-SHA256 Signer Service', () => {
  const secretKey = 'whsec_test_secret_key_12345';
  const sampleBody = JSON.stringify({ event: 'booking.created', bookingId: 'b_123' });
  const fixedTimestamp = 1724600000;

  it('generates valid HMAC-SHA256 signature header with timestamp', () => {
    const { header, signatureHex, timestamp } = signWebhookPayload(sampleBody, secretKey, fixedTimestamp);

    expect(header).toBe(`t=${fixedTimestamp},v1=${signatureHex}`);
    expect(timestamp).toBe(fixedTimestamp);
    expect(signatureHex).toMatch(/^[a-f0-9]{64}$/);
  });

  it('successfully verifies a freshly signed webhook payload', () => {
    const { header } = signWebhookPayload(sampleBody, secretKey, fixedTimestamp);
    const isValid = verifyWebhookSignature(header, sampleBody, secretKey, 300, fixedTimestamp + 10);

    expect(isValid).toBe(true);
  });

  it('rejects forged payloads with incorrect secret or tampered body', () => {
    const { header } = signWebhookPayload(sampleBody, secretKey, fixedTimestamp);
    const isTampered = verifyWebhookSignature(
      header,
      JSON.stringify({ event: 'booking.created', bookingId: 'b_999_forged' }),
      secretKey,
      300,
      fixedTimestamp + 10
    );

    expect(isTampered).toBe(false);

    const isWrongSecret = verifyWebhookSignature(
      header,
      sampleBody,
      'whsec_wrong_secret',
      300,
      fixedTimestamp + 10
    );
    expect(isWrongSecret).toBe(false);
  });

  it('rejects stale webhook payloads exceeding max age', () => {
    const { header } = signWebhookPayload(sampleBody, secretKey, fixedTimestamp);
    // Age difference 600s (> 300s maxAge)
    const isStale = verifyWebhookSignature(header, sampleBody, secretKey, 300, fixedTimestamp + 600);
    expect(isStale).toBe(false);
  });

  it('constructs well-formed webhook event envelope', () => {
    const envelope = buildWebhookEventPayload('booking.created', { bookingId: 'b_1' }, 'w_1');

    expect(envelope.event).toBe('booking.created');
    expect(envelope.workspaceId).toBe('w_1');
    expect(envelope.id).toMatch(/^evt_/);
    expect(envelope.timestamp).toBeDefined();
  });
});
