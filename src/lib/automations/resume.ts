import { adminDb } from '../firebase-admin';
import type { Automation, AutomationJob } from '../types';
import { logAutomationEvent } from '../automation-log';
import type { ExecutionContext } from './execution-types';
import { traverseNodes } from './nodes/traverse';
import { runAutomationById } from './run-by-id';

const HEARTBEAT_BATCH_SIZE = 20;

export async function resumeAutomationRun(job: AutomationJob): Promise<boolean> {
  try {
    const [autoSnap, runSnap] = await Promise.all([
      adminDb.collection('automations').doc(job.automationId).get(),
      adminDb.collection('automation_runs').doc(job.runId).get(),
    ]);

    if (!autoSnap.exists || !runSnap.exists) {
      throw new Error('Blueprint or Run trace missing during resumption.');
    }

    const automation = { id: autoSnap.id, ...autoSnap.data() } as Automation;

    const context: ExecutionContext = {
      entityId: job.payload.entityId,
      entityType: job.payload.entityType,
      workspaceId: job.payload.workspaceId,
      organizationId: job.payload.organizationId,
      payload: job.payload,
      automationId: job.automationId,
      runId: job.runId,
    };

    await traverseNodes(job.targetNodeId, automation, context);

    const pendingJobs = await adminDb
      .collection('automation_jobs')
      .where('runId', '==', job.runId)
      .where('status', '==', 'pending')
      .get();

    if (pendingJobs.empty) {
      await adminDb.collection('automation_runs').doc(job.runId).update({
        status: 'completed',
        finishedAt: new Date().toISOString(),
      });
    }

    return true;
  } catch {
    logAutomationEvent('error', 'resume_run_failed', {
      automationId: job.automationId,
      runId: job.runId,
      jobId: job.id,
    });
    return false;
  }
}

/**
 * Heartbeat: processes due delayed / campaign automation jobs.
 * Intended to be called every minute by Google Cloud Scheduler.
 */
export async function processScheduledJobsAction(): Promise<{
  success: boolean;
  processed?: number;
  error?: string;
}> {
  logAutomationEvent('info', 'heartbeat_scan_start');

  try {
    try {
      const { evaluateHeartbeatTriggers } = await import('./heartbeat-triggers');
      await evaluateHeartbeatTriggers();
    } catch (triggerErr) {
      console.error('Failed to evaluate heartbeat automation triggers:', triggerErr);
    }

    const { findDuePendingJobs, claimAutomationJob, finalizeAutomationJob } = await import(
      './repository'
    );

    const dueJobs = await findDuePendingJobs(HEARTBEAT_BATCH_SIZE);
    if (!dueJobs.length) return { success: true, processed: 0 };

    let processedCount = 0;

    for (const job of dueJobs) {
      const claimed = await claimAutomationJob(job.id);
      if (!claimed) continue;

      let success = false;
      if (claimed.targetNodeId === '__campaign_trigger__' || !claimed.runId) {
        try {
          await runAutomationById(claimed.automationId, claimed.payload);
          const { dispatchCampaignBlueprintTriggers } = await import(
            '../campaign-automation-dispatch'
          );
          if (claimed.payload?.event) {
            await dispatchCampaignBlueprintTriggers({
              hookEvent: claimed.payload.event,
              payload: claimed.payload,
              excludeAutomationIds: [claimed.automationId],
            });
          }
          success = true;
        } catch (e) {
          logAutomationEvent('error', 'heartbeat_campaign_job_failed', {
            jobId: claimed.id,
            automationId: claimed.automationId,
            workspaceId: claimed.payload?.workspaceId,
            error: e,
          });
        }
      } else {
        success = await resumeAutomationRun(claimed);
      }

      await finalizeAutomationJob(claimed.id, success ? 'completed' : 'failed');
      processedCount++;
    }

    logAutomationEvent('info', 'heartbeat_scan_complete', { processed: processedCount });
    return { success: true, processed: processedCount };
  } catch (error) {
    logAutomationEvent('error', 'heartbeat_critical_failure', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Heartbeat failed',
    };
  }
}
