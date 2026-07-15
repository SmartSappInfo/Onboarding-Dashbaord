import { adminDb } from '../src/lib/firebase-admin';
import { retryFailedStep } from '../src/lib/automations/run-management';

// Utility helper to sleep/delay execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryFailedRuns() {
  const automationId = 'MCs1nHdHK7AgcffzX6w0';
  console.log('>>> [RETRY] Starting retry of failed automation runs...');

  // 1. Fetch all runs for the automation that are failed
  const failedRunsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .where('status', '==', 'failed')
    .get();

  console.log(`>>> [RETRY] Found ${failedRunsSnap.size} failed runs.`);

  if (failedRunsSnap.empty) {
    console.log('>>> [RETRY] No failed runs found.');
    return;
  }

  // 2. Retry failed runs in small batches with delays to avoid hitting 10 req/sec rate limit
  const batchSize = 5;
  const runs = failedRunsSnap.docs;
  let retriedCount = 0;

  for (let i = 0; i < runs.length; i += batchSize) {
    const chunk = runs.slice(i, i + batchSize);
    console.log(`>>> [RETRY] Retrying batch ${i / batchSize + 1} of ${Math.ceil(runs.length / batchSize)}...`);

    await Promise.all(
      chunk.map(async (doc) => {
        const data = doc.data();
        const runId = doc.id;
        const failedNodeId = data.currentNodeId || 'actionNode_1782992382318';

        try {
          const res = await retryFailedStep(runId, failedNodeId, 'system-backfill');
          if (!res.success) {
            console.error(`>>> [RETRY] Failed to retry run ${runId}:`, res.error);
          }
        } catch (err) {
          console.error(`>>> [RETRY] Unexpected error retrying run ${runId}:`, err);
        }
      })
    );

    retriedCount += chunk.length;
    console.log(`>>> [RETRY] Progress: ${retriedCount}/${runs.length} runs retried.`);

    // Sleep for 700ms between batches to stay safely below 10/sec rate limit
    await sleep(700);
  }

  console.log('>>> [RETRY] All failed runs retried successfully!');
}

retryFailedRuns().catch(console.error);
