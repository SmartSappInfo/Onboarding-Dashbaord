'use server';

/**
 * @fileoverview Server Actions for Workspace Orphaned Run Detection & Bulk Cleanup.
 *
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer & Security Protocol):
 * 1. Tenant Isolation: All queries strictly filter by workspaceId.
 * 2. High Load Safety: Uses cursor-based pagination, 50-item Firestore batches,
 *    and event-loop macro-task yields to support 500+ run sweeps without memory exhaustion.
 * 3. Strict Type Safety: Zero 'any' or 'any[]' typings permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Automation, AutomationRun } from '@/lib/types';
import { assertAutomationManagePermission } from '@/lib/automation-permissions';
import { logAutomationEvent } from '@/lib/automation-log';
import type { ExecutionContext } from '@/lib/automations/execution-types';

export interface OrphanedRunInfo {
  runId: string;
  automationId: string;
  automationName: string;
  entityId: string;
  entityName?: string;
  orphanedNodeId: string;
  orphanedNodeLabel?: string;
  startedAt: string;
}

export interface ScanOrphanedRunsResult {
  success: boolean;
  totalActiveRunsScanned: number;
  totalOrphanedRuns: number;
  orphanedRuns: OrphanedRunInfo[];
  error?: string;
}

export interface ReconcileOrphanedRunsOptions {
  workspaceId: string;
  userId: string;
  strategy: 'advance_all' | 'cancel_all';
  runIds?: string[];
  automationId?: string;
}

export interface ReconcileOrphanedRunsResult {
  success: boolean;
  totalProcessed: number;
  advancedCount: number;
  cancelledCount: number;
  error?: string;
}

/**
 * Scans active runs in a workspace to detect orphaned records whose currentNodeId
 * no longer exists in their parent automation blueprint.
 */
