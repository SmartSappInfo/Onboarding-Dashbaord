import { adminDb } from '../firebase-admin';
import { cancelDelayTask, rescheduleDelayTask, parseQueueChannel } from '../gcp-tasks-client';
import { calculateExecuteAt } from './nodes/delay';

/**
 * Converts value and unit into milliseconds.
 */
export function getDelayMs(value: number, unit: string): number {
  if (unit === 'Minutes') return value * 60 * 1000;
  if (unit === 'Hours') return value * 60 * 60 * 1000;
  if (unit === 'Days') return value * 24 * 60 * 60 * 1000;
  if (unit === 'Weeks') return value * 7 * 24 * 60 * 60 * 1000;
  return value * 60 * 1000;
}

/**
 * Estimates the start time of a legacy job missing createdAt.
 */
export function estimateStartedAt(
  executeAtStr: string,
  oldVal: number,
  oldUnit: string
): Date {
  const originalExecuteAt = new Date(executeAtStr);
  const delayMs = getDelayMs(oldVal, oldUnit);
  return new Date(originalExecuteAt.getTime() - delayMs);
}

/**
 * Calculates the new executeAt date relative to the job's start time.
 */
export function calculateNewExecuteAt(
  startedAtStr: string,
  newVal: number,
  newUnit: string
): Date {
  const executeAt = new Date(startedAtStr);
  if (newUnit === 'Minutes') executeAt.setMinutes(executeAt.getMinutes() + newVal);
  else if (newUnit === 'Hours') executeAt.setHours(executeAt.getHours() + newVal);
  else if (newUnit === 'Days') executeAt.setDate(executeAt.getDate() + newVal);
  else if (newUnit === 'Weeks') executeAt.setDate(executeAt.getDate() + newVal * 7);
  return executeAt;
}

/**
 * Finds all pending jobs matching automationId and nodeId, recalculates their executeAt,
 * and updates them in Firestore using chunked batch writes.
 */
export async function reschedulePendingJobs(
  automationId: string,
  nodeId: string,
  newConfig: Record<string, any>,
  oldConfig: Record<string, any>
): Promise<void> {
  const oldVal = oldConfig.value ?? 5;
  const oldUnit = oldConfig.unit ?? 'Minutes';

  const snap = await adminDb
    .collection('automation_jobs')
    .where('automationId', '==', automationId)
    .where('targetNodeId', '==', nodeId)
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) return;

  const BATCH_LIMIT = 500;
  const docs = snap.docs;

  // Process rescheduling concurrently in batches of 50 tasks to optimize performance
  const CONCURRENCY_LIMIT = 50;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = adminDb.batch();

    for (let j = 0; j < chunk.length; j += CONCURRENCY_LIMIT) {
      const taskSlice = chunk.slice(j, j + CONCURRENCY_LIMIT);
      await Promise.all(
        taskSlice.map(async (doc) => {
          const data = doc.data();
          let startedAt: Date;

          if (data.createdAt) {
            startedAt = new Date(data.createdAt);
          } else {
            startedAt = estimateStartedAt(data.executeAt, oldVal, oldUnit);
          }

          let workspaceId = data.workspaceId || (data.payload?.workspaceId as string);
          if (!workspaceId) {
            const autoSnap = await adminDb.collection('automations').doc(automationId).get();
            workspaceId = autoSnap.data()?.workspaceIds?.[0];
          }
          if (!workspaceId) {
            console.warn(`[RESCHEDULE] Skipping reschedule for job ${doc.id}: missing workspaceId.`);
            return;
          }

          const context = {
            runId: data.runId,
            automationId,
            workspaceId,
            organizationId: data.payload?.organizationId,
            entityId: data.payload?.entityId,
            entityType: data.payload?.entityType || 'contacts',
            payload: data.payload || {},
          };

          const newExecuteAt = await calculateExecuteAt(
            newConfig,
            context,
            startedAt
          );

          batch.update(doc.ref, {
            executeAt: newExecuteAt.toISOString(),
            updatedAt: new Date().toISOString(),
          });

          try {
            await rescheduleDelayTask({
              runId: data.runId,
              nodeId,
              automationId,
              executeAt: newExecuteAt.toISOString(),
              workspaceId,
              channel: parseQueueChannel(data.payload?.channel),
              payload: data.payload,
            });
          } catch (err) {
            console.error(`[RESCHEDULE] Failed to reschedule task for run ${data.runId}:`, err);
          }
        })
      );
    }

    await batch.commit();
  }
}

