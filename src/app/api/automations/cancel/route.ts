import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { cancelDelayTask, parseQueueChannel } from '@/lib/gcp-tasks-client';

export async function POST(req: Request) {
  try {
    const { runId, entityId } = await req.json();

    if (!runId || !entityId) {
      return NextResponse.json({ error: 'Missing required parameters (runId, entityId)' }, { status: 400 });
    }

    // 1. Ownership & Exist Check
    const runRef = adminDb.collection('automation_runs').doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) {
      return NextResponse.json({ error: 'Automation run not found.' }, { status: 404 });
    }

    const runData = runSnap.data();
    if (runData?.entityId !== entityId) {
      return NextResponse.json({ error: 'Unauthorized: Entity ID mismatch for target run.' }, { status: 403 });
    }

    // 2. Fetch and cancel pending jobs
    const jobsSnap = await adminDb.collection('automation_jobs')
      .where('runId', '==', runId)
      .where('entityId', '==', entityId)
      .where('status', '==', 'pending')
      .get();

    const batch = adminDb.batch();

    for (const doc of jobsSnap.docs) {
      const jobData = doc.data();
      if (jobData.targetNodeId) {
        // Execute cancellation in the background, logging any non-fatal errors
        cancelDelayTask(runId, jobData.targetNodeId, parseQueueChannel(jobData.payload?.channel))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[CANCEL_AUTOMATION_ROUTE] Non-fatal task deletion failure for run ${runId}:`, msg);
          });
      }
      batch.delete(doc.ref);
    }

    // 3. Mark run as cancelled
    batch.update(runRef, {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
    });

    await batch.commit();

    return NextResponse.json({ success: true, message: 'Entity successfully removed from automation execution.' });
  } catch (error: any) {
    console.error('[CANCEL_AUTOMATION_ROUTE] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to cancel automation' }, { status: 500 });
  }
}
