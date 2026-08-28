/**
 * @fileoverview Platform Control Plane Webhook Replay Execution Engine
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Replays failed webhooks recorded in `webhook_dead_letters`.
 * - Employs timeouts (10s) and bounds batch concurrency to 5.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Isolated execution engine reporting through `platform_jobs`.
 */

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logBackofficeAction } from './audit-logger';
import { getErrorMessage } from './backoffice-errors';
import type { AuditActor, WebhookDeadLetter } from './backoffice-types';

export async function processReplayWebhooks(
  jobId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  const jobRef = adminDb.collection('platform_jobs').doc(jobId);

  try {
    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
      logs: FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Starting automated Dead-Letter Queue replay sweep...',
      }),
    });

    const deadLettersSnap = await adminDb
      .collection('webhook_dead_letters')
      .where('status', '==', 'failed')
      .limit(50)
      .get();

    let replayedSuccess = 0;
    let replayedFailed = 0;

    for (const doc of deadLettersSnap.docs) {
      const dl = doc.data() as WebhookDeadLetter;
      let httpStatus = 500;
      let isSuccess = false;
      let errorResponse = '';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(dl.endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SmartSapp-Webhook-Replay-Job/2.0',
            'X-SmartSapp-Event': dl.eventType,
            'X-SmartSapp-Replay': 'true',
          },
          body: JSON.stringify(dl.payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        httpStatus = resp.status;
        isSuccess = resp.ok;
        if (!resp.ok) {
          errorResponse = await resp.text();
        }
      } catch (err: unknown) {
        errorResponse = err instanceof Error ? err.message : 'Network failure';
      }

      const timestamp = new Date().toISOString();
      await doc.ref.update({
        status: isSuccess ? 'resolved' : 'failed',
        httpStatus,
        errorMessage: isSuccess ? '' : errorResponse.slice(0, 500),
        attemptCount: (dl.attemptCount || 1) + 1,
        lastAttemptAt: timestamp,
      });

      if (isSuccess) replayedSuccess++;
      else replayedFailed++;

      // Small throttle between HTTP calls
      await new Promise((r) => setTimeout(r, 50));
    }

    await jobRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      logs: FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Webhook replay sweep finished. Succeeded: ${replayedSuccess}, Failed: ${replayedFailed} of ${deadLettersSnap.size} total items.`,
      }),
    });

    await logBackofficeAction(actor, 'job.execute', 'platform_job', jobId, {
      metadata: {
        jobType: 'replay_webhooks',
        replayedSuccess,
        replayedFailed,
        totalAttempted: deadLettersSnap.size,
      },
    });

    return { success: true };
  } catch (error: unknown) {
    const errorMsg = getErrorMessage(error);
    console.error('[REPLAY_WEBHOOKS_JOB] Failed:', errorMsg);

    await jobRef.update({
      status: 'failed',
      completedAt: new Date().toISOString(),
      logs: FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Job failed: ${errorMsg}`,
      }),
    });

    return { success: false, error: errorMsg };
  }
}
