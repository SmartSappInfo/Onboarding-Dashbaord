import { adminDb } from '../src/lib/firebase-admin';

async function inspectAbsent() {
  const automationId = 'MCs1nHdHK7AgcffzX6w0';
  const emailNodeId = 'actionNode_1782992382318';

  console.log('>>> [INSPECT] Querying absent runs...');
  const runsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .where('status', '==', 'running')
    .get();

  const absentRuns: any[] = [];
  runsSnap.docs.forEach((doc) => {
    const data = doc.data();
    const steps = data.steps || {};
    if (!steps[emailNodeId]) {
      absentRuns.push({
        id: doc.id,
        entityId: data.entityId,
        currentNodeId: data.currentNodeId,
        currentNodeLabel: data.currentNodeLabel,
        steps,
      });
    }
  });

  console.log(`>>> Total absent runs: ${absentRuns.length}`);
  if (absentRuns.length > 0) {
    console.log('>>> Sample absent runs:', JSON.stringify(absentRuns.slice(0, 3), null, 2));
  }
}

inspectAbsent().catch(console.error);
