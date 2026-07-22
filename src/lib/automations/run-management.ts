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
      await traverseNodes(nodeId, automation, context, true);

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

// ── 3. Terminate Run ──────────────────────────────────────────────────────────────

export async function resendFailedMessage(
  logId: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    
    const logSnap = await adminDb.collection('message_logs').doc(logId).get();
    if (!logSnap.exists) throw new Error('Message log not found.');
    const messageLog = { id: logSnap.id, ...logSnap.data() } as any;

    if (messageLog.status !== 'failed') {
      throw new Error('Can only resend messages that have failed.');
    }

    const { sendMessage } = await import('../messaging-engine');
    
    const resendNumber = (messageLog.resendNumber || 0) + 1;

    const result = await sendMessage({
      templateId: messageLog.templateId,
      senderProfileId: messageLog.senderProfileId,
      organizationId: messageLog.organizationId,
      recipient: messageLog.recipient,
      variables: messageLog.variables || {},
      entityId: messageLog.entityId,
      workspaceId: messageLog.workspaceId,
      automationId: messageLog.automationId,
      runId: messageLog.runId,
      nodeId: messageLog.nodeId,
      subject: messageLog.subject,
      previewText: messageLog.previewText,
      body: messageLog.body,
      isResend: true,
      resendOfLogId: logId,
      resendNumber: resendNumber,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to resend message.');
    }

    logAutomationEvent('info', 'message_resent', {
      logId,
      automationId: messageLog.automationId,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'resend_message_failed', { logId, error: message });
    return { success: false, error: message };
  }
}

export async function terminateAutomationRunInternal(
  runId: string,
  targetStatus: 'cancelled' | 'completed',
  terminatedManually: boolean
): Promise<void> {
  const runRef = adminDb.collection('automation_runs').doc(runId);
  const runSnap = await runRef.get();
  if (!runSnap.exists) return;

  const runData = runSnap.data() as AutomationRun;
  const now = new Date().toISOString();

  // 1. Update the steps map: find any steps with status 'waiting' and mark them 'cancelled'
  const steps = { ...(runData.steps || {}) };
  Object.keys(steps).forEach((nodeId) => {
    if (steps[nodeId].status === 'waiting') {
      steps[nodeId] = {
        ...steps[nodeId],
        status: 'cancelled',
        metadata: {
          ...(steps[nodeId].metadata || {}),
          cancelledAt: now,
          resumedAt: now,
        },
      };
    }
  });

  // 2. Update run document (clear currentNodeId)
  const runUpdatePayload: Record<string, unknown> = {
    status: targetStatus,
    finishedAt: now,
    steps,
    currentNodeId: null,
  };
  if (terminatedManually) {
    runUpdatePayload.terminatedManually = true;
  }
  await runRef.update(runUpdatePayload);

  // 3. Cancel and update jobs to 'cancelled' (not deleted, for traceability)
  const jobsSnap = await adminDb
    .collection('automation_jobs')
    .where('runId', '==', runId)
    .where('status', 'in', ['pending', 'paused'])
    .get();

  if (!jobsSnap.empty) {
    const batch = adminDb.batch();
    for (const jobDoc of jobsSnap.docs) {
      batch.update(jobDoc.ref, {
        status: 'cancelled',
        cancelledAt: now,
        finishedAt: now,
      });
    }

    // Trigger GCP Task cancellations in parallel to avoid delaying database commits
    const cancelPromises = jobsSnap.docs.map(async (jobDoc) => {
      const jobData = jobDoc.data();
      if (jobData.targetNodeId) {
        try {
          await cancelDelayTask(
            runId,
            jobData.targetNodeId,
            parseQueueChannel(jobData.payload?.channel),
            true,
            jobData.gcpTaskName as string | undefined
          );
        } catch (err) {
          console.error(`[TERMINATE] Failed to cancel task from queue for run ${runId}:`, err);
        }
      }
    });

    await Promise.allSettled(cancelPromises);
    await batch.commit();
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
    const { data: run } = await assertRunExists(runId);

    if (run.status === 'completed' || run.status === 'failed') {
      throw new Error('Run is already finished.');
    }

    await terminateAutomationRunInternal(runId, 'completed', true);

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
          let workspaceId = run.workspaceId || jobData.workspaceId;
          if (!workspaceId) {
            const autoSnap = await adminDb.collection('automations').doc(run.automationId).get();
            workspaceId = autoSnap.data()?.workspaceIds?.[0];
          }
          if (!workspaceId) {
            console.error(`[RESUME] Cannot resume job ${doc.id} for run ${runId}: missing workspaceId.`);
            continue;
          }
          try {
            await scheduleDelayTask({
              runId,
              nodeId: jobData.targetNodeId,
              automationId: run.automationId,
              executeAt: jobData.executeAt,
              workspaceId,
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

// ── 7. Jump Run to Step ──────────────────────────────────────────────────────────

/**
 * Moves an automation run directly to any target node in the canvas.
 * Purges pending jobs for old nodes and schedules immediate traversal to target.
 */
export async function jumpRunToStep(
  runId: string,
  targetNodeId: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    if (!targetNodeId) throw new Error('Target node ID is required.');

    const { ref: runRef, data: run } = await assertRunExists(runId);

    // Fetch automation to validate node existence
    const autoSnap = await adminDb.collection('automations').doc(run.automationId).get();
    if (!autoSnap.exists) {
      throw new Error(`Automation document ${run.automationId} not found.`);
    }
    const automation = { id: autoSnap.id, ...autoSnap.data() } as Automation;

    const targetNode = automation.nodes?.find((n) => n.id === targetNodeId);
    if (!targetNode) {
      throw new Error(`Target node ${targetNodeId} does not exist in automation schema.`);
    }

    // Purge pending jobs for this run
    await purgeAllPendingJobsForRun(runId);

    // Update run document to target node
    await runRef.update({
      currentNodeId: targetNodeId,
      currentNodeLabel: targetNode.data?.label || targetNodeId,
      status: 'running',
      finishedAt: FieldValue.delete(),
      error: FieldValue.delete(),
    });

    // Traverse from target node
    const context: TraversalContext = {
      runId,
      automationId: run.automationId,
      workspaceId: run.workspaceId || automation.workspaceIds?.[0] || '',
      entityId: run.entityId ?? undefined,
      entityType: run.entityType ?? undefined,
      payload: run.payload ?? {},
    };

    await traverseNodes(targetNodeId, automation, context);

    logAutomationEvent('info', 'run_jumped_to_step', {
      runId,
      automationId: run.automationId,
      targetNodeId,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'jump_run_to_step_failed', { runId, targetNodeId, error: message });
    return { success: false, error: message };
  }
}

// ── 8. Reschedule Wait Job ───────────────────────────────────────────────────────

/**
 * Updates the executeAt timestamp for a pending wait job and reschedules its GCP Cloud Task.
 */
export async function rescheduleWaitJob(
  jobId: string,
  newExecuteAtIso: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    if (!newExecuteAtIso) throw new Error('New execution time is required.');

    const jobSnap = await adminDb.collection('automation_jobs').doc(jobId).get();
    if (!jobSnap.exists) {
      throw new Error(`Wait job ${jobId} not found.`);
    }

    const jobData = jobSnap.data() as {
      runId: string;
      targetNodeId?: string;
      workspaceId?: string;
      payload?: Record<string, unknown>;
    };

    const runSnap = await adminDb.collection('automation_runs').doc(jobData.runId).get();
    const runData = runSnap.exists ? (runSnap.data() as AutomationRun) : null;

    // Update job document
    await jobSnap.ref.update({
      executeAt: newExecuteAtIso,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    });

    // Reschedule GCP Cloud Task if targetNodeId is present
    if (jobData.targetNodeId && runData) {
      const workspaceId = runData.workspaceId || jobData.workspaceId || '';
      try {
        await cancelDelayTask(jobData.runId, jobData.targetNodeId, parseQueueChannel(jobData.payload?.channel));
      } catch (err) {
        console.warn(`[RESCHEDULE] Task cancel warning for job ${jobId}:`, err);
      }

      await scheduleDelayTask({
        runId: jobData.runId,
        nodeId: jobData.targetNodeId,
        automationId: runData.automationId,
        executeAt: newExecuteAtIso,
        workspaceId,
        channel: parseQueueChannel(jobData.payload?.channel),
        payload: jobData.payload,
      });
    }

    logAutomationEvent('info', 'wait_job_rescheduled', {
      jobId,
      runId: jobData.runId,
      newExecuteAt: newExecuteAtIso,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'reschedule_wait_job_failed', { jobId, error: message });
    return { success: false, error: message };
  }
}

// ── 9. Update Run Payload ────────────────────────────────────────────────────────

/**
 * Updates the JSON payload of an automation run.
 */
export async function updateRunPayload(
  runId: string,
  updatedPayload: Record<string, unknown>,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    const { ref: runRef, data: run } = await assertRunExists(runId);

    await runRef.update({
      payload: updatedPayload,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    });

    logAutomationEvent('info', 'run_payload_updated', {
      runId,
      automationId: run.automationId,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'update_run_payload_failed', { runId, error: message });
    return { success: false, error: message };
  }
}

// ── 10. Clean & Verify Contact Details ──────────────────────────────────────────

/**
 * Updates email and phone details for a contact on both run payload and master contact record.
 */
export async function cleanAndVerifyRunContact(
  runId: string,
  updatedEmail: string,
  updatedPhone: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    const { ref: runRef, data: run } = await assertRunExists(runId);

    const contactId = run.entityId || (run.payload?.contactId as string | undefined);
    if (contactId) {
      const contactRef = adminDb.collection('contacts').doc(contactId);
      const contactSnap = await contactRef.get();
      if (contactSnap.exists) {
        await contactRef.update({
          ...(updatedEmail ? { email: updatedEmail } : {}),
          ...(updatedPhone ? { phone: updatedPhone } : {}),
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        });
      }
    }

    const nextPayload = {
      ...(run.payload || {}),
      ...(updatedEmail ? { email: updatedEmail } : {}),
      ...(updatedPhone ? { phone: updatedPhone } : {}),
    };

    await runRef.update({
      payload: nextPayload,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    });

    logAutomationEvent('info', 'run_contact_cleaned', {
      runId,
      contactId: contactId ?? undefined,
      userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'clean_run_contact_failed', { runId, error: message });
    return { success: false, error: message };
  }
}

// ── 11. Create Internal Follow-up Task ──────────────────────────────────────────

/**
 * Creates an internal follow-up task assigned to a team member for a contact.
 */
export async function createContactFollowupTask(
  workspaceId: string,
  contactId: string,
  assigneeId: string,
  title: string,
  description: string,
  userId: string
): Promise<RunManagementResult> {
  try {
    if (!userId) throw new Error('User ID is required.');
    if (!workspaceId || !contactId || !title) {
      throw new Error('Workspace ID, contact ID, and task title are required.');
    }

    const newTaskRef = adminDb.collection('tasks').doc();
    await newTaskRef.set({
      id: newTaskRef.id,
      workspaceId,
      contactId,
      assigneeId: assigneeId || userId,
      title,
      description: description || '',
      status: 'todo',
      priority: 'high',
      createdAt: new Date().toISOString(),
      createdBy: userId,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'create_followup_task_failed', { contactId, error: message });
    return { success: false, error: message };
  }
}
