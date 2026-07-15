import { adminDb } from '../src/lib/firebase-admin';

async function findUnsent() {
  const automationId = 'MCs1nHdHK7AgcffzX6w0';
  const emailNodeId = 'actionNode_1782992382318';

  console.log('>>> [FIND] Fetching all running runs...');
  const runsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .where('status', '==', 'running')
    .get();

  console.log(`>>> Found ${runsSnap.size} running runs.`);

  // To check if message logs exist, let's fetch all message logs for this automation
  console.log('>>> [FIND] Fetching message logs for the automation...');
  const logsSnap = await adminDb.collection('message_logs')
    .where('automationId', '==', automationId)
    .get();

  const loggedRunIds = new Set<string>();
  logsSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.runId) {
      loggedRunIds.add(data.runId);
    }
  });
  console.log(`>>> Found ${loggedRunIds.size} unique runIds in message_logs.`);

  const unsentRuns: any[] = [];
  runsSnap.docs.forEach((doc) => {
    const runId = doc.id;
    if (!loggedRunIds.has(runId)) {
      unsentRuns.push({
        runId,
        entityId: doc.data().entityId,
        steps: doc.data().steps || {},
      });
    }
  });

  console.log(`>>> Total runs in "running" state that do NOT have a message log: ${unsentRuns.length}`);
  if (unsentRuns.length > 0) {
    console.log('>>> Sample unsent runs:', JSON.stringify(unsentRuns.slice(0, 5), null, 2));
  }
}

findUnsent().catch(console.error);
