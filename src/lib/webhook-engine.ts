'use server';

import { adminDb } from './firebase-admin';
import type { Webhook } from './types';

/**
 * High-performance generic webhook engine.
 * POSTs JSON payloads to configured endpoints with basic error logging.
 */
export async function dispatchWebhook(options: {
  webhookIdOrUrl: string;
  payload: any;
  workspaceId: string;
  organizationId: string;
  entityId?: string | null;
  formTitle?: string;
}) {
  const { webhookIdOrUrl, payload, workspaceId, organizationId, entityId, formTitle } = options;
  
  try {
    let url = '';
    let webhookName = 'Generic Webhook';
    
    // Check if it's a URL or a document ID
    if (webhookIdOrUrl.startsWith('http')) {
      url = webhookIdOrUrl;
    } else {
      const webhookDoc = await adminDb.collection('webhooks').doc(webhookIdOrUrl).get();
      if (!webhookDoc.exists) {
        throw new Error(`Endpoint ${webhookIdOrUrl} not found`);
      }
      const webhook = webhookDoc.data() as Webhook;
      url = webhook.url;
      webhookName = webhook.name || webhookName;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-SmartSapp-Source': 'Form-Engine',
        'X-SmartSapp-Timestamp': new Date().toISOString()
      },
      body: JSON.stringify(payload)
    });

    const { logActivity } = await import('./activity-logger');

    if (!res.ok) {
      await logActivity({
        workspaceId,
        organizationId,
        entityId: entityId || null,
        type: 'webhook_failed' as any,
        source: 'form_engine',
        description: `Webhook "${webhookName}" failed for form "${formTitle}" (Status: ${res.status})`,
        metadata: { url, status: res.status, webhookId: webhookIdOrUrl }
      });
      return { success: false, error: `Status ${res.status}` };
    }

    await logActivity({
      workspaceId,
      organizationId,
      entityId: entityId || null,
      type: 'webhook_sent' as any,
      source: 'form_engine',
      description: `Webhook "${webhookName}" dispatched successfully for form "${formTitle}"`,
      metadata: { url, webhookId: webhookIdOrUrl }
    });

    return { success: true };
  } catch (error: any) {
    console.error(">>> [WEBHOOK] Dispatch Error:", error.message);
    const { logActivity } = await import('./activity-logger');
    await logActivity({
      workspaceId,
      organizationId,
      entityId: entityId || null,
      type: 'webhook_failed' as any,
      source: 'form_engine',
      description: `Webhook dispatch error for form "${formTitle}": ${error.message}`,
      metadata: { error: error.message, webhookId: webhookIdOrUrl }
    });
    return { success: false, error: error.message };
  }
}
