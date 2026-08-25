'use server';

/**
 * @fileoverview Server Actions for Outbound Webhook Subscriptions & Developer Hub.
 * Manages webhook endpoints, HMAC secret rotation, test event dispatches, and delivery logs.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Outbound requests have a strict 5-second timeout to prevent server hanging.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  MeetingWebhookEndpoint,
  WebhookDeliveryLog,
  MeetingWebhookEvent,
} from '@/lib/meetings/types/webhooks';
import {
  signWebhookPayload,
  buildWebhookEventPayload,
} from '@/lib/meetings/webhook-signer-service';
import { randomBytes } from 'crypto';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Fetches all registered webhook endpoints for a workspace.
 */
export async function getMeetingWebhooksAction(
  workspaceId: string
): Promise<{ success: boolean; endpoints?: MeetingWebhookEndpoint[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_webhooks')
      .where('workspaceId', '==', workspaceId)
      .get();

    const endpoints: MeetingWebhookEndpoint[] = snap.docs.map(doc => ({
      ...(doc.data() as MeetingWebhookEndpoint),
      id: doc.id,
    }));

    endpoints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, endpoints };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Creates or updates a webhook endpoint subscription.
 */
export async function saveMeetingWebhookAction(payload: {
  id?: string;
  workspaceId: string;
  url: string;
  description?: string;
  subscribedEvents: MeetingWebhookEvent[];
  enabled?: boolean;
}): Promise<{ success: boolean; endpointId?: string; secretKey?: string; error?: string }> {
  try {
    const { id, workspaceId, url, description, subscribedEvents, enabled = true } = payload;
    const now = new Date().toISOString();

    if (!url.trim().startsWith('http://') && !url.trim().startsWith('https://')) {
      throw new Error('Valid HTTP or HTTPS URL is required.');
    }
    if (!subscribedEvents || subscribedEvents.length === 0) {
      throw new Error('At least one event must be subscribed.');
    }

    const isUpdate = Boolean(id);
    const docRef = isUpdate
      ? adminDb.collection('meeting_webhooks').doc(id!)
      : adminDb.collection('meeting_webhooks').doc();

    let secretKey = `whsec_${randomBytes(24).toString('hex')}`;

    if (isUpdate) {
      const existing = await docRef.get();
      if (existing.exists) {
        secretKey = existing.data()?.secretKey || secretKey;
      }
    }

    const endpointData: MeetingWebhookEndpoint = {
      id: docRef.id,
      workspaceId,
      url: url.trim(),
      description: description?.trim(),
      secretKey,
      subscribedEvents,
      enabled,
      consecutiveFailuresCount: 0,
      createdAt: isUpdate ? (await docRef.get()).data()?.createdAt || now : now,
      updatedAt: now,
    };

    await docRef.set(endpointData);

    return { success: true, endpointId: docRef.id, secretKey };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Deletes a webhook endpoint.
 */
export async function deleteMeetingWebhookAction(
  endpointId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('meeting_webhooks').doc(endpointId);
    const snap = await docRef.get();

    if (!snap.exists) throw new Error('Endpoint not found.');
    if (snap.data()?.workspaceId !== workspaceId) throw new Error('Unauthorized workspace.');

    await docRef.delete();
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Dispatches a simulated test payload to an endpoint and logs the result.
 */
export async function testDispatchWebhookAction(
  endpointId: string,
  workspaceId: string,
  eventType: MeetingWebhookEvent = 'booking.created'
): Promise<{ success: boolean; statusCode?: number; responseBody?: string; durationMs?: number; error?: string }> {
  const startTime = Date.now();
  try {
    const docRef = adminDb.collection('meeting_webhooks').doc(endpointId);
    const snap = await docRef.get();

    if (!snap.exists) throw new Error('Endpoint not found.');
    const endpoint = snap.data() as MeetingWebhookEndpoint;

    if (endpoint.workspaceId !== workspaceId) throw new Error('Unauthorized workspace.');

    const sampleData = {
      bookingId: `bk_test_${Date.now()}`,
      title: 'Sample Strategy Consultation',
      startAt: new Date(Date.now() + 86400000).toISOString(),
      endAt: new Date(Date.now() + 86400000 + 1800000).toISOString(),
      invitee: {
        name: 'Jane Doe',
        email: 'jane@example.com',
      },
      host: {
        name: 'SmartSapp Host',
      },
    };

    const payload = buildWebhookEventPayload(eventType, sampleData, workspaceId);
    const rawBody = JSON.stringify(payload);
    const { header } = signWebhookPayload(rawBody, endpoint.secretKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    let statusCode = 0;
    let responseText = '';
    let isSuccess = false;

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartSapp-Webhooks/2.0',
          'X-SmartSapp-Signature': header,
          'X-SmartSapp-Event': eventType,
        },
        body: rawBody,
        signal: controller.signal,
      });

      statusCode = res.status;
      responseText = await res.text();
      isSuccess = res.ok;
    } catch (fetchErr) {
      responseText = getErrorMessage(fetchErr);
    } finally {
      clearTimeout(timeoutId);
    }

    const durationMs = Date.now() - startTime;
    const now = new Date().toISOString();

    // Record delivery log
    const logRef = adminDb.collection('webhook_delivery_logs').doc();
    const logData: WebhookDeliveryLog = {
      id: logRef.id,
      endpointId,
      workspaceId,
      event: eventType,
      targetUrl: endpoint.url,
      statusCode,
      payload,
      responseBody: responseText.slice(0, 1000), // bounded slice
      deliveredAt: now,
      success: isSuccess,
      durationMs,
    };

    await logRef.set(logData);

    // Update endpoint health counters
    if (isSuccess) {
      await docRef.update({
        consecutiveFailuresCount: 0,
        lastDeliveredAt: now,
        updatedAt: now,
      });
    } else {
      await docRef.update({
        consecutiveFailuresCount: (endpoint.consecutiveFailuresCount || 0) + 1,
        lastFailureAt: now,
        lastFailureReason: `Status ${statusCode || 'Timeout'}: ${responseText.slice(0, 200)}`,
        updatedAt: now,
      });
    }

    return {
      success: isSuccess,
      statusCode,
      responseBody: responseText.slice(0, 500),
      durationMs,
      error: isSuccess ? undefined : `Delivery failed with status ${statusCode || 'Timeout'}.`,
    };
  } catch (err) {
    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: getErrorMessage(err),
    };
  }
}

/**
 * Fetches recent delivery logs for an endpoint.
 */
export async function getWebhookDeliveryLogsAction(
  endpointId: string,
  workspaceId: string
): Promise<{ success: boolean; logs?: WebhookDeliveryLog[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('webhook_delivery_logs')
      .where('endpointId', '==', endpointId)
      .where('workspaceId', '==', workspaceId)
      .limit(30)
      .get();

    const logs: WebhookDeliveryLog[] = snap.docs.map(doc => ({
      ...(doc.data() as WebhookDeliveryLog),
      id: doc.id,
    }));

    logs.sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());

    return { success: true, logs };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
