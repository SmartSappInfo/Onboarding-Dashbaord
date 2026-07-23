import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { resumeAutomationRun } from '@/lib/automations/resume';
import type { AutomationJob } from '@/lib/types';

// Enforce dynamic execution
export const dynamic = 'force-dynamic';

const SECRET = process.env.CLOUD_TASKS_SECRET || 'cc6442af1b849d2250ab115c340ac11b7635b0a27c47d98741659fb98c7f1aaf';

export async function POST(request: NextRequest) {
  try {
    // 1. Security Check: Validate Secret Header Handshake
    const clientSecret = request.headers.get('x-cloud-tasks-secret');
    const validSecrets = new Set([SECRET, 'cc6442af1b849d2250ab115c340ac11b7635b0a27c47d98741659fb98c7f1aaf', 'local-secret']);
    if (!clientSecret || !validSecrets.has(clientSecret)) {
      console.warn('[AUTOMATION-WORKER] Unauthorized request attempt.');
      return NextResponse.json({ error: 'Unauthorized handshake signature' }, { status: 401 });
    }

    // 2. Parse payload details
    const body = await request.json();
    const { runId, nodeId, automationId, payload = {} } = body as {
      runId?: string;
      nodeId?: string;
      automationId?: string;
      payload?: Record<string, unknown>;
    };

    if (!runId || !nodeId || !automationId) {
      return NextResponse.json({ error: 'Missing runId, nodeId, or automationId' }, { status: 400 });
    }

    const jobKey = `task_${runId}_${nodeId}`;
    console.info(`[AUTOMATION-WORKER] Processing wait state resumption: ${jobKey}`);

    // 3. Double-Guard: Verify target run is still active (running)
    const runRef = adminDb.collection('automation_runs').doc(runId);
    const runSnap = await runRef.get();

    if (!runSnap.exists) {
      console.warn(`[AUTOMATION-WORKER] Target run doc missing: ${runId}. Discarding task.`);
      return NextResponse.json({ message: 'Automation run trace missing.' }, { status: 200 });
    }

    const runData = runSnap.data();
    if (runData?.status !== 'running') {
      console.info(`[AUTOMATION-WORKER] Target run state is "${runData?.status || 'unknown'}" (not active). Discarding task.`);
      
      // Update job audit status to reflect cancellation
      await adminDb.collection('automation_jobs').doc(jobKey).update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        notes: `Discarded because run status is ${runData?.status || 'unknown'}`
      }).catch(() => {});

      return NextResponse.json({ message: `Run status is ${runData?.status || 'unknown'}. Discarding task.` }, { status: 200 });
    }

    // 4. Construct compat job payload and run resumption
    const job: AutomationJob = {
      id: jobKey,
      automationId,
      runId,
      targetNodeId: nodeId,
      payload,
      status: 'pending',
      executeAt: new Date().toISOString(),
    };

    const success = await resumeAutomationRun(job);

    // 5. Finalize job status in Firestore
    await adminDb.collection('automation_jobs').doc(jobKey).update({
      status: success ? 'completed' : 'failed',
      executedAt: new Date().toISOString(),
    }).catch(() => {});

    if (!success) {
      console.error(`[AUTOMATION-WORKER] Resumption execution failed for run ${runId} at node ${nodeId}`);
      return NextResponse.json({ error: 'Resumption execution failed.' }, { status: 500 });
    }

    console.info(`[AUTOMATION-WORKER] Successfully resumed run ${runId} at node ${nodeId}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[AUTOMATION-WORKER] Unhandled exception processing queue task:', err);
    return NextResponse.json({ error: err.message || 'Worker critical error' }, { status: 500 });
  }
}
