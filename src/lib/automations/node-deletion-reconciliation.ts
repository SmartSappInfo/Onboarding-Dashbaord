import { adminDb } from '../firebase-admin';
import type { Automation, AutomationJob } from '../types';
import { assertAutomationManagePermission } from '../automation-permissions';
import { logAutomationEvent } from '../automation-log';
import type { ExecutionContext } from './execution-types';
import { traverseNodes } from './nodes/traverse';

export type ParkedContactStrategy = 'advance_now' | 'fulfill_schedule' | 'cancel_runs';

export interface ReconcileNodeDeletionOptions {
  automationId: string;
  deletedNodeId: string;
  workspaceId: string;
  userId: string;
  strategy: ParkedContactStrategy;
  nextStepIds?: string[];
}

export interface ReconcileNodeDeletionResult {
  success: boolean;
  totalParked: number;
  processedCount: number;
  error?: string;
}

/**
 * Counts the number of active pending jobs currently parked at a given node.
 * Strictly scoped to workspaceId for cross-tenant isolation.
 */
export async function getParkedJobsCount(
  automationId: string,
  nodeId: string,
  workspaceId?: string
): Promise<number> {
  try {
    let query = adminDb
      .collection('automation_jobs')
      .where('automationId', '==', automationId)
      .where('targetNodeId', '==', nodeId)
      .where('status', '==', 'pending');

    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }

    const snap = await query.get();
    return snap.size;
  } catch (err) {
    console.error(`[NODE-RECONCILE] Error fetching parked jobs count for node ${nodeId}:`, err);
    return 0;
  }
}

/**
 * Reconciles parked contacts when an automation node holding pending/delayed jobs is deleted.
 * 
 * Strategies:
 * 1. 'advance_now': Cancels remaining wait time and immediately advances all parked contacts to the downstream step(s).
 * 2. 'fulfill_schedule': Keeps scheduled wait timers running, but updates job.targetNodeId to pre-routed downstream step(s).
 * 3. 'cancel_runs': Terminates active automation runs for all contacts parked at this node.
 */
export async function reconcileParkedJobsOnNodeDeletion(
  options: ReconcileNodeDeletionOptions
): Promise<ReconcileNodeDeletionResult> {
  const { automationId, deletedNodeId, workspaceId, userId, strategy, nextStepIds = [] } = options;

  try {
    // 1. Enforce user authorization for workspace
    await assertAutomationManagePermission(userId, [workspaceId], 'edit');

    // Load automation blueprint and verify workspace ownership
    const autoSnap = await adminDb.collection('automations').doc(automationId).get();
    if (!autoSnap.exists) {
      return { success: false, totalParked: 0, processedCount: 0, error: 'Automation not found' };
    }

    const automation = { id: autoSnap.id, ...autoSnap.data() } as Automation;
    if (automation.workspaceIds && automation.workspaceIds.length > 0 && !automation.workspaceIds.includes(workspaceId)) {
      throw new Error(`Unauthorized: Automation ${automationId} does not belong to workspace ${workspaceId}`);
    }

    // 2. Fetch pending jobs strictly scoped to workspaceId
    const jobsSnap = await adminDb
      .collection('automation_jobs')
      .where('workspaceId', '==', workspaceId)
      .where('automationId', '==', automationId)
      .where('targetNodeId', '==', deletedNodeId)
      .where('status', '==', 'pending')
      .get();

    if (jobsSnap.empty) {
      return { success: true, totalParked: 0, processedCount: 0 };
    }

    const parkedJobs: AutomationJob[] = jobsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AutomationJob[];

    const totalParked = parkedJobs.length;
    let processedCount = 0;

    // Determine target downstream step ID
    const primaryNextStepId = nextStepIds.length > 0 ? nextStepIds[0] : null;

    // 3. Process jobs in chunked batches of 50 to prevent write contention and resource overloads
    const CHUNK_SIZE = 50;
    for (let i = 0; i < parkedJobs.length; i += CHUNK_SIZE) {
      const chunk = parkedJobs.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();
      let batchHasWrites = false;

      const asyncTasks: Array<() => Promise<void>> = [];

      for (const job of chunk) {
        if (strategy === 'cancel_runs') {
          // Strategy A: Cancel active run and mark job cancelled using Firestore Batch
          const jobRef = adminDb.collection('automation_jobs').doc(job.id);
          const runRef = adminDb.collection('automation_runs').doc(job.runId);

          batch.update(jobRef, {
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
          });
          batch.update(runRef, {
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cancelledReason: `Node ${deletedNodeId} deleted by user`,
          });
          batchHasWrites = true;
          processedCount++;
        } else if (strategy === 'fulfill_schedule') {
          // Strategy B: Pre-route pending job to downstream step while fulfilling original wait schedule
          if (primaryNextStepId) {
            const jobRef = adminDb.collection('automation_jobs').doc(job.id);
            batch.update(jobRef, {
              targetNodeId: primaryNextStepId,
              bypassedNodeId: deletedNodeId,
              updatedAt: new Date().toISOString(),
            });
            batchHasWrites = true;
          } else {
            // Terminal step: mark run completed
            const runRef = adminDb.collection('automation_runs').doc(job.runId);
            batch.update(runRef, {
              status: 'completed',
              finishedAt: new Date().toISOString(),
              completedNote: `Run completed upon deletion of terminal node ${deletedNodeId}`,
            });
            batchHasWrites = true;
          }
          processedCount++;
        } else if (strategy === 'advance_now') {
          // Strategy C: Skip wait time and advance immediately to downstream step
          const jobRef = adminDb.collection('automation_jobs').doc(job.id);
          batch.update(jobRef, {
            status: 'released',
            releasedAt: new Date().toISOString(),
          });
          batchHasWrites = true;

          if (primaryNextStepId) {
            asyncTasks.push(async () => {
              const context: ExecutionContext = {
                runId: job.runId,
                automationId,
                workspaceId: (job.payload?.workspaceId as string) || workspaceId,
                organizationId: (job.payload?.organizationId as string) || undefined,
                entityId: (job.payload?.entityId as string) || (job.payload?.contactId as string) || '',
                entityType: ((job.payload?.entityType as string) || 'person') as 'institution' | 'family' | 'person',
                payload: job.payload || {},
              };
              await traverseNodes(primaryNextStepId, automation, context);
            });
          } else {
            // Terminal step: mark run completed
            const runRef = adminDb.collection('automation_runs').doc(job.runId);
            batch.update(runRef, {
              status: 'completed',
              finishedAt: new Date().toISOString(),
              completedNote: `Run completed upon deletion of terminal node ${deletedNodeId}`,
            });
            batchHasWrites = true;
          }
          processedCount++;
        }
      }

      // Commit batch writes if any modifications were queued
      if (batchHasWrites) {
        await batch.commit();
      }

      // Execute downstream node traversals if strategy === 'advance_now'
      if (asyncTasks.length > 0) {
        await Promise.all(asyncTasks.map((task) => task()));
      }
    }

    logAutomationEvent('info', 'node_deletion_reconciliation_completed', {
      automationId,
      deletedNodeId,
      workspaceId,
      userId,
      strategy,
      totalParked,
      processedCount,
    });

    return {
      success: true,
      totalParked,
      processedCount,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[NODE-RECONCILE] Failed to reconcile parked jobs for node ${deletedNodeId}:`, errorMsg);
    return {
      success: false,
      totalParked: 0,
      processedCount: 0,
      error: errorMsg,
    };
  }
}
