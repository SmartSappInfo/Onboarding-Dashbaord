import { adminDb } from '../firebase-admin';
import type { Automation, AutomationJob } from '../types';
import type { ExecutionContext } from './execution-types';
import { traverseNodes } from './nodes/traverse';
import { logAutomationEvent } from '../automation-log';
import { assertAutomationUserId, assertAutomationManagePermission } from '../automation-permissions';

export interface HealResult {
  success: boolean;
  totalFound: number;
  healedCount: number;
  completedRunsCount: number;
  failedCount: number;
  errors: string[];
}

const ACTION_NODE_TYPES = new Set([
  'actionNode',
  'tagActionNode',
]);

const ACTION_TYPES = new Set([
  'SEND_MESSAGE',
  'SEND_EMAIL',
  'SEND_SMS',
  'SEND_WHATSAPP',
  'INTERNAL_NOTIFICATION',
  'IN_APP_NOTIFICATION',
  'SEND_WEBHOOK',
  'TRIGGER_WEBHOOK',
  'ADD_TO_CAMPAIGN',
]);

/**
 * Fetch, Enrich & Restore Protocol:
 * Finds all contacts currently held/stranded at action/messaging nodes in automation_jobs or automation_runs,
 * resolves their downstream outgoing target nodes, and advances them cleanly without re-sending messages.
 */
export async function healStrandedMessageContacts(
  workspaceId?: string,
  userId?: string
): Promise<HealResult> {
  const result: HealResult = {
    success: true,
    totalFound: 0,
    healedCount: 0,
    completedRunsCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    if (userId) {
      assertAutomationUserId(userId);
      if (workspaceId) {
        await assertAutomationManagePermission(userId, [workspaceId], 'edit');
      }
    }

    // Cache loaded automation blueprints in memory during sweep to minimize Firestore reads
    const automationCache = new Map<string, Automation>();

    async function getAutomation(autoId: string): Promise<Automation | null> {
      if (automationCache.has(autoId)) {
        return automationCache.get(autoId)!;
      }
      const snap = await adminDb.collection('automations').doc(autoId).get();
      if (!snap.exists) return null;
      const auto = { id: snap.id, ...snap.data() } as Automation;
      automationCache.set(autoId, auto);
      return auto;
    }

    // 1. Query pending automation_jobs that are parked on action nodes
    let jobsQuery: FirebaseFirestore.Query = adminDb
      .collection('automation_jobs')
      .where('status', '==', 'pending');

    if (workspaceId) {
      jobsQuery = jobsQuery.where('workspaceId', '==', workspaceId);
    }

    const jobsSnap = await jobsQuery.limit(500).get();
    const strandedJobs: AutomationJob[] = [];

    for (const doc of jobsSnap.docs) {
      const job = { id: doc.id, ...doc.data() } as AutomationJob;
      const automation = await getAutomation(job.automationId);
      if (!automation) continue;

      const targetId = job.targetNodeId;
      const sourceId = job.sourceNodeId;
      const isResendCheck = targetId === '__resend_check__';

      const checkNodeId = isResendCheck ? (sourceId || targetId) : (targetId || sourceId);
      const targetNode = automation.nodes?.find((n) => n.id === checkNodeId);

      const isActionNode =
        isResendCheck ||
        (targetNode && ACTION_NODE_TYPES.has(targetNode.type || '')) ||
        (targetNode?.data?.actionType && ACTION_TYPES.has(String(targetNode.data.actionType).toUpperCase()));

      if (isActionNode) {
        strandedJobs.push(job);
      }
    }

    result.totalFound = strandedJobs.length;

    if (strandedJobs.length === 0) {
      return result;
    }

    // 2. Process in chunks of 50 to prevent memory spikes & socket overloads
    const chunkSize = 50;
    for (let i = 0; i < strandedJobs.length; i += chunkSize) {
      const chunk = strandedJobs.slice(i, i + chunkSize);

      for (const job of chunk) {
        try {
          // Transactional claim to prevent double-advancing race conditions
          const claimed = await adminDb.runTransaction(async (transaction) => {
            const jobRef = adminDb.collection('automation_jobs').doc(job.id);
            const freshSnap = await transaction.get(jobRef);
            if (!freshSnap.exists || freshSnap.data()?.status !== 'pending') {
              return false;
            }
            transaction.update(jobRef, {
              status: 'migrated',
              migratedAt: new Date().toISOString(),
              migrationNote: 'Advanced via Fetch Enrich & Restore protocol for non-blocking action traversal',
            });
            return true;
          });

          if (!claimed) continue;

          const automation = await getAutomation(job.automationId);
          if (!automation) {
            result.failedCount++;
            continue;
          }

          const isResendCheck = job.targetNodeId === '__resend_check__';
          const strandedNodeId = isResendCheck ? job.sourceNodeId! : (job.targetNodeId || job.sourceNodeId!);
          const currentNode = automation.nodes?.find((n) => n.id === strandedNodeId);

          if (!currentNode) {
            result.failedCount++;
            continue;
          }

          // Resolve context
          const payload = (job.payload || {}) as Record<string, unknown>;
          const context: ExecutionContext = {
            entityId: (payload.entityId as string) || undefined,
            entityType: (payload.entityType as ExecutionContext['entityType']) || 'contact',
            workspaceId: job.workspaceId,
            automationId: job.automationId,
            runId: job.runId,
            payload,
          };

          // Find outgoing target edges
          const outgoingEdges = (automation.edges || []).filter((e) => e.source === strandedNodeId);

          if (outgoingEdges.length > 0) {
            // Traverse downstream targets
            for (const edge of outgoingEdges) {
              await traverseNodes(edge.target, automation, context);
            }
            result.healedCount++;
          } else {
            // Action node was terminal — complete the run cleanly
            if (job.runId) {
              const runRef = adminDb.collection('automation_runs').doc(job.runId);
              const runSnap = await runRef.get();
              if (runSnap.exists && runSnap.data()?.status === 'running') {
                await runRef.update({
                  status: 'completed',
                  finishedAt: new Date().toISOString(),
                  completedNote: 'Completed after final action step via Fetch Enrich & Restore protocol',
                });
                result.completedRunsCount++;
              }
            }
            result.healedCount++;
          }
        } catch (jobErr: unknown) {
          result.failedCount++;
          const msg = jobErr instanceof Error ? jobErr.message : String(jobErr);
          result.errors.push(`Job ${job.id}: ${msg}`);
          console.error(`[HEALING-PROTOCOL] Failed to heal job ${job.id}:`, jobErr);
        }
      }

      // Yield macro-task between chunks
      await new Promise((res) => setTimeout(res, 10));
    }

    logAutomationEvent('info', 'fetch_enrich_restore_completed', {
      workspaceId: workspaceId || 'global',
      totalFound: result.totalFound,
      healedCount: result.healedCount,
      completedRunsCount: result.completedRunsCount,
      failedCount: result.failedCount,
    });

  } catch (err: unknown) {
    result.success = false;
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error('[HEALING-PROTOCOL] Fatal error during healing sweep:', err);
  }

  return result;
}
