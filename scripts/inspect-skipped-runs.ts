import { adminDb } from '../src/lib/firebase-admin';

async function inspectSkipped() {
  const automationId = 'MCs1nHdHK7AgcffzX6w0';
  const emailNodeId = 'actionNode_1782992382318';

  console.log('>>> [INSPECT] Querying running runs...');
  const runsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .where('status', '==', 'running')
    .get();

  console.log(`>>> Total running runs found: ${runsSnap.size}`);

  let emailSuccessCount = 0;
  let emailAbsentCount = 0;
  const sampleSteps: any[] = [];

  runsSnap.docs.forEach((doc) => {
    const data = doc.data();
    const steps = data.steps || {};
    const emailStep = steps[emailNodeId];
    if (emailStep) {
      if (emailStep.status === 'success') {
        emailSuccessCount++;
        if (sampleSteps.length < 5) {
          sampleSteps.push({
            runId: doc.id,
            entityId: data.entityId,
            emailStep,
          });
        }
      }
    } else {
      emailAbsentCount++;
    }
  });

  console.log(`>>> Runs with Email Step = success: ${emailSuccessCount}`);
  console.log(`>>> Runs with Email Step missing: ${emailAbsentCount}`);
  console.log('>>> Sample successful email steps:', JSON.stringify(sampleSteps, null, 2));
}

inspectSkipped().catch(console.error);