/**
 * Clean up pending scheduled jobs when a delay node is deleted from the blueprint.
 */
export async function purgePendingJobsForNode(
  automationId: string,
  nodeId: string
): Promise<void> {
  const snap = await adminDb
    .collection('automation_jobs')
    .where('automationId', '==', automationId)
    .where('targetNodeId', '==', nodeId)
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) return;

  const BATCH_LIMIT = 500;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = adminDb.batch();
    for (const doc of chunk) {
      batch.delete(doc.ref);
      const data = doc.data();
      try {
        await cancelDelayTask(data.runId, nodeId, parseQueueChannel(data.payload?.channel));
      } catch (err) {
        console.error(`[PURGE-NODE] Failed to cancel task for run ${data.runId}:`, err);
      }
    }
    await batch.commit();
  }
}

/**
 * Clean up all pending scheduled jobs when an automation is deleted.
 */
export async function purgeAllPendingJobsForAutomation(
  automationId: string
): Promise<void> {
  const snap = await adminDb
    .collection('automation_jobs')
    .where('automationId', '==', automationId)
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) return;

  const BATCH_LIMIT = 500;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = adminDb.batch();
    for (const doc of chunk) {
      batch.delete(doc.ref);
      const data = doc.data();
      if (data.targetNodeId) {
        try {
          await cancelDelayTask(data.runId, data.targetNodeId, parseQueueChannel(data.payload?.channel));
        } catch (err) {
          console.error(`[PURGE-AUTO] Failed to cancel task for run ${data.runId}:`, err);
        }
      }
    }
    await batch.commit();
  }
}

/**
 * Sweeps all pending/parked jobs at a milestone node when the sequential behavior changes
 * and either proceeds downstream immediately or exits the runs.
 */
export async function rescheduleMilestoneJobs(
  automationId: string,
  nodeId: string,
  newBehavior: 'wait' | 'proceed' | 'exit',
  oldBehavior: string | undefined
): Promise<void> {
  if (newBehavior === oldBehavior) return;

  // We only transition contacts away if they were waiting
  if (oldBehavior !== 'wait') return;

  const snap = await adminDb
    .collection('automation_jobs')
    .where('automationId', '==', automationId)
    .where('targetNodeId', '==', nodeId)
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) return;

  console.log(`[rescheduleMilestoneJobs] Found ${snap.size} parked contacts at milestone ${nodeId}. Transitioning to behavior: ${newBehavior}`);

  const { traverseNodes } = await import('./nodes/traverse');
  const { loadAutomationForAuth } = await import('../automation-permissions');

  const automation = await loadAutomationForAuth(automationId);
  if (!automation) return;

  for (const doc of snap.docs) {
    const jobData = doc.data();
    const runId = jobData.runId as string;
    if (!runId) continue;

    const runRef = adminDb.collection('automation_runs').doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) continue;
    const runData = runSnap.data();

    if (newBehavior === 'proceed') {
      // 1. Cancel the parked job in Firestore and GCP Tasks
      await doc.ref.update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        reason: 'Milestone sequential entry behavior changed to Proceed Immediately',
      });
      await cancelDelayTask(runId, nodeId, parseQueueChannel(jobData.payload?.channel)).catch(() => {});

      // 2. Traverse downstream past this milestone node
      const context = {
        entityId: runData?.entityId || '',
        entityType: runData?.entityType || 'institution',
        workspaceId: jobData.workspaceId || runData?.workspaceId || 'prospect',
        payload: jobData.payload || runData?.payload || {},
        automationId,
        runId,
        chainDepth: ((runData?.chainDepth as number) || 0) + 1,
      };

      await traverseNodes(nodeId, automation, context);
    } else if (newBehavior === 'exit') {
      // 1. Cancel the parked job
      await doc.ref.update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        reason: 'Milestone sequential entry behavior changed to End Sequence',
      });
      await cancelDelayTask(runId, nodeId, parseQueueChannel(jobData.payload?.channel)).catch(() => {});

      // 2. Complete the run
      await runRef.update({
        status: 'completed',
        finishedAt: new Date().toISOString(),
      });
    }
  }
}
