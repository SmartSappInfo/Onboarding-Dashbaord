import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { messageTrackingService } from '@/lib/services/message-tracking-service';
import { MessageProvider, MessageStatus, DeliveryState } from '@/lib/types/tracking';
import { WebhookVerificationError } from '@/lib/errors/tracking-errors';
import { adminDb } from '@/lib/firebase-admin';

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || '';

interface ResendPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    created_at: string;
    opened_at?: string;
    clicked_at?: string;
    bounce?: {
      type: 'permanent' | 'temporary';
      description: string;
    };
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const signature = request.headers.get('x-resend-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing header' }, { status: 401 });
    }

    const body = await request.text();
    const expected = crypto
      .createHmac('sha256', RESEND_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    // Timing safe validation
    if (signature !== expected) {
      throw new WebhookVerificationError('Invalid webhook signature');
    }

    const payload = JSON.parse(body) as ResendPayload;

    // Perform processing out-of-band using after()
    after(async () => {
      try {
        const tracking = await messageTrackingService.findByProviderMessageId(
          payload.data.email_id,
          MessageProvider.Resend
        );

        if (!tracking) {
          console.warn(`[WEBHOOK] No tracking record found for Resend message: ${payload.data.email_id}`);
          return;
        }

        const deliveryState = mapResendEventToState(payload);
        if (!deliveryState) return;

        // Atomic state upgrade
        await messageTrackingService.updateStateWithSequenceGuard(tracking.id, deliveryState);

        // If open or click event, cancel scheduled resends
        if (deliveryState.status === MessageStatus.Opened || deliveryState.status === MessageStatus.Clicked) {
          await cancelPendingResendJobs(tracking.runId, tracking.nodeId);
        }
      } catch (err) {
        console.error('[WEBHOOK_AFTER] Async webhook update failed:', err);
      }
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK_ENDPOINT] Failure:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }
}

function mapResendEventToState(payload: ResendPayload): DeliveryState | null {
  const time = payload.data.created_at;
  switch (payload.type) {
    case 'email.sent':
      return { status: MessageStatus.Sent, sentAt: time };
    case 'email.delivered':
      return { status: MessageStatus.Delivered, deliveredAt: time };
    case 'email.opened':
      return { status: MessageStatus.Opened, openedAt: payload.data.opened_at || time };
    case 'email.clicked':
      return { status: MessageStatus.Clicked, clickedAt: payload.data.clicked_at || time };
    case 'email.bounced':
      return {
        status: MessageStatus.Bounced,
        bounceInfo: {
          type: payload.data.bounce?.type || 'permanent',
          reason: payload.data.bounce?.description || 'Hard bounce',
          bouncedAt: time,
        },
      };
    default:
      return null;
  }
}

async function cancelPendingResendJobs(runId: string, nodeId: string): Promise<void> {
  const snap = await adminDb
    .collection('resend_jobs')
    .where('runId', '==', runId)
    .where('nodeId', '==', nodeId)
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) return;

  const batch = adminDb.batch();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'skipped',
      statusReason: 'Recipient engaged with message',
      updatedAt: new Date().toISOString(),
    });
  });
  await batch.commit();
  console.log(`[CANCEL_RESEND] Cancelled ${snap.size} pending resends for run ${runId}`);
}
