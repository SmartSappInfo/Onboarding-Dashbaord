import { adminDb, FieldValue } from '../src/lib/firebase-admin';
import { retryFailedStep } from '../src/lib/automations/run-management';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function resolveAborted() {
  const automationId = 'MCs1nHdHK7AgcffzX6w0';
  const emailNodeId = 'actionNode_1782992382318';
  const delayNodeId = 'delayNode_1782992429285';

  console.log('>>> [RESOLVE] Fetching all running runs...');
  const runsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .where('status', '==', 'running')
    .get();

  console.log(`>>> [RESOLVE] Found ${runsSnap.size} running runs.`);

  console.log('>>> [RESOLVE] Fetching message logs for the email node...');
  const logsSnap = await adminDb.collection('message_logs')
    .where('automationId', '==', automationId)
    .where('nodeId', '==', emailNodeId)
    .get();

  const loggedRunIds = new Set<string>();
  logsSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.runId) {
      loggedRunIds.add(data.runId);
    }
  });
  console.log(`>>> [RESOLVE] Found ${loggedRunIds.size} unique runIds with successfully sent email logs.`);

  const unsentRunIds: string[] = [];
  runsSnap.docs.forEach((doc) => {
    // Skip runs that are still at the trigger or not yet at the email step (meaning steps[emailNodeId] is absent)
    const data = doc.data();
    const steps = data.steps || {};
    if (!steps[emailNodeId]) {
      return;
    }

    if (!loggedRunIds.has(doc.id)) {
      unsentRunIds.push(doc.id);
    }
  });

  console.log(`>>> [RESOLVE] Identified ${unsentRunIds.length} runs in "running" state that are missing email logs.`);

  if (unsentRunIds.length === 0) {
    console.log('>>> [RESOLVE] No unsent runs found. All running runs have email logs.');
    return;
  }

  // 1. Reset run status to failed and remove delay node step to force clean re-traverse
  console.log('>>> [RESOLVE] Resetting run status and removing delay step in batches...');
  const batchSize = 100;
  for (let i = 0; i < unsentRunIds.length; i += batchSize) {
    const chunk = unsentRunIds.slice(i, i + batchSize);
    const dbBatch = adminDb.batch();
    chunk.forEach((id) => {
      const ref = adminDb.collection('automation_runs').doc(id);
      dbBatch.update(ref, {
        status: 'failed',
        error: 'Resetting for backfill of unsent message.',
        currentNodeId: emailNodeId,
        currentNodeLabel: 'Send Email (Step #1)',
        [`steps.${delayNodeId}`]: FieldValue.delete(),
        [`steps.${emailNodeId}.status`]: 'failed',
        [`steps.${emailNodeId}.error`]: 'Resetting for backfill.',
      });
    });
    await dbBatch.commit();
    console.log(`>>> Reset progress: ${Math.min(i + batchSize, unsentRunIds.length)}/${unsentRunIds.length}`);
  }

  // 2. Retry the failed email node step for each run, throttled to 5 requests per second
  console.log('>>> [RESOLVE] Executing step retries with rate throttling (5/sec)...');
  const retryBatchSize = 5;
  let retriedCount = 0;

  for (let i = 0; i < unsentRunIds.length; i += retryBatchSize) {
    const chunk = unsentRunIds.slice(i, i + retryBatchSize);
    console.log(`>>> [RESOLVE] Processing batch ${i / retryBatchSize + 1} of ${Math.ceil(unsentRunIds.length / retryBatchSize)}...`);

    await Promise.all(
      chunk.map(async (runId) => {
        try {
          const res = await retryFailedStep(runId, emailNodeId, 'system-backfill');
          if (!res.success) {
            console.error(`>>> [RESOLVE] Failed to retry run ${runId}:`, res.error);
          }
        } catch (err) {
          console.error(`>>> [RESOLVE] Unexpected error retrying run ${runId}:`, err);
        }
      })
    );

    retriedCount += chunk.length;
    console.log(`>>> [RESOLVE] Progress: ${retriedCount}/${unsentRunIds.length} runs retried.`);

    // Sleep for 700ms to stay safely below the 10/sec rate limit
    await sleep(700);
  }

  console.log('>>> [RESOLVE] Aborted runs resolve and retry process finished successfully!');
}

resolveAborted().catch(console.error);
