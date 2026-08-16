import { adminDb } from '../firebase-admin';
import type { Automation, AutomationJob, AutomationRun } from '../types';
import { assertAutomationManagePermission } from '../automation-permissions';
import { logAutomationEvent } from '../automation-log';
import type { ExecutionContext } from './execution-types';

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
 * Used by the canvas UI before deleting a node to determine if a strategy modal is needed.
 */
export async function getParkedJobsCount(automationId: string, nodeId: string): Promise<number> {
  try {
    const snap = await adminDb
      .collection('automation_jobs')
      .where('automationId', '==', automationId)
      .where('targetNodeId', '==', nodeId)
      .where('status', '==', 'pending')
      .get();
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
    // 1. Enforce user authorization
    await assertAutomationManagePermission(userId, [workspaceId], 'edit');

    // 2. Fetch pending jobs for the target node
    const jobsSnap = await adminDb
      .collection('automation_jobs')
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

    // Load automation blueprint for downstream traversal if advancing immediately
    const autoSnap = await adminDb.collection('automations').doc(automationId).get();
    const automation = autoSnap.exists ? ({ id: autoSnap.id, ...autoSnap.data() } as Automation) : null;

    // Determine target downstream step ID
    const primaryNextStepId = nextStepIds.length > 0 ? nextStepIds[0] : null;

    // 3. Process jobs in chunked batches of 50 to avoid CPU/memory overload or write contention
    const CHUNK_SIZE = 50;
    for (let i = 0; i < parkedJobs.length; i += CHUNK_SIZE) {
      const chunk = parkedJobs.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (job) => {
          try {
            if (strategy === 'cancel_runs') {
              // Strategy A: Cancel active run and mark job cancelled
              await Promise.all([
                adminDb.collection('automation_jobs').doc(job.id).update({
                  status: 'cancelled',
                  cancelledAt: new Date().toISOString(),
                }),
                adminDb.collection('automation_runs').doc(job.runId).update({
                  status: 'cancelled',
                  cancelledAt: new Date().toISOString(),
                  cancelledReason: `Node ${deletedNodeId} deleted by user`,
                }),
              ]);
              processedCount++;
            } else if (strategy === 'fulfill_schedule') {
              // Strategy B: Pre-route pending job to downstream step while fulfilling original wait schedule
              if (primaryNextStepId) {
                await adminDb.collection('automation_jobs').doc(job.id).update({
                  targetNodeId: primaryNextStepId,
                  bypassedNodeId: deletedNodeId,
                  updatedAt: new Date().toISOString(),
                });
              }
              processedCount++;
            } else if (strategy === 'advance_now') {
              // Strategy C: Skip wait time and advance immediately to downstream step
              await adminDb.collection('automation_jobs').doc(job.id).update({
                status: 'released',
                releasedAt: new Date().toISOString(),
              });

              if (automation && primaryNextStepId) {
                const { traverseNodes } = await import('./nodes/traverse');
                const context: ExecutionContext = {
                  runId: job.runId,
                  automationId,
                  workspaceId: (job.payload?.workspaceId as string) || workspaceId,
                  organizationId: (job.payload?.organizationId as string) || undefined,
                  entityId: (job.payload?.entityId as string) || (job.payload?.contactId as string) || '',
                  entityType: ((job.payload?.entityType as string) || 'person') as 'institution' | 'family' | 'person',
                  payload: job.payload || {},
                };

                // Trigger downstream traversal asynchronously
                await traverseNodes(primaryNextStepId, automation, context);
              }
              processedCount++;
            }
          } catch (jobErr) {
            console.error(`[NODE-RECONCILE] Error processing job ${job.id} under strategy ${strategy}:`, jobErr);
          }
        })
      );
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
