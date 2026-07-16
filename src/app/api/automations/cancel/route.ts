import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { terminateAutomationRunInternal } from '@/lib/automations/run-management';

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

    // 2. Perform unified execution termination
    await terminateAutomationRunInternal(runId, 'cancelled', true);

    return NextResponse.json({ success: true, message: 'Entity successfully removed from automation execution.' });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[CANCEL_AUTOMATION_ROUTE] Error:', error);
    return NextResponse.json({ error: errMsg || 'Failed to cancel automation' }, { status: 500 });
  }
}
