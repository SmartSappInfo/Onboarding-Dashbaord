'use server';

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logAutomationEvent } from '../automation-log';
import type { Automation, AutomationRun } from '../types';
import { cancelDelayTask, scheduleDelayTask, parseQueueChannel } from '../gcp-tasks-client';

interface RunManagementResult {
  success: boolean;
  error?: string;
  newRunId?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

async function assertRunExists(runId: string) {
  const snap = await adminDb.collection('automation_runs').doc(runId).get();
  if (!snap.exists) throw new Error('Automation run not found.');
  return { ref: snap.ref, data: { id: snap.id, ...snap.data() } as AutomationRun };
}

async function getAutomationForRun(automationId: string): Promise<Automation> {
  const snap = await adminDb.collection('automations').doc(automationId).get();
  if (!snap.exists) throw new Error('Parent automation blueprint not found.');
  return { id: snap.id, ...snap.data() } as Automation;
}

async function purgeRunPendingJobs(runId: string): Promise<number> {
  const jobsSnap = await adminDb
    .collection('automation_jobs')
    .where('runId', '==', runId)
    .where('status', 'in', ['pending', 'paused'])
    .get();

  if (jobsSnap.empty) return 0;

  const batch = adminDb.batch();
  for (const doc of jobsSnap.docs) {
    batch.delete(doc.ref);
    const jobData = doc.data();
    if (jobData.targetNodeId) {
      try {
        await cancelDelayTask(runId, jobData.targetNodeId, parseQueueChannel(jobData.payload?.channel));
      } catch (err) {
        console.error(`[PURGE] Failed to cancel task for run ${runId}:`, err);
      }
    }
  }
  await batch.commit();
  return jobsSnap.size;
}

// ── 1. Restart Run ──────────────────────────────────────────────────────────────

/**
 * Creates a brand-new run from the same entity/trigger data and re-executes
 * the automation from the trigger node. Only available for failed/completed runs.
 */
export async function restartAutomationRun(
  runId: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    const { data: run } = await assertRunExists(runId);

    if (run.status === 'running') {
      throw new Error('Cannot restart a currently running automation. End it first.');
    }

    const automation = await getAutomationForRun(run.automationId);

    if (!automation.isActive) {
      throw new Error('Cannot restart — the parent automation is inactive.');
    }

    // Execute a fresh run with the same trigger payload
    const { executeAutomation } = await import('./executor');
    await executeAutomation(automation, run.triggerData as Record<string, unknown>);

    logAutomationEvent('info', 'run_restarted', {
      originalRunId: runId,
      automationId: run.automationId,
      entityId: run.entityId ?? undefined,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'restart_run_failed', { runId, error: message });
    return { success: false, error: message };
  }
}

// ── 2. Retry Failed Step ────────────────────────────────────────────────────────

/**
 * Re-executes the automation from a specific failed node using the original
 * run's context/payload. Resets the run status back to 'running'.
 */
export async function retryFailedStep(
  runId: string,
  nodeId: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    const { ref, data: run } = await assertRunExists(runId);

    // No run-status guard: the step-level check below is the real safety net.
    // A step can be retried regardless of overall run status (running, failed, completed, paused).

    const failedStep = run.steps?.[nodeId];
    if (!failedStep || failedStep.status !== 'failed') {
      throw new Error(`Node "${nodeId}" did not fail in this run.`);
    }

    const automation = await getAutomationForRun(run.automationId);

    // Reset run status to running and restore paused jobs so delay nodes can resume
    const pausedJobsSnap = await adminDb
      .collection('automation_jobs')
      .where('runId', '==', runId)
      .where('status', '==', 'paused')
      .get();

    const batch = adminDb.batch();
    batch.update(ref, {
      status: 'running',
      error: FieldValue.delete(),
      finishedAt: FieldValue.delete(),
    });
    pausedJobsSnap.docs.forEach((jobDoc) =>
      batch.update(jobDoc.ref, { status: 'pending' })
    );
    await batch.commit();

    // Re-traverse from the failed node
    const { traverseNodes } = await import('./nodes/traverse');

    const context = {
      entityId: run.entityId ?? undefined,
      entityType: run.entityType,
      workspaceId: run.workspaceId ?? '',
      organizationId: (run.triggerData as Record<string, unknown>).organizationId as string ?? '',
      payload: run.triggerData as Record<string, unknown>,
      automationId: run.automationId,
      runId: run.id,
    };

    try {
      await traverseNodes(nodeId, automation, context);

      // Check if all jobs are done
      const pendingJobs = await adminDb
        .collection('automation_jobs')
        .where('runId', '==', runId)
        .where('status', '==', 'pending')
        .get();

      if (pendingJobs.empty) {
        await ref.update({
          status: 'completed',
          finishedAt: new Date().toISOString(),
        });
      }
    } catch (execError: unknown) {
      const execMessage = execError instanceof Error ? execError.message : String(execError);
      await ref.update({
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: execMessage,
      });
    }

    logAutomationEvent('info', 'step_retried', {
      runId,
      nodeId,
      automationId: run.automationId,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'retry_step_failed', { runId, nodeId, error: message });
    return { success: false, error: message };
  }
}

// ── 3. Force End Run ────────────────────────────────────────────────────────────

/**
 * Immediately terminates a run (marks completed + terminatedManually),
 * and purges all pending scheduled jobs for it.
 */
export async function forceEndRun(
  runId: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    const { ref, data: run } = await assertRunExists(runId);

    if (run.status === 'completed' || run.status === 'failed') {
      throw new Error('Run is already finished.');
    }

    await ref.update({
      status: 'completed',
      finishedAt: new Date().toISOString(),
      terminatedManually: true,
    });

    await purgeRunPendingJobs(runId);

    logAutomationEvent('info', 'run_force_ended', {
      runId,
      automationId: run.automationId,
      entityId: run.entityId ?? undefined,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'force_end_failed', { runId, error: message });
    return { success: false, error: message };
  }
}

// ── 4. Force Advance (Skip Current Wait) ────────────────────────────────────────

/**
 * Skips the current delay/wait step and resumes traversal from the next
 * downstream node. Only works when the run has a pending job.
 */
export async function forceAdvanceRun(
  runId: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    const { data: run } = await assertRunExists(runId);

    if (run.status !== 'running' && run.status !== 'paused') {
      throw new Error('Run must be running or paused to advance.');
    }

    // Find the pending job for this run
    const pendingJobSnap = await adminDb
      .collection('automation_jobs')
      .where('runId', '==', runId)
      .where('status', 'in', ['pending', 'paused'])
      .limit(1)
      .get();

    if (pendingJobSnap.empty) {
      throw new Error('No pending wait step found to skip.');
    }

    const jobDoc = pendingJobSnap.docs[0];
    const jobData = { id: jobDoc.id, ...jobDoc.data() } as Record<string, unknown>;

    // Claim the job and cancel the remote Cloud Task
    await jobDoc.ref.update({
      status: 'processing',
      claimedAt: new Date().toISOString(),
    });

    if (jobData.targetNodeId) {
      try {
        const payloadObj = jobData.payload as Record<string, unknown> | undefined;
        await cancelDelayTask(runId, jobData.targetNodeId as string, parseQueueChannel(payloadObj?.channel));
      } catch (err) {
        console.error(`[ADVANCE] Failed to cancel task for run ${runId}:`, err);
      }
    }

    // If run was paused, resume it
    if (run.status === 'paused') {
      await adminDb.collection('automation_runs').doc(runId).update({
        status: 'running',
        pausedAt: FieldValue.delete(),
        pausedBy: FieldValue.delete(),
      });
    }

    // Resume from the target node
    const { resumeAutomationRun } = await import('./resume');
    const success = await resumeAutomationRun(jobData as unknown as import('../types').AutomationJob);

    await jobDoc.ref.update({
      status: success ? 'completed' : 'failed',
      finishedAt: new Date().toISOString(),
    });

    logAutomationEvent('info', 'run_force_advanced', {
      runId,
      jobId: jobDoc.id,
      automationId: run.automationId,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'force_advance_failed', { runId, error: message });
    return { success: false, error: message };
  }
}

// ── 5. Pause Run ────────────────────────────────────────────────────────────────

/**
 * Pauses a running automation for a specific contact. Sets the run to 'paused'
 * and marks all pending jobs as 'paused' so the heartbeat processor skips them.
 */
export async function pauseRun(
  runId: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    const { ref, data: run } = await assertRunExists(runId);

    if (run.status !== 'running') {
      throw new Error('Only running automations can be paused.');
    }

    await ref.update({
      status: 'paused',
      pausedAt: new Date().toISOString(),
      pausedBy: userId,
    });

    // Pause all pending jobs for this run
    const pendingJobs = await adminDb
      .collection('automation_jobs')
      .where('runId', '==', runId)
      .where('status', '==', 'pending')
      .get();

    if (!pendingJobs.empty) {
      const batch = adminDb.batch();
      for (const doc of pendingJobs.docs) {
        batch.update(doc.ref, { status: 'paused' });
        const jobData = doc.data();
        if (jobData.targetNodeId) {
          try {
            await cancelDelayTask(runId, jobData.targetNodeId, parseQueueChannel(jobData.payload?.channel));
          } catch (err) {
            console.error(`[PAUSE] Failed to cancel task for run ${runId}:`, err);
          }
        }
      }
      await batch.commit();
    }

    logAutomationEvent('info', 'run_paused', {
      runId,
      automationId: run.automationId,
      entityId: run.entityId ?? undefined,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'pause_run_failed', { runId, error: message });
    return { success: false, error: message };
  }
}

// ── 6. Resume Paused Run ────────────────────────────────────────────────────────

/**
 * Resumes a paused run, restoring all paused jobs back to 'pending'
 * so the heartbeat processor/tasks engine picks them up again.
 */
export async function resumePausedRun(
  runId: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    const { ref, data: run } = await assertRunExists(runId);

    if (run.status !== 'paused') {
      throw new Error('Only paused runs can be resumed.');
    }

    await ref.update({
      status: 'running',
      pausedAt: FieldValue.delete(),
      pausedBy: FieldValue.delete(),
    });

    // Restore paused jobs back to pending
    const pausedJobs = await adminDb
      .collection('automation_jobs')
      .where('runId', '==', runId)
      .where('status', '==', 'paused')
      .get();

    if (!pausedJobs.empty) {
      const batch = adminDb.batch();
      for (const doc of pausedJobs.docs) {
        batch.update(doc.ref, { status: 'pending' });
        const jobData = doc.data();
        if (jobData.targetNodeId) {
          try {
            await scheduleDelayTask({
              runId,
              nodeId: jobData.targetNodeId,
              automationId: run.automationId,
              executeAt: jobData.executeAt,
              channel: parseQueueChannel(jobData.payload?.channel),
              payload: jobData.payload,
            });
          } catch (err) {
            console.error(`[RESUME] Failed to schedule task for run ${runId}:`, err);
          }
        }
      }
      await batch.commit();
    }

    logAutomationEvent('info', 'run_resumed', {
      runId,
      automationId: run.automationId,
      entityId: run.entityId ?? undefined,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'resume_run_failed', { runId, error: message });
    return { success: false, error: message };
  }
}
