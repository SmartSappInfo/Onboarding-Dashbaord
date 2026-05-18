// Generated with: resend-webhooks skill
// https://github.com/hookdeck/webhook-skills

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Webhook } from 'svix';

/**
 * POST /api/messaging/webhooks/resend
 *
 * Receives Resend email lifecycle events and maps them back to MessageTask
 * documents in Firestore. Uses Svix for signature verification (Resend uses
 * Svix under the hood).
 *
 * 1. Verify Svix signature using the Webhook class
 * 2. Route event type to the appropriate handler
 * 3. Update MessageTask.externalStatus idempotently
 * 4. Return 200 immediately (respond quickly pattern)
 *
 * Supported events:
 * - email.sent       → externalStatus = 'sent'
 * - email.delivered   → externalStatus = 'delivered'
 * - email.bounced     → externalStatus = 'bounced'
 * - email.complained  → externalStatus = 'complained'
 * - email.opened      → externalStatus = 'opened' + openedAt timestamp
 * - email.clicked     → externalStatus = 'clicked' + clickedAt timestamp
 */

/** Map of Resend event types to the externalStatus value stored on the task */
const EVENT_STATUS_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
};

export async function POST(req: Request) {
  try {
    // CRITICAL: Use raw text for signature verification (per resend-webhooks skill)
    const payload = await req.text();

    // Verify Svix signature
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[RESEND-WEBHOOK] RESEND_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const wh = new Webhook(webhookSecret);
    const event = wh.verify(payload, {
      'svix-id': req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    }) as { type: string; data: Record<string, any> };

    const emailId = event.data?.email_id;
    const externalStatus = EVENT_STATUS_MAP[event.type];

    // If we don't recognize the event type or there's no email_id, ack and exit
    if (!externalStatus || !emailId) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Find the matching MessageTask by providerId (collectionGroup query)
    const tasksSnap = await adminDb
      .collectionGroup('tasks')
      .where('providerId', '==', emailId)
      .limit(1)
      .get();

    if (tasksSnap.empty) {
      // No matching task — still return 200 (webhook best practice)
      console.warn(`[RESEND-WEBHOOK] No task found for email_id: ${emailId}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const taskDoc = tasksSnap.docs[0];
    const taskData = taskDoc.data();

    // Idempotency: Don't update if the externalStatus is already set to this value
    if (taskData.externalStatus === externalStatus) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Build the update payload
    const updatePayload: Record<string, any> = {
      externalStatus,
    };

    // Add timestamp fields for engagement events
    if (event.type === 'email.delivered') {
      updatePayload.deliveredAt = new Date().toISOString();
    } else if (event.type === 'email.opened') {
      updatePayload.openedAt = new Date().toISOString();
    } else if (event.type === 'email.clicked') {
      updatePayload.clickedAt = new Date().toISOString();
    } else if (event.type === 'email.bounced') {
      updatePayload.error = event.data?.bounce_type || 'bounced';
    }

    await taskDoc.ref.update(updatePayload);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[RESEND-WEBHOOK] Verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }
}
