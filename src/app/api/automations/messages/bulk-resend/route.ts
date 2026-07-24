import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { scheduleBulkResendMessagesTask } from '@/lib/gcp-tasks-client';
import { resendFailedMessage } from '@/lib/automations/run-management';

// Force dynamic execution
export const dynamic = 'force-dynamic';

const SECRET = process.env.CLOUD_TASKS_SECRET || 'cc6442af1b849d2250ab115c340ac11b7635b0a27c47d98741659fb98c7f1aaf';

export async function POST(request: NextRequest) {
  try {
    // 1. Security Check: Validate Secret Header Handshake or GCP Cloud Tasks Proxy Header
    const clientSecret = request.headers.get('x-cloud-tasks-secret');
    const gcpQueueHeader = request.headers.get('x-cloudtasks-queuename') || request.headers.get('x-appengine-queuename');
    const validSecrets = new Set([SECRET, 'cc6442af1b849d2250ab115c340ac11b7635b0a27c47d98741659fb98c7f1aaf', 'local-secret']);

    const isAuthorized = (clientSecret && validSecrets.has(clientSecret)) || Boolean(gcpQueueHeader);

    if (!isAuthorized) {
      console.warn('[BULK-RESEND-MESSAGES-WORKER] Unauthorized request attempt.');
      return NextResponse.json({ error: 'Unauthorized handshake signature' }, { status: 401 });
    }

    // 2. Parse payload details
    const body = await request.json();
    const { automationId, workspaceId, userId, logIds, resendAll } = body as {
      automationId?: string;
      workspaceId?: string;
      userId?: string;
      logIds?: string[];
      resendAll?: boolean;
    };

    if (!automationId || !workspaceId || !userId) {
      return NextResponse.json({ error: 'Missing automationId, workspaceId, or userId' }, { status: 400 });
    }

    if (!resendAll && (!logIds || logIds.length === 0)) {
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    console.info(`[BULK-RESEND-WORKER] Started processing for automation ${automationId}. resendAll: ${resendAll}, specific logs: ${logIds?.length || 0}`);

    const CHUNK_SIZE = 50;
    const MAX_RETRIES = 2;
    // We already have internal rate limiting inside resendRequest, so we don't need heavy staggering here,
    // but a small delay ensures we don't spam the DB.
    const STAGGER_DELAY_MS = 200;

    let logsToProcess: string[] = [];
    let hasMoreToSweep = false;

    if (resendAll) {
      // Sweeper mode
      const snap = await adminDb.collection('message_logs')
        .where('automationId', '==', automationId)
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'failed')
        .orderBy('createdAt', 'desc')
        .limit(CHUNK_SIZE + 1)
        .get();

      if (snap.size > CHUNK_SIZE) {
        hasMoreToSweep = true;
      }
      logsToProcess = snap.docs.slice(0, CHUNK_SIZE).map((d) => d.id);
    } else if (logIds) {
      if (logIds.length > CHUNK_SIZE) {
        hasMoreToSweep = true;
        logsToProcess = logIds.slice(0, CHUNK_SIZE);
      } else {
        logsToProcess = logIds;
      }
    }

    if (logsToProcess.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    // 3. Process the current chunk in parallel (with limit)
    const failedAttempts: { logId: string; error: string }[] = [];
    
    // We can use Promise.all but we should probably stagger them slightly.
    await Promise.all(
      logsToProcess.map(async (logId, idx) => {
        // Stagger startup
        if (STAGGER_DELAY_MS > 0) {
          await new Promise<void>((r) => setTimeout(r, (idx % 10) * STAGGER_DELAY_MS));
        }

        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            // Verify ownership explicitly for this message log
            const logSnap = await adminDb.collection('message_logs').doc(logId).get();
            if (!logSnap.exists) break;
            const logData = logSnap.data();

            if (logData?.workspaceId !== workspaceId) {
               console.warn(`[BULK-RESEND-WORKER] Tenant mismatch for log ${logId}`);
               break;
            }

            if (logData?.status !== 'failed') {
               // Already resent or completed
               break;
            }

            // Execute the retry
            const result = await resendFailedMessage(logId, userId);
            if (!result.success) {
              throw new Error(result.error);
            }
            lastError = null;
            break; // Success!
          } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < MAX_RETRIES) {
              // Exponential backoff
              await new Promise<void>((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
            }
          }
        }

        if (lastError) {
          failedAttempts.push({ logId, error: lastError.message });
          console.error(
            `[BULK-RESEND-WORKER] Failed after ${MAX_RETRIES + 1} attempts for log ${logId}:`,
            lastError
          );
        }
      })
    );

    console.info(`[BULK-RESEND-WORKER] Chunk processing complete. Processed: ${logsToProcess.length - failedAttempts.length}, Failed: ${failedAttempts.length}`);

    // 4. Enqueue the next worker chunk if needed
    if (hasMoreToSweep) {
      let nextLogIds: string[] | undefined = undefined;
      
      if (!resendAll && logIds) {
        nextLogIds = logIds.slice(CHUNK_SIZE);
      }

      await scheduleBulkResendMessagesTask({
        automationId,
        workspaceId,
        userId,
        resendAll,
        logIds: nextLogIds,
      });
    }

    return NextResponse.json({
      success: true,
      processedCount: logsToProcess.length - failedAttempts.length,
      failedCount: failedAttempts.length,
      hasMore: hasMoreToSweep,
    });
  } catch (error: any) {
    console.error('[BULK-RESEND-WORKER] Fatal error processing webhook:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
