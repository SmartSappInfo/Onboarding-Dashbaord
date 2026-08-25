/**
 * @fileoverview Pure Cryptographic Webhook Signing & Verification Engine.
 * Generates HMAC-SHA256 signatures with timestamp anti-replay protections.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Uses timingSafeEqual for timing-attack resilience.
 * - Conforms to standard Stripe/GitHub-style signature headers: `t=timestamp,v1=signatureHex`.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { MeetingWebhookEvent } from './types/webhooks';

/**
 * Signs a webhook payload string using HMAC-SHA256.
 */
export function signWebhookPayload(
  rawBody: string,
  secretKey: string,
  timestamp = Math.floor(Date.now() / 1000)
): { header: string; signatureHex: string; timestamp: number } {
  const signedPayload = `${timestamp}.${rawBody}`;
  const hmac = createHmac('sha256', secretKey);
  hmac.update(signedPayload);
  const signatureHex = hmac.digest('hex');

  const header = `t=${timestamp},v1=${signatureHex}`;
  return { header, signatureHex, timestamp };
}

/**
 * Validates an incoming webhook signature using timing-safe comparisons and timestamp age checks.
 */
export function verifyWebhookSignature(
  signatureHeader: string,
  rawBody: string,
  secretKey: string,
  maxAgeSeconds = 300,
  referenceNowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!signatureHeader || !rawBody || !secretKey) return false;

  const parts = signatureHeader.split(',');
  let timestampStr: string | null = null;
  let signatureHex: string | null = null;

  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') timestampStr = v;
    if (k === 'v1') signatureHex = v;
  }

  if (!timestampStr || !signatureHex) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Replay protection: Check timestamp freshness
  if (Math.abs(referenceNowSeconds - timestamp) > maxAgeSeconds) {
    return false;
  }

  const expectedSignature = signWebhookPayload(rawBody, secretKey, timestamp).signatureHex;

  try {
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const providedBuf = Buffer.from(signatureHex, 'hex');

    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Formats a canonical outbound webhook event envelope.
 */
export function buildWebhookEventPayload(
  event: MeetingWebhookEvent,
  data: Record<string, unknown>,
  workspaceId: string
): Record<string, unknown> {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event,
    workspaceId,
    timestamp: new Date().toISOString(),
    data,
  };
}