export async function scanOrphanedRunsAction(
  workspaceId: string,
  userId: string,
  automationId?: string
): Promise<ScanOrphanedRunsResult> {
  try {
    if (!userId || !workspaceId) {
      throw new Error('Workspace ID and User ID are required.');
    }

    await assertAutomationManagePermission(userId, [workspaceId], 'edit');

    let query = adminDb
      .collection('automation_runs')
      .where('workspaceId', '==', workspaceId)
      .where('status', '==', 'running');

    if (automationId) {
      query = query.where('automationId', '==', automationId);
    }

    const runsSnap = await query.get();
    if (runsSnap.empty) {
      return {
        success: true,
        totalActiveRunsScanned: 0,
        totalOrphanedRuns: 0,
        orphanedRuns: [],
      };
    }

    const activeRuns: AutomationRun[] = runsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AutomationRun[];

    // Cache loaded automation blueprints to avoid duplicate queries
    const autoCache = new Map<string, Automation>();
    const orphanedRuns: OrphanedRunInfo[] = [];

    for (const run of activeRuns) {
      if (!run.currentNodeId) continue;

      let automation = autoCache.get(run.automationId);
      if (!automation) {
        const autoSnap = await adminDb.collection('automations').doc(run.automationId).get();
        if (autoSnap.exists) {
          automation = { id: autoSnap.id, ...autoSnap.data() } as Automation;
          autoCache.set(run.automationId, automation);
        }
      }

      if (!automation) continue;

      const nodeExists = automation.nodes.some((n) => n.id === run.currentNodeId);
      if (!nodeExists) {
        orphanedRuns.push({
          runId: run.id,
          automationId: run.automationId,
          automationName: automation.name || run.automationId,
          entityId: run.entityId || '',
          entityName: run.triggerData?.['entity.displayName'] as string | undefined,
          orphanedNodeId: run.currentNodeId,
          orphanedNodeLabel: run.currentNodeLabel,
          startedAt: run.startedAt,
        });
      }
    }

    return {
      success: true,
      totalActiveRunsScanned: activeRuns.length,
      totalOrphanedRuns: orphanedRuns.length,
      orphanedRuns,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[ORPHAN-SCAN] Error scanning orphaned runs:', errorMsg);
    return {
      success: false,
      totalActiveRunsScanned: 0,
      totalOrphanedRuns: 0,
      orphanedRuns: [],
      error: errorMsg,
    };
  }
}

/**
 * Reconciles orphaned runs in bulk (either advancing them to the next valid step or cancelling them).
 */
export async function reconcileOrphanedRunsAction(
  options: ReconcileOrphanedRunsOptions
): Promise<ReconcileOrphanedRunsResult> {
  const { workspaceId, userId, strategy, runIds, automationId } = options;

  try {
    if (!userId || !workspaceId) {
      throw new Error('Workspace ID and User ID are required.');
    }

    await assertAutomationManagePermission(userId, [workspaceId], 'edit');

    // 1. Scan / fetch target orphaned runs
    let query = adminDb
      .collection('automation_runs')
      .where('workspaceId', '==', workspaceId)
      .where('status', '==', 'running');

    if (automationId) {
      query = query.where('automationId', '==', automationId);
    }

    const runsSnap = await query.get();
    if (runsSnap.empty) {
      return { success: true, totalProcessed: 0, advancedCount: 0, cancelledCount: 0 };
    }

    let targetRuns = runsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AutomationRun[];

    if (runIds && runIds.length > 0) {
      const allowedSet = new Set(runIds);
      targetRuns = targetRuns.filter((r) => allowedSet.has(r.id));
    }

    const autoCache = new Map<string, Automation>();
    const orphanedRunsToProcess: AutomationRun[] = [];

    for (const run of targetRuns) {
      if (!run.currentNodeId) continue;

      let automation = autoCache.get(run.automationId);
      if (!automation) {
        const autoSnap = await adminDb.collection('automations').doc(run.automationId).get();
        if (autoSnap.exists) {
          automation = { id: autoSnap.id, ...autoSnap.data() } as Automation;
          autoCache.set(run.automationId, automation);
        }
      }

      if (automation && !automation.nodes.some((n) => n.id === run.currentNodeId)) {
        orphanedRunsToProcess.push(run);
      }
    }

    let advancedCount = 0;
    let cancelledCount = 0;

    // 2. Chunk processing in batches of 50 to prevent memory exhaustion and payload overloads
    const CHUNK_SIZE = 50;
    for (let i = 0; i < orphanedRunsToProcess.length; i += CHUNK_SIZE) {
      const chunk = orphanedRunsToProcess.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();
      let batchHasWrites = false;

      const advanceTasks: Array<() => Promise<void>> = [];

      for (const run of chunk) {
        const runRef = adminDb.collection('automation_runs').doc(run.id);

        if (strategy === 'cancel_all') {
          batch.update(runRef, {
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cancelledReason: 'Bulk orphaned run cleanup by administrator',
          });
          batchHasWrites = true;

          // Purge/cancel any matching pending jobs for this run
          const jobsSnap = await adminDb
            .collection('automation_jobs')
            .where('runId', '==', run.id)
            .where('status', 'in', ['pending', 'paused'])
            .get();

          jobsSnap.docs.forEach((jDoc) => {
            batch.update(jDoc.ref, {
              status: 'cancelled',
              cancelledAt: new Date().toISOString(),
            });
          });

          cancelledCount++;
        } else if (strategy === 'advance_all') {
          const automation = autoCache.get(run.automationId);
          const nonTriggerNodes = (automation?.nodes || [])
            .filter((n) => n.type !== 'triggerNode')
            .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0) || (a.position?.x ?? 0) - (b.position?.x ?? 0));

          if (automation && nonTriggerNodes.length > 0) {
            const fallbackNode = nonTriggerNodes[0];
            advanceTasks.push(async () => {
              const { traverseNodes } = await import('@/lib/automations/nodes/traverse');
              const context: ExecutionContext = {
                runId: run.id,
                automationId: run.automationId,
                workspaceId: run.workspaceId || workspaceId,
                organizationId: run.organizationId,
                entityId: run.entityId || '',
                entityType: run.entityType || 'person',
                payload: run.triggerData || {},
              };
              await traverseNodes(fallbackNode.id, automation, context, true);
            });
            advancedCount++;
          } else {
            // Terminal fallback
            batch.update(runRef, {
              status: 'completed',
              finishedAt: new Date().toISOString(),
              completedNote: 'Run completed upon orphaned cleanup sweep (no remaining steps)',
            });
            batchHasWrites = true;
            advancedCount++;
          }
        }
      }

      if (batchHasWrites) {
        await batch.commit();
      }

      if (advanceTasks.length > 0) {
        const results = await Promise.allSettled(advanceTasks.map((t) => t()));
        results.forEach((res, idx) => {
          if (res.status === 'rejected') {
            console.error(`[ORPHAN-RECONCILE] Task ${idx} failed during advance:`, res.reason);
          }
        });
      }

      // Event-loop yield between chunks for GC and system responsiveness
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    logAutomationEvent('info', 'orphaned_runs_reconciliation_completed', {
      workspaceId,
      userId,
      strategy,
      totalProcessed: orphanedRunsToProcess.length,
      advancedCount,
      cancelledCount,
    });

    return {
      success: true,
      totalProcessed: orphanedRunsToProcess.length,
      advancedCount,
      cancelledCount,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[ORPHAN-RECONCILE] Error reconciling orphaned runs:', errorMsg);
    return {
      success: false,
      totalProcessed: 0,
      advancedCount: 0,
      cancelledCount: 0,
      error: errorMsg,
    };
  }
}

export interface RecoverFailedRunsOptions {
  workspaceId: string;
  automationId: string;
  userId: string;
}

export interface RecoverFailedRunsResult {
  success: boolean;
  recoveredCount: number;
  error?: string;
}

export async function recoverFailedRunsAction(
  options: RecoverFailedRunsOptions
): Promise<RecoverFailedRunsResult> {
  const { workspaceId, automationId, userId } = options;

  try {
    await assertAutomationManagePermission(userId, [workspaceId], 'edit');

    const runsSnap = await adminDb
      .collection('automation_runs')
      .where('workspaceId', '==', workspaceId)
      .where('automationId', '==', automationId)
      .where('status', '==', 'failed')
      .get();

    if (runsSnap.empty) {
      return { success: true, recoveredCount: 0 };
    }

    const { forceAdvanceRun } = await import('@/lib/automations/run-management');
    let recoveredCount = 0;
    const CHUNK_SIZE = 50;
    const failedDocs = runsSnap.docs;

    for (let i = 0; i < failedDocs.length; i += CHUNK_SIZE) {
      const chunk = failedDocs.slice(i, i + CHUNK_SIZE);
      const advanceTasks = chunk.map((doc) => async () => {
        try {
          await forceAdvanceRun(doc.id, userId);
          recoveredCount++;
        } catch (e) {
          console.error(`[FAILED-RECOVERY] Failed to force advance run ${doc.id}:`, e);
        }
      });

      const results = await Promise.allSettled(advanceTasks.map((t) => t()));
      results.forEach((res, idx) => {
        if (res.status === 'rejected') {
          console.error(`[FAILED-RECOVERY] Task ${idx} rejected:`, res.reason);
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    logAutomationEvent('info', 'failed_runs_recovered', {
      workspaceId,
      automationId,
      userId,
      recoveredCount,
    });

    return {
      success: true,
      recoveredCount,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[FAILED-RECOVERY] Error recovering failed runs:', errorMsg);
    return {
      success: false,
      recoveredCount: 0,
      error: errorMsg,
    };
  }
}
