'use server';

import { adminDb } from './firebase-admin';
import type { Webhook, AutomationTrigger } from './types';
import { logActivity } from './activity-logger';
import crypto from 'crypto';

/**
 * High-performance generic webhook engine.
 * POSTs JSON payloads to configured endpoints with signing and robust logging.
 */
export async function dispatchWebhook(options: {
  webhookIdOrUrl: string;
  payload: any;
  workspaceId: string;
  organizationId: string;
  entityId?: string | null;
  trigger?: AutomationTrigger;
  source?: string;
  description?: string;
}) {
  const { 
    webhookIdOrUrl, 
    payload, 
    workspaceId, 
    organizationId, 
    entityId, 
    trigger,
    source = 'webhook_engine',
    description: customDescription
  } = options;
  
  try {
    let url = '';
    let webhookName = 'Generic Webhook';
    let secret = '';
    let webhookId = '';
    
    // Check if it's a URL or a document ID
    if (webhookIdOrUrl.startsWith('http')) {
      url = webhookIdOrUrl;
    } else {
      const webhookDoc = await adminDb.collection('webhooks').doc(webhookIdOrUrl).get();
      if (!webhookDoc.exists) {
        throw new Error(`Endpoint ${webhookIdOrUrl} not found`);
      }
      const webhook = { id: webhookDoc.id, ...webhookDoc.data() } as Webhook;
      
      if (webhook.status === 'paused') {
        console.log(`>>> [WEBHOOK] Skipping paused webhook: ${webhook.name}`);
        return { success: true, skipped: true };
      }

      url = webhook.url;
      webhookName = webhook.name || webhookName;
      secret = webhook.secret || '';
      webhookId = webhook.id;
    }

    const timestamp = new Date().toISOString();
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      'X-SmartSapp-Source': source,
      'X-SmartSapp-Timestamp': timestamp
    };

    if (trigger) {
      headers['X-SmartSapp-Trigger'] = trigger;
    }

    // Add signature if secret is present
    if (secret) {
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-SmartSapp-Signature'] = signature;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      await logActivity({
        workspaceId,
        organizationId,
        entityId: entityId || null,
        type: 'webhook_failed' as any,
        source: source as any,
        description: customDescription || `Webhook "${webhookName}" failed (Status: ${res.status})`,
        metadata: { url, status: res.status, webhookId, trigger }
      });

      if (webhookId) {
        await adminDb.collection('webhooks').doc(webhookId).update({
          status: 'failed',
          updatedAt: timestamp
        });
      }

      return { success: false, error: `Status ${res.status}` };
    }

    await logActivity({
      workspaceId,
      organizationId,
      entityId: entityId || null,
      type: 'webhook_sent' as any,
      source: source as any,
      description: customDescription || `Webhook "${webhookName}" dispatched successfully`,
      metadata: { url, webhookId, trigger }
    });

    if (webhookId) {
      await adminDb.collection('webhooks').doc(webhookId).update({
        status: 'active',
        lastTriggeredAt: timestamp,
        updatedAt: timestamp
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error(">>> [WEBHOOK] Dispatch Error:", error.message);
    
    await logActivity({
      workspaceId,
      organizationId,
      entityId: entityId || null,
      type: 'webhook_failed' as any,
      source: source as any,
      description: `Webhook dispatch error: ${error.message}`,
      metadata: { error: error.message, webhookIdOrUrl, trigger }
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Dispatches all active webhooks for a specific trigger.
 */
export async function dispatchWebhooksByTrigger(options: {
  trigger: AutomationTrigger;
  payload: any;
  workspaceId: string;
  organizationId: string;
  entityId?: string | null;
}) {
  const { trigger, payload, workspaceId, organizationId, entityId } = options;

  try {
    const webhooksSnap = await adminDb.collection('webhooks')
      .where('organizationId', '==', organizationId)
      .where('type', '==', 'outbound')
      .where('trigger', '==', trigger)
      .where('status', '==', 'active')
      .get();

    if (webhooksSnap.empty) return { success: true, count: 0 };

    const promises = webhooksSnap.docs.map(doc => 
      dispatchWebhook({
        webhookIdOrUrl: doc.id,
        payload,
        workspaceId,
        organizationId,
        entityId,
        trigger,
        source: 'trigger_engine',
        description: `Outbound Webhook "${doc.data().name}" triggered by ${trigger}`
      })
    );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;

    return { success: true, count: successCount, total: results.length };
  } catch (error: any) {
    console.error(">>> [WEBHOOK] Trigger Dispatch Error:", error.message);
    return { success: false, error: error.message };
  }
}
