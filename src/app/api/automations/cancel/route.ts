import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { runId, entityId } = await req.json();

    if (!runId || !entityId) {
      return NextResponse.json({ error: 'Missing required parameters (runId, entityId)' }, { status: 400 });
    }

    const jobsSnap = await adminDb.collection('automation_jobs')
      .where('runId', '==', runId)
      .where('entityId', '==', entityId)
      .where('status', '==', 'pending')
      .get();

    const batch = adminDb.batch();

    jobsSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    const runRef = adminDb.collection('automation_runs').doc(runId);
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
