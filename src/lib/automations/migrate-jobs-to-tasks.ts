import { adminDb } from '../firebase-admin';
import { scheduleDelayTask } from '../gcp-tasks-client';
import type { AutomationJob } from '../types';

/**
 * Migration script to transition legacy pending pull-cron jobs to event-driven push tasks.
 * Can be run manually or during server updates.
 */
export async function migratePendingJobsToTasks(): Promise<{
  success: boolean;
  migratedCount: number;
  cancelledCount: number;
  error?: string;
}> {
  console.info('[MIGRATION] Starting migration from legacy pending jobs to Cloud Tasks...');
  try {
    const pendingJobsSnap = await adminDb
      .collection('automation_jobs')
      .where('status', '==', 'pending')
      .get();

    if (pendingJobsSnap.empty) {
      console.info('[MIGRATION] Zero pending jobs found. Migration completed.');
      return { success: true, migratedCount: 0, cancelledCount: 0 };
    }

    let migratedCount = 0;
    let cancelledCount = 0;

    for (const jobDoc of pendingJobsSnap.docs) {
      const job = { id: jobDoc.id, ...jobDoc.data() } as AutomationJob;
      
      // Skip if it is already a GCP Task or Mock
      if ((job as any).type === 'gcp_task' || (job as any).type === 'gcp_task_mock') {
        continue;
      }

      const runSnap = await adminDb.collection('automation_runs').doc(job.runId).get();
      if (!runSnap.exists || runSnap.data()?.status !== 'running') {
        // Cancel the job since the run is no longer active
        await jobDoc.ref.update({
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          notes: 'Cancelled during task queue migration (run is inactive/missing).'
        });
        cancelledCount++;
        continue;
      }

      // Schedule the task in GCP Tasks (or Emulator)
      try {
        const workspaceId = job.workspaceId || (job.payload?.workspaceId as string);
        if (!workspaceId) {
          console.warn(`[MIGRATION] Skipping job ${job.id}: missing workspaceId.`);
          continue;
        }
        await scheduleDelayTask({
          runId: job.runId,
          nodeId: job.targetNodeId,
          automationId: job.automationId,
          executeAt: job.executeAt,
          workspaceId,
          channel: job.payload?.channel as any,
          payload: job.payload,
        });
        migratedCount++;
      } catch (err: any) {
        console.error(`[MIGRATION] Failed to schedule task for job ${job.id}:`, err.message);
      }
    }

    console.info(`[MIGRATION] Migration complete. Migrated: ${migratedCount}, Cancelled: ${cancelledCount}`);
    return { success: true, migratedCount, cancelledCount };
  } catch (error: any) {
    console.error('[MIGRATION] Critical failure running job migration:', error);
    return {
      success: false,
      migratedCount: 0,
      cancelledCount: 0,
      error: error.message || 'Migration critical error',
    };
  }
}
