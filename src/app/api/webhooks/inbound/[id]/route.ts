import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { triggerAutomationProtocols } from '@/lib/automation-processor';
import { logActivity } from '@/lib/activity-logger';
import crypto from 'crypto';

/**
 * Inbound Webhook Endpoint
 * 
 * Receives POST payloads from external systems and triggers
 * internal automation protocols (WEBHOOK_RECEIVED).
 * 
 * Security: Validates HMAC-SHA256 signature via X-SmartSapp-Signature header.
 * Next.js 15: Uses async params pattern.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Look up the webhook configuration
    const webhookDoc = await adminDb.collection('webhooks').doc(id).get();

    if (!webhookDoc.exists) {
      return NextResponse.json(
        { error: 'Webhook endpoint not found' },
        { status: 404 }
      );
    }

    const webhook = webhookDoc.data()!;

    // 2. Check if webhook is active
    if (webhook.status === 'paused') {
      return NextResponse.json(
        { error: 'Webhook is currently paused' },
        { status: 403 }
      );
    }

    // 3. Ensure it's an inbound webhook
    if (webhook.type !== 'inbound') {
      return NextResponse.json(
        { error: 'This endpoint only accepts inbound webhooks' },
        { status: 400 }
      );
    }

    // 4. Parse the request body
    const rawBody = await request.text();
    let payload: Record<string, any>;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // 5. Verify signature if a secret is configured
    if (webhook.secret) {
      const signature = request.headers.get('X-SmartSapp-Signature') ||
                        request.headers.get('x-smartsapp-signature');

      if (!signature) {
        return NextResponse.json(
          { error: 'Missing signature header' },
          { status: 401 }
        );
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhook.secret)
        .update(rawBody)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        await logActivity({
          workspaceId: webhook.workspaceId || '',
          organizationId: webhook.organizationId || 'default',
          entityId: null,
          type: 'webhook_failed' as any,
          source: 'inbound_api',
          description: `Inbound webhook "${webhook.name}" — signature verification failed`,
          metadata: { webhookId: id }
        });

        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // 6. Update last triggered timestamp
    const now = new Date().toISOString();
    await adminDb.collection('webhooks').doc(id).update({
      lastTriggeredAt: now,
      status: 'active',
      updatedAt: now,
    });

    // 7. Log the inbound event
    await logActivity({
      workspaceId: webhook.workspaceId || '',
      organizationId: webhook.organizationId || 'default',
      entityId: null,
      type: 'webhook_received' as any,
      source: 'inbound_api',
      description: `Inbound webhook "${webhook.name}" received payload`,
      metadata: { webhookId: id, payloadKeys: Object.keys(payload) }
    });

    // 8. Trigger automation protocols with the WEBHOOK_RECEIVED event
    await triggerAutomationProtocols('WEBHOOK_RECEIVED' as any, {
      workspaceId: webhook.workspaceId,
      organizationId: webhook.organizationId,
      webhookId: id,
      webhookName: webhook.name,
      ...payload,
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook received and processed',
      webhookId: id,
    });

  } catch (error: any) {
    console.error('>>> [INBOUND WEBHOOK] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Health check for the inbound endpoint
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const webhookDoc = await adminDb.collection('webhooks').doc(id).get();

  if (!webhookDoc.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: 'ok',
    type: webhookDoc.data()?.type,
    name: webhookDoc.data()?.name,
  });
}
