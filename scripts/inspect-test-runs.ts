import { adminDb } from '../src/lib/firebase-admin';

async function inspectTestRuns() {
  const automationId = 'wLraN52eC3zBaYuGQfKH';
  console.log(`>>> [INSPECT] Querying runs for automation: ${automationId}...`);
  const snap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .get();

  console.log(`>>> Found ${snap.size} runs for automation ${automationId}`);
  if (snap.size > 0) {
    const data = snap.docs[0].data();
    console.log('Sample run:', JSON.stringify({ id: snap.docs[0].id, ...data }, null, 2));
  }
}

inspectTestRuns().catch(console.error);
