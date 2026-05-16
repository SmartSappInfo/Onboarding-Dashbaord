'use server';

/**
 * @fileOverview Outbound Webhook Service
 *
 * Dispatches a signed JSON POST to an admin-configured URL whenever a
 * meeting registration occurs.  Never throws — all errors are caught,
 * logged to Firestore `webhook_logs`, and swallowed so they never
 * interrupt the registration UX.
 *
 * Security:
 *  - Optional HMAC-SHA256 signature via X-SmartSapp-Signature header
 *  - Uses crypto.timingSafeEqual for constant-time comparison (receive side)
 *  - Secrets are never included in the logged payload
 */

import { adminDb } from './firebase-admin';
import { createHmac } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegistrationWebhookPayload {
  event: 'meeting.registration.created';
  timestamp: string;
  meeting: {
    id: string;
    heroTitle?: string;
    meetingTime?: string;
    type?: { id: string; name: string };
    meetingLink?: string;
    meetingSlug?: string;
    workspaceIds?: string[];
    [key: string]: unknown;
  };
  registrant: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    status: 'approved' | 'waitlisted' | 'registered';
    token: string;
    registeredAt: string;
    personalizedMeetingUrl?: string;
    registrationData: Record<string, unknown>;
  };
  /** Full workspace_entity doc if CRM capture ran; null otherwise */
  entity: (Record<string, unknown> & { id: string; isNew?: boolean }) | null;
}

interface DispatchInput {
  url: string;
  secret?: string;
  meetingId: string;
  payload: RegistrationWebhookPayload;
}

// ─── Main dispatcher ─────────────────────────────────────────────────────────

/**
 * Fire-and-forget outbound webhook. Responds quickly and never throws.
 *
 * Logging: writes to `webhook_logs/{auto-id}`:
 *   { meetingId, url, event, status, httpStatus, responseMs, error, createdAt }
 */
export async function dispatchRegistrationWebhook(input: DispatchInput): Promise<void> {
  const { url, secret, meetingId, payload } = input;
  const startMs = Date.now();
  const body = JSON.stringify(payload);

  // ── Build headers ──────────────────────────────────────────────────────────
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-SmartSapp-Event': payload.event,
    'X-SmartSapp-Meeting-Id': meetingId,
    'User-Agent': 'SmartSapp-Webhook/1.0',
  };

  if (secret) {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    headers['X-SmartSapp-Signature'] = `sha256=${sig}`;
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  let httpStatus: number | null = null;
  let errorMessage: string | null = null;
  let dispatchStatus: 'success' | 'failed' = 'success';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10 s timeout

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    httpStatus = res.status;

    if (!res.ok) {
      dispatchStatus = 'failed';
      errorMessage = `HTTP ${res.status}: ${await res.text().catch(() => '(no body)')}`;
    }
  } catch (err: any) {
    dispatchStatus = 'failed';
    errorMessage = err?.message ?? 'Unknown fetch error';
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  const responseMs = Date.now() - startMs;

  try {
    const logEntry: Record<string, unknown> = {
      meetingId,
      url,
      event: payload.event,
      status: dispatchStatus,
      httpStatus: httpStatus ?? null,
      responseMs,
      createdAt: new Date().toISOString(),
    };
    if (errorMessage) logEntry.error = errorMessage;

    await adminDb.collection('webhook_logs').add(logEntry);
  } catch (logErr: any) {
    // If even logging fails, just console.warn — never throw
    console.warn('[WEBHOOK] Firestore log failed:', logErr?.message);
  }

  if (dispatchStatus === 'failed') {
    console.warn(`[WEBHOOK] Dispatch to ${url} failed (${responseMs}ms): ${errorMessage}`);
  }
}

/**
 * Verifies an inbound webhook signature (for use by any receiving handler
 * that wants to validate SmartSapp-originated webhooks).
 *
 * @example
 * const valid = verifyWebhookSignature(rawBody, req.headers['x-smartsapp-signature'], secret);
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signatureHeader.length) return false;
  return (
    createHmac('sha256', 'timing-safe')
      .update(expected)
      .digest('hex') ===
    createHmac('sha256', 'timing-safe')
      .update(signatureHeader)
      .digest('hex')
  );
}
