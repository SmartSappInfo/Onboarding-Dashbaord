import { adminDb } from '../src/lib/firebase-admin';

async function inspectEmailStatuses() {
  const automationId = 'MCs1nHdHK7AgcffzX6w0';
  const emailNodeId = 'actionNode_1782992382318';

  console.log('>>> [INSPECT] Querying running runs...');
  const runsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .where('status', '==', 'running')
    .get();

  const stepStatusCounts: Record<string, number> = {};
  const samples: Record<string, any[]> = {};

  runsSnap.docs.forEach((doc) => {
    const data = doc.data();
    const steps = data.steps || {};
    const emailStep = steps[emailNodeId];
    const status = emailStep ? emailStep.status : 'absent';

    stepStatusCounts[status] = (stepStatusCounts[status] || 0) + 1;
    if (!samples[status]) {
      samples[status] = [];
    }
    if (samples[status].length < 2) {
      samples[status].push({
        runId: doc.id,
        entityId: data.entityId,
        emailStep,
      });
    }
  });

  console.log('Email step status counts among running runs:', stepStatusCounts);
  console.log('Sample steps by status:', JSON.stringify(samples, null, 2));
}

inspectEmailStatuses().catch(console.error);
