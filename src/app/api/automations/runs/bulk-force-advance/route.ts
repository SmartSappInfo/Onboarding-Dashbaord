import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forceAdvanceRun } from '@/lib/automations/run-management';
import { scheduleBulkForceAdvanceTask } from '@/lib/gcp-tasks-client';
import type { AutomationRun } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SECRET = process.env.CLOUD_TASKS_SECRET || 'local-secret';

interface BulkForceAdvanceRequestBody {
  automationId?: string;
  workspaceId?: string;
  userId?: string;
  runIds?: string[];
  advanceAllWaiting?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Security Check: Validate Secret Header Handshake
    const clientSecret = request.headers.get('x-cloud-tasks-secret');
    if (!clientSecret || clientSecret !== SECRET) {
      console.warn('[BULK-FORCE-ADVANCE-WORKER] Unauthorized request attempt.');
      return NextResponse.json({ error: 'Unauthorized handshake signature' }, { status: 401 });
    }

    // 2. Parse payload details
    const body = (await request.json()) as BulkForceAdvanceRequestBody;
    const { automationId, workspaceId, userId, runIds, advanceAllWaiting } = body;

    if (!automationId || !workspaceId || !userId) {
      return NextResponse.json({ error: 'Missing automationId, workspaceId, or userId' }, { status: 400 });
    }

    if (!advanceAllWaiting && (!runIds || runIds.length === 0)) {
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    console.info(`[BULK-FORCE-ADVANCE-WORKER] Started processing for automation ${automationId}. advanceAllWaiting: ${advanceAllWaiting}, specific runs: ${runIds?.length || 0}`);

    const CHUNK_SIZE = 50;
    const MAX_RETRIES = 2;
    const STAGGER_DELAY_MS = 200;

    let runsToProcess: string[] = [];
    let hasMoreToSweep = false;

    if (advanceAllWaiting) {
      // Sweep mode for all active/waiting/paused runs
      const snap = await adminDb.collection('automation_runs')
        .where('automationId', '==', automationId)
        .where('workspaceId', '==', workspaceId)
        .where('status', 'in', ['running', 'paused', 'waiting'])
        .orderBy('startedAt', 'desc')
        .limit(CHUNK_SIZE)
        .get();

      runsToProcess = snap.docs.map(d => d.id);
      hasMoreToSweep = snap.docs.length === CHUNK_SIZE;
    } else if (runIds) {
      // Specific list mode
      runsToProcess = runIds.slice(0, CHUNK_SIZE);
      if (runIds.length > CHUNK_SIZE) {
        hasMoreToSweep = true;
      }
    }

    if (runsToProcess.length === 0) {
      console.info(`[BULK-FORCE-ADVANCE-WORKER] No eligible runs found to force advance.`);
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    const failedAttempts: Array<{ runId: string; error: string }> = [];

    // 3. Process the chunk with internal stagger & retry resilience
    await Promise.all(
      runsToProcess.map(async (runId, index) => {
        if (index > 0) {
          await new Promise<void>(r => setTimeout(r, (index % 15) * STAGGER_DELAY_MS));
        }

        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const runSnap = await adminDb.collection('automation_runs').doc(runId).get();
            if (!runSnap.exists) break;

            const run = { id: runSnap.id, ...runSnap.data() } as AutomationRun;

            // Strict tenant isolation verification
            if (run.workspaceId !== workspaceId) {
              console.warn(`[BULK-FORCE-ADVANCE-WORKER] Tenant mismatch for run ${runId}`);
              break;
            }

            if (run.status !== 'running' && run.status !== 'paused' && (run.status as string) !== 'waiting') {
              // Run is already completed, cancelled, or finished
              break;
            }

            // Execute single run force advance (claims job, cancels remote Cloud Task, resumes flow)
            const result = await forceAdvanceRun(runId, userId);
            if (!result.success) {
              throw new Error(result.error || 'Failed to force advance run');
            }

            lastError = null;
            break; // Success!
          } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < MAX_RETRIES) {
              await new Promise<void>((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
            }
          }
        }

        if (lastError) {
          failedAttempts.push({ runId, error: lastError.message });
          console.error(
            `[BULK-FORCE-ADVANCE-WORKER] Failed after ${MAX_RETRIES + 1} attempts for run ${runId}:`,
            lastError
          );
        }
      })
    );

    const successCount = runsToProcess.length - failedAttempts.length;
    console.info(`[BULK-FORCE-ADVANCE-WORKER] Chunk processing complete. Processed: ${successCount}, Failed: ${failedAttempts.length}`);

    // 4. Enqueue the next worker chunk if needed
    if (hasMoreToSweep) {
      let nextRunIds: string[] | undefined = undefined;

      if (!advanceAllWaiting && runIds) {
        nextRunIds = runIds.slice(CHUNK_SIZE);
      }

      await scheduleBulkForceAdvanceTask({
        automationId,
        workspaceId,
        userId,
        advanceAllWaiting,
        runIds: nextRunIds,
      });
    }

    return NextResponse.json({
      success: true,
      processedCount: successCount,
      failedCount: failedAttempts.length,
      hasMoreRemaining: hasMoreToSweep,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[BULK-FORCE-ADVANCE-WORKER] Critical worker failure:', error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
