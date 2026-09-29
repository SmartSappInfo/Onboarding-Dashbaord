/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Self-Healing Webhook Dispatch & Dead-Letter Queue (Phase 6):
 * 1. Purpose & Resilience (FM-P6-02):
 *    Guarantees reliable delivery of document events (e.g., `document.completed`,
 *    `signing.recipient_completed`, `obligation.created`) to external ERP/CRM systems.
 * 2. Exponential Backoff & Dead-Letter Queue (DLQ):
 *    Failed delivery attempts follow deterministic exponential backoff delays
 *    (1m, 5m, 15m, 1h, 6h). After 5 failed attempts, deliveries transition to the
 *    `dead_letter` state, awaiting 1-click manual replay from the Agreements Hub.
 * 3. Cryptographic Signature & Anti-Replay:
 *    All outgoing webhooks are signed using HMAC-SHA256 (`X-DocSigning-Signature`)
 *    with a 5-minute timestamp tolerance window preventing replay attacks.
 * 4. Strict Tenant Isolation (FM-P6-08):
 *    All subscriptions and deliveries are partitioned by `workspaceId`.
 * 5. Strict Zero-Tolerance Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import {
  WebhookSubscription,
  WebhookSubscriptionSchema,
  WebhookDeliveryLog,
  WebhookDeliveryLogSchema,
} from '@/lib/types/document-signing';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import {
  checkCircuitBreakerStatus,
  recordCircuitBreakerSuccess,
  recordCircuitBreakerFailure,
} from './resilient-outbox-service';

/**
 * Calculates exponential backoff delay in milliseconds based on attempt count.
 * Returns -1 when the maximum retry threshold (5) is exceeded.
 */
export function calculateBackoffDelayMs(attemptCount: number): number {
  switch (attemptCount) {
    case 0:
      return 60 * 1000; // 1 minute
    case 1:
      return 5 * 60 * 1000; // 5 minutes
    case 2:
      return 15 * 60 * 1000; // 15 minutes
    case 3:
      return 60 * 60 * 1000; // 1 hour
    case 4:
      return 6 * 60 * 60 * 1000; // 6 hours
    default:
      return -1; // Dead-Letter threshold exceeded
  }
}

/**
 * Generates an HMAC-SHA256 signature for outgoing webhook payload verification.
 * Format: `t={timestamp},v1={hex_hash}`
 */
export function generateWebhookHmacSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${hmac}`;
}

/**
 * Verifies an incoming webhook HMAC signature, defending against payload tampering and replay attacks.
 */
export function verifyWebhookHmacSignature(
  payload: string,
  secret: string,
  headerValue: string,
  toleranceSeconds = 300
): boolean {
  try {
    const parts = headerValue.split(',');
    let timestamp = -1;
    let signature = '';

    for (const part of parts) {
      const [key, val] = part.split('=');
      if (key === 't') timestamp = parseInt(val, 10);
      if (key === 'v1') signature = val;
    }

    if (timestamp === -1 || !signature) {
      return false;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
      return false; // Expired timestamp / replay attack detected
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const actualBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

/**
 * Creates pending delivery records for all active subscriptions subscribed to an event.
 */
export async function scheduleWebhookDeliveriesForEvent(
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<WebhookDeliveryLog[]> {
  const subsSnapshot = await adminDb
    .collection(`workspaces/${workspaceId}/webhook_subscriptions`)
    .where('isActive', '==', true)
    .get();

  const matchingSubs: WebhookSubscription[] = [];
  for (const doc of subsSnapshot.docs) {
    const parsed = WebhookSubscriptionSchema.safeParse(doc.data());
    if (
      parsed.success &&
      parsed.data.workspaceId === workspaceId &&
      parsed.data.events.includes(event)
    ) {
      matchingSubs.push(parsed.data);
    }
  }

  const deliveries: WebhookDeliveryLog[] = [];
  const now = new Date().toISOString();

  for (const sub of matchingSubs) {
    const deliveryId = `del_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const deliveryLog: WebhookDeliveryLog = {
      id: deliveryId,
      subscriptionId: sub.id,
      workspaceId,
      event,
      payload,
      status: 'pending',
      attemptCount: 0,
      createdAt: now,
    };

    const validated = WebhookDeliveryLogSchema.parse(deliveryLog);
    await adminDb
      .collection(`workspaces/${workspaceId}/webhook_deliveries`)
      .doc(deliveryId)
      .set(validated);

    deliveries.push(validated);
  }

  return deliveries;
}

/**
 * Dispatches a webhook delivery attempt over HTTP with HMAC headers and exponential backoff retry.
 */
