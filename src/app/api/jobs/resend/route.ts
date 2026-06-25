import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { messageTrackingService } from '@/lib/services/message-tracking-service';
import { ResendJob, ResendJobStatus, MessageStatus, ResendTrigger } from '@/lib/types/tracking';
import { sendMessage } from '@/lib/messaging-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = request.headers.get('Authorization');
    if (auth !== `Bearer ${process.env.INTERNAL_API_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = (await request.json()) as { jobId: string };
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const jobRef = adminDb.collection('resend_jobs').doc(jobId);
    
    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(jobRef);
      if (!snap.exists) throw new Error(`Job not found: ${jobId}`);

      const job = snap.data() as ResendJob;
      if (job.status !== ResendJobStatus.Pending) return;

      const original = await messageTrackingService.getTrackingRecord(job.originalMessageTrackingId);
      if (!original) {
        transaction.update(jobRef, {
          status: ResendJobStatus.Failed,
          statusReason: 'Original tracking record deleted',
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      // Evaluate condition: Skip if recipient already engaged
      const currentStatus = original.deliveryState.status;
      const hasOpened = currentStatus === MessageStatus.Opened || currentStatus === MessageStatus.Clicked;
      const hasClicked = currentStatus === MessageStatus.Clicked;

      if ((job.triggerCondition === ResendTrigger.NoOpen && hasOpened) ||
          (job.triggerCondition === ResendTrigger.NoClick && hasClicked)) {
        transaction.update(jobRef, {
          status: ResendJobStatus.Skipped,
          statusReason: `Recipient engaged (${currentStatus})`,
          checkedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      // Trigger Send Dispatch
      const sendResult = await sendMessage({
        templateId: original.nodeId, // Reuses node template structure
        senderProfileId: original.createdBy || 'default',
        recipient: job.recipientIdentifier,
        workspaceId: job.workspaceId,
        organizationId: original.organizationId,
        variables: {
          subject: job.title,
          previewText: job.previewText,
          body: job.messageContent,
        },
        entityId: original.id,
        trackLinks: true,
      });

      if (!sendResult.success) {
        throw new Error(`Dispatch failed: ${sendResult.error}`);
      }

      transaction.update(jobRef, {
        status: ResendJobStatus.Sent,
        sentAt: new Date().toISOString(),
        newMessageTrackingId: sendResult.logId || null,
        checkedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ processed: true });
  } catch (err) {
    console.error('[RESEND_JOB_TRIGGER] Processing error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed execution: ${message}` }, { status: 500 });
  }
}
