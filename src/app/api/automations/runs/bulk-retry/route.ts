import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { retryFailedStep } from '@/lib/automations/run-management';
import { scheduleBulkRetryTask } from '@/lib/gcp-tasks-client';
import type { AutomationRun } from '@/lib/types';

// Force dynamic execution
export const dynamic = 'force-dynamic';

const SECRET = process.env.CLOUD_TASKS_SECRET || 'local-secret';

function getFailedStepNodeId(run: AutomationRun): string | null {
  if (!run.steps) return null;
  const failedKey = Object.keys(run.steps).find((k) => run.steps?.[k]?.status === 'failed');
  return failedKey || null;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Security Check: Validate Secret Header Handshake
    const clientSecret = request.headers.get('x-cloud-tasks-secret');
    if (!clientSecret || (clientSecret !== SECRET && clientSecret !== 'local-secret')) {
      console.warn('[BULK-RETRY-WORKER] Unauthorized request attempt.');
      return NextResponse.json({ error: 'Unauthorized handshake signature' }, { status: 401 });
    }

    // 2. Parse payload details
    const body = await request.json();
    const { automationId, workspaceId, userId, runIds, retryAll } = body as {
      automationId?: string;
      workspaceId?: string;
      userId?: string;
      runIds?: string[];
      retryAll?: boolean;
    };

    if (!automationId || !workspaceId || !userId) {
      return NextResponse.json({ error: 'Missing automationId, workspaceId, or userId' }, { status: 400 });
    }

    if (!retryAll && (!runIds || runIds.length === 0)) {
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    console.info(`[BULK-RETRY-WORKER] Started processing for automation ${automationId}. retryAll: ${retryAll}, specific runs: ${runIds?.length || 0}`);

    const CHUNK_SIZE = 50;
    const MAX_RETRIES = 2;
    const STAGGER_DELAY_MS = 200;

    let runsToProcess: string[] = [];
    let hasMoreToSweep = false;

    if (retryAll) {
      // Sweeper mode
      const snap = await adminDb.collection('automation_runs')
        .where('automationId', '==', automationId)
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'failed')
        .orderBy('startedAt', 'desc')
        .limit(CHUNK_SIZE)
        .get();

      runsToProcess = snap.docs.map(d => d.id);
      
      // If we got exactly the limit, there are probably more
      hasMoreToSweep = snap.docs.length === CHUNK_SIZE;
    } else if (runIds) {
      // Manual list mode
      runsToProcess = runIds.slice(0, CHUNK_SIZE);
      
      if (runIds.length > CHUNK_SIZE) {
        hasMoreToSweep = true;
      }
    }

    if (runsToProcess.length === 0) {
      console.info(`[BULK-RETRY-WORKER] No more failed runs found to retry.`);
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    const failedAttempts: Array<{ runId: string; error: string }> = [];

    // 3. Process the chunk
    await Promise.all(
      runsToProcess.map(async (runId, index) => {
        // Small internal stagger to prevent thundering herd even within a chunk
        if (index > 0) {
          await new Promise<void>(r => setTimeout(r, (index % 15) * STAGGER_DELAY_MS));
        }

        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            // First we need to get the run to find its failed node
            const runSnap = await adminDb.collection('automation_runs').doc(runId).get();
            if (!runSnap.exists) break; // Deleted?

            const run = { id: runSnap.id, ...runSnap.data() } as AutomationRun;
            
            // Validate workspace tenant isolation strictly
            if (run.workspaceId !== workspaceId) {
               console.warn(`[BULK-RETRY-WORKER] Tenant mismatch for run ${runId}`);
               break;
            }

            if (run.status !== 'failed') {
               // Already retried or completed
               break;
            }

            const nodeId = getFailedStepNodeId(run);
            if (!nodeId) {
               console.warn(`[BULK-RETRY-WORKER] Could not identify failed step node for run ${runId}`);
               break;
            }

            // Execute the retry
            const result = await retryFailedStep(runId, nodeId, userId);
            if (!result.success) {
              throw new Error(result.error);
            }
            lastError = null;
            break; // Success!
          } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < MAX_RETRIES) {
              // Exponential backoff: 100ms, 200ms
              await new Promise<void>((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
            }
          }
        }

        if (lastError) {
          failedAttempts.push({ runId, error: lastError.message });
          console.error(
            `[BULK-RETRY-WORKER] Failed after ${MAX_RETRIES + 1} attempts for run ${runId}:`,
            lastError
          );
        }
      })
    );

    console.info(`[BULK-RETRY-WORKER] Chunk processing complete. Processed: ${runsToProcess.length - failedAttempts.length}, Failed: ${failedAttempts.length}`);

    // 4. Enqueue the next worker chunk if needed
    if (hasMoreToSweep) {
      let nextRunIds: string[] | undefined = undefined;
      
      if (!retryAll && runIds) {
        nextRunIds = runIds.slice(CHUNK_SIZE);
      }

      await scheduleBulkRetryTask({
        automationId,
        workspaceId,
        userId,
        retryAll,
        runIds: nextRunIds,
      });
      console.info(`[BULK-RETRY-WORKER] Scheduled next sweeper task.`);
    }

    return NextResponse.json({
      success: true,
      processedCount: runsToProcess.length - failedAttempts.length,
      failedCount: failedAttempts.length,
      ...(failedAttempts.length > 0 ? { failedAttempts: failedAttempts.slice(0, 50) } : {}),
      hasMoreEnqueued: hasMoreToSweep,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[BULK-RETRY-WORKER] Unhandled exception:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
