import { adminDb } from '../firebase-admin';
import type { Automation, AutomationJob } from '../types';
import { logAutomationEvent } from '../automation-log';
import type { ExecutionContext } from './execution-types';
import { traverseNodes } from './nodes/traverse';
import { runAutomationById } from './run-by-id';
import {
  flushAutomationNotificationBuffers,
} from './automation-lifecycle-notify';

const HEARTBEAT_BATCH_SIZE = 500;

export async function resumeAutomationRun(job: AutomationJob): Promise<boolean> {
  try {
    const [autoSnap, runSnap] = await Promise.all([
      adminDb.collection('automations').doc(job.automationId).get(),
      adminDb.collection('automation_runs').doc(job.runId).get(),
    ]);

    if (!autoSnap.exists || !runSnap.exists) {
      throw new Error('Blueprint or Run trace missing during resumption.');
    }

    // Safety net: skip execution if the run has been paused by an admin
    const runData = runSnap.data();
    if (runData?.status === 'paused') {
      return false;
    }

    const automation = { id: autoSnap.id, ...autoSnap.data() } as Automation;

    const workspaceId = job.payload.workspaceId as string | undefined;

    // organizationId lives on the live ExecutionContext but is NOT persisted into
    // job.payload when a Delay node parks the contact — so on resume it is virtually
    // always undefined. Re-resolve it from the workspace (mirroring executor.ts) so
    // resumed message/notification steps run with the SAME org context as an immediate
    // send. Without this, org-scoped sender + provider-key resolution silently fails
    // and the message is never delivered.
    let organizationId = job.payload.organizationId as string | undefined;
    if (!organizationId && workspaceId) {
      try {
        const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
        if (wsSnap.exists) {
          organizationId = (wsSnap.data()?.organizationId as string) || undefined;
        }
      } catch (e) {
        console.warn('[RESUME] Failed to resolve organizationId from workspace:', e);
      }
    }

    const context: ExecutionContext = {
      runId: job.runId,
      automationId: job.automationId,
      workspaceId: workspaceId || 'onboarding',
      organizationId,
      entityId: runData?.entityId || job.payload.entityId || job.payload.contactId || '',
      entityType: runData?.entityType || job.payload.entityType || 'person',
      payload: job.payload,
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
      // Fire aggregated completed notification (fire-and-forget)
      const autoData = autoSnap.data();
      const { notifyAutomationCompleted } = await import('./automation-lifecycle-notify');
      notifyAutomationCompleted({
        automationId: job.automationId,
        automationName: autoData?.name ?? job.automationId,
        workspaceId: (job.payload.workspaceId as string | undefined) ?? '',
      }).catch(() => { /* non-fatal */ });
    }

    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logAutomationEvent('error', 'resume_run_failed', {
      automationId: job.automationId,
      runId: job.runId,
      jobId: job.id,
      targetNodeId: job.targetNodeId,
      error: message,
    });
    console.error(`[RESUME] Failed to resume run ${job.runId} at node ${job.targetNodeId}: ${message}`);
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
    // Preload dynamic modules to prevent load blocks during concurrent operations
    const [
      { evaluateHeartbeatTriggers },
      { findDuePendingJobs, claimAutomationJob, finalizeAutomationJob },
      { evaluateCampaignABTest },
      { dispatchCampaignBlueprintTriggers },
      { processResendCheck },
    ] = await Promise.all([
      import('./heartbeat-triggers'),
      import('./repository'),
      import('../campaign-automation-jobs'),
      import('../campaign-automation-dispatch'),
      import('./resend-jobs'),
    ]);

    try {
      await evaluateHeartbeatTriggers();
    } catch (triggerErr) {
      console.error('Failed to evaluate heartbeat automation triggers:', triggerErr);
    }

    // Flush any pending aggregated automation notifications
    try {
      await flushAutomationNotificationBuffers();
    } catch (flushErr) {
      console.error('Failed to flush automation notification buffers:', flushErr);
    }

    const dueJobs = await findDuePendingJobs(HEARTBEAT_BATCH_SIZE);
    if (!dueJobs.length) return { success: true, processed: 0 };

    let processedCount = 0;
    const CONCURRENCY_LIMIT = 50;

    // Process due jobs concurrently in chunks of 50 tasks
    for (let i = 0; i < dueJobs.length; i += CONCURRENCY_LIMIT) {
      const chunk = dueJobs.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(
        chunk.map(async (job) => {
          const claimed = await claimAutomationJob(job.id);
          if (!claimed) return;

          let success = false;
          if (claimed.targetNodeId === '__campaign_ab_evaluate__') {
            try {
              await evaluateCampaignABTest(claimed.payload.campaignId as string);
              success = true;
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              console.error(`Evaluation failed: ${message}`);
              logAutomationEvent('error', 'heartbeat_ab_evaluate_failed', {
                jobId: claimed.id,
                campaignId: claimed.payload?.campaignId as string | undefined,
                error: message,
              });
            }
          } else if (claimed.targetNodeId === '__campaign_trigger__' || !claimed.runId) {
            try {
              await runAutomationById(claimed.automationId, claimed.payload);
              if (claimed.payload?.event) {
                await dispatchCampaignBlueprintTriggers({
                  hookEvent: claimed.payload.event as string,
                  payload: claimed.payload,
                  excludeAutomationIds: [claimed.automationId],
                });
              }
              success = true;
            } catch (e) {
              logAutomationEvent('error', 'heartbeat_campaign_job_failed', {
                jobId: claimed.id,
                automationId: claimed.automationId,
                workspaceId: claimed.payload?.workspaceId as string | undefined,
                error: e,
              });
            }
          } else if (claimed.targetNodeId === '__resend_check__') {
            try {
              success = await processResendCheck(claimed);
            } catch (e) {
              logAutomationEvent('error', 'resend_check_failed', {
                jobId: claimed.id,
                runId: claimed.runId,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          } else {
            success = await resumeAutomationRun(claimed);
          }

          await finalizeAutomationJob(claimed.id, success ? 'completed' : 'failed');
          processedCount++;
        })
      );
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