export async function dispatchWebhookDelivery(
  deliveryLog: WebhookDeliveryLog,
  subscription: WebhookSubscription,
  fetcher: typeof fetch = fetch
): Promise<WebhookDeliveryLog> {
  const stringifiedPayload = JSON.stringify(deliveryLog.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureHeader = generateWebhookHmacSignature(
    stringifiedPayload,
    subscription.secret,
    timestamp
  );

  const attempt = deliveryLog.attemptCount + 1;
  const nowIso = new Date().toISOString();
  const retryLimit = subscription.retryLimit ?? 5;

  // Circuit breaker pre-check (FM-P6-05 / RSK-02)
  const circuit = await checkCircuitBreakerStatus(deliveryLog.workspaceId, subscription.url);
  if (!circuit.canExecute) {
    const cooldownDelay = Math.max(30000, circuit.remainingCooldownMs);
    const updatedLog: WebhookDeliveryLog = {
      ...deliveryLog,
      status: 'failed',
      lastAttemptAt: nowIso,
      nextRetryAt: new Date(Date.now() + cooldownDelay).toISOString(),
      errorMessage: `Circuit breaker OPEN for ${subscription.url}. Cooldown active.`,
    };
    await adminDb
      .collection(`workspaces/${deliveryLog.workspaceId}/webhook_deliveries`)
      .doc(deliveryLog.id)
      .set(updatedLog, { merge: true });
    return updatedLog;
  }

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let errorMsg: string | null = null;
  let isSuccess = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetcher(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DocSigning-Signature': signatureHeader,
        'X-DocSigning-Event': deliveryLog.event,
        'X-DocSigning-Delivery': deliveryLog.id,
      },
      body: stringifiedPayload,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = res.status;
    const text = await res.text();
    responseBody = text.slice(0, 1000);
    isSuccess = res.ok;
  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : 'Network error';
  }

  let nextStatus: WebhookDeliveryLog['status'] = 'failed';
  let nextRetryAt: string | null = null;

  if (isSuccess) {
    await recordCircuitBreakerSuccess(deliveryLog.workspaceId, subscription.url);
    nextStatus = 'delivered';
  } else {
    await recordCircuitBreakerFailure(deliveryLog.workspaceId, subscription.url);
    if (attempt >= retryLimit) {
      nextStatus = 'dead_letter';
      errorMsg = errorMsg ?? `HTTP ${responseStatus}: Exceeded maximum retry limit (${retryLimit})`;
    } else {
      nextStatus = 'failed';
      const delay = calculateBackoffDelayMs(attempt - 1);
      nextRetryAt = delay > 0 ? new Date(Date.now() + delay).toISOString() : null;
    }
  }

  const updatedLog: WebhookDeliveryLog = {
    ...deliveryLog,
    status: nextStatus,
    attemptCount: attempt,
    lastAttemptAt: nowIso,
    nextRetryAt,
    responseStatusCode: responseStatus,
    responseBody,
    errorMessage: errorMsg,
  };

  const validated = WebhookDeliveryLogSchema.parse(updatedLog);

  await adminDb
    .collection(`workspaces/${deliveryLog.workspaceId}/webhook_deliveries`)
    .doc(deliveryLog.id)
    .set(validated);

  return validated;
}

/**
 * Replays a failed or dead-lettered webhook delivery from the Agreements Hub console.
 */
export async function replayDeadLetterWebhook(
  workspaceId: string,
  deliveryLogId: string,
  fetcher: typeof fetch = fetch
): Promise<WebhookDeliveryLog> {
  const docRef = adminDb
    .collection(`workspaces/${workspaceId}/webhook_deliveries`)
    .doc(deliveryLogId);

  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new Error(`Webhook delivery log ${deliveryLogId} not found`);
  }

  const log = WebhookDeliveryLogSchema.parse(docSnap.data());
  if (log.workspaceId !== workspaceId) {
    throw new Error('Tenant access violation');
  }

  const subSnap = await adminDb
    .collection(`workspaces/${workspaceId}/webhook_subscriptions`)
    .doc(log.subscriptionId)
    .get();

  if (!subSnap.exists) {
    throw new Error(`Associated subscription ${log.subscriptionId} not found`);
  }

  const sub = WebhookSubscriptionSchema.parse(subSnap.data());

  // Reset attempt count for manual replay
  const resetLog: WebhookDeliveryLog = {
    ...log,
    status: 'pending',
    attemptCount: 0,
    errorMessage: null,
  };

  return dispatchWebhookDelivery(resetLog, sub, fetcher);
}

/**
 * Retrieves all registered webhook subscriptions for a workspace.
 */
export async function getWorkspaceWebhookSubscriptions(
  workspaceId: string
): Promise<WebhookSubscription[]> {
  const snapshot = await adminDb
    .collection(`workspaces/${workspaceId}/webhook_subscriptions`)
    .get();

  const subscriptions: WebhookSubscription[] = [];
  for (const doc of snapshot.docs) {
    const parsed = WebhookSubscriptionSchema.safeParse(doc.data());
    if (parsed.success && parsed.data.workspaceId === workspaceId) {
      subscriptions.push(parsed.data);
    }
  }

  return subscriptions;
}

/**
 * Creates and registers a new webhook subscription.
 */
export async function createWebhookSubscription(
  workspaceId: string,
  input: Omit<WebhookSubscription, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>
): Promise<WebhookSubscription> {
  const subId = `wh_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  const subData: WebhookSubscription = {
    ...input,
    id: subId,
    workspaceId,
    createdAt: now,
    updatedAt: now,
  };

  const validated = WebhookSubscriptionSchema.parse(subData);

  await adminDb
    .collection(`workspaces/${workspaceId}/webhook_subscriptions`)
    .doc(subId)
    .set(validated);

  return validated;
}

/**
 * Fetches recent webhook delivery logs for audit, telemetry, and dead-letter review.
 */
export async function getWorkspaceWebhookDeliveryLogs(
  workspaceId: string,
  limitCount = 50
): Promise<WebhookDeliveryLog[]> {
  const snapshot = await adminDb
    .collection(`workspaces/${workspaceId}/webhook_deliveries`)
    .limit(limitCount)
    .get();

  const logs: WebhookDeliveryLog[] = [];
  for (const doc of snapshot.docs) {
    const parsed = WebhookDeliveryLogSchema.safeParse(doc.data());
    if (parsed.success && parsed.data.workspaceId === workspaceId) {
      logs.push(parsed.data);
    }
  }

  return logs;
}
