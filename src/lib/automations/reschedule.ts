import { adminDb } from '../firebase-admin';
import { cancelDelayTask, rescheduleDelayTask } from '../gcp-tasks-client';

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
  newConfig: { value?: number; unit?: string },
  oldConfig: { value?: number; unit?: string }
): Promise<void> {
  const newVal = newConfig.value ?? 5;
  const newUnit = newConfig.unit ?? 'Minutes';

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

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = adminDb.batch();

    for (const doc of chunk) {
      const data = doc.data();
      let startedAt: Date;

      if (data.createdAt) {
        startedAt = new Date(data.createdAt);
      } else {
        startedAt = estimateStartedAt(data.executeAt, oldVal, oldUnit);
      }

      const newExecuteAt = calculateNewExecuteAt(
        startedAt.toISOString(),
        newVal,
        newUnit
      );

      const now = new Date();
      if (newExecuteAt.getTime() <= now.getTime()) {
        // Job is due immediately. Claim and execute it now to avoid cron latency.
        const { resumeAutomationRun } = await import('./resume');
        const claimedJob = {
          ...data,
          id: doc.id,
          status: 'processing',
          claimedAt: now.toISOString(),
          executeAt: newExecuteAt.toISOString(),
        } as any;

        // Cancel the scheduled remote task since we execute immediately
        try {
          await cancelDelayTask(data.runId, nodeId, data.payload?.channel as any);
        } catch (err) {
          console.error(`[RESCHEDULE] Failed to cancel task for run ${data.runId}:`, err);
        }

        const success = await resumeAutomationRun(claimedJob);
        batch.update(doc.ref, {
          status: success ? 'completed' : 'failed',
          executeAt: newExecuteAt.toISOString(),
          finishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Reschedule task in GCP Cloud Tasks
        try {
          await rescheduleDelayTask({
            runId: data.runId,
            nodeId,
            automationId,
            executeAt: newExecuteAt.toISOString(),
            channel: data.payload?.channel as any,
            payload: data.payload,
          });
        } catch (err) {
          console.error(`[RESCHEDULE] Failed to reschedule task for run ${data.runId}:`, err);
        }

        batch.update(doc.ref, {
          executeAt: newExecuteAt.toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
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
        await cancelDelayTask(data.runId, nodeId, data.payload?.channel as any);
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
          await cancelDelayTask(data.runId, data.targetNodeId, data.payload?.channel as any);
        } catch (err) {
          console.error(`[PURGE-AUTO] Failed to cancel task for run ${data.runId}:`, err);
        }
      }
    }
    await batch.commit();
  }
}
