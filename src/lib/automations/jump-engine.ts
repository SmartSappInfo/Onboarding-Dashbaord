import { adminDb } from '../firebase-admin';
import { evaluateConditionNode } from '../automation-condition';
import { loadAutomationForAuth } from '../automation-permissions';
import { traverseNodes } from './nodes/traverse';
import { logStepExecution } from './step-logger';
import { cancelDelayTask } from '../gcp-tasks-client';
import type { EntityType } from '../types';

interface GoalConditionNode {
  id: string;
  type: 'jumpToNode' | string;
  data: {
    label?: string;
    config?: {
      groups?: Record<string, unknown>[];
      relation?: 'and' | 'or';
      jumpFromAnywhere?: boolean;
      sequentialBehavior?: 'wait' | 'proceed' | 'exit';
    };
  };
}

/**
 * Sweeps all active automation runs for a given contact, checks if they meet the
 * conditions of any 'jumpToNode' milestone steps in those automations, and executes
 * jumps (teleportation) accordingly.
 *
 * Avoids any use of 'any' or 'any[]' to satisfy type-safety rules.
 */
export async function evaluateContactJumps(entityId: string, workspaceId: string): Promise<void> {
  if (!entityId || !workspaceId) return;

  const activeRunsSnap = await adminDb.collection('automation_runs')
    .where('entityId', '==', entityId)
    .where('status', '==', 'running')
    .get();

  if (activeRunsSnap.empty) return;

  for (const runDoc of activeRunsSnap.docs) {
    const runData = runDoc.data();
    const automationId = runData.automationId as string;
    const runId = runDoc.id;

    if (!automationId) continue;

    // Load automation flow definition
    const automation = await loadAutomationForAuth(automationId);
    if (!automation || !automation.isActive || !automation.nodes) continue;

    // Enforce recursion cap to prevent infinite loop of jumps
    const currentChainDepth = (runData.chainDepth as number) || 0;
    if (currentChainDepth >= 5) {
      console.warn(`>>> [JUMP:ENGINE] Recursion depth limit reached (>= 5) for run ${runId}. Halting teleportation.`);
      continue;
    }

    // Find all Jump To nodes in the flow
    const jumpNodes = (automation.nodes as unknown as GoalConditionNode[]).filter(
      (n) => n.type === 'jumpToNode'
    );

    for (const jumpNode of jumpNodes) {
      // 1. Skip if the contact is already parked exactly at this Jump To node
      if (runData.currentNodeId === jumpNode.id) continue;

      // 2. Skip if jumpFromAnywhere is explicitly disabled
      if (jumpNode.data?.config?.jumpFromAnywhere === false) continue;

      // 3. Evaluate the goal conditions for the contact using live tags/fields payload
      const payload = (runData.payload as Record<string, unknown>) || {};

      const isTrue = await evaluateConditionNode(
        jumpNode as unknown as Parameters<typeof evaluateConditionNode>[0],
        payload,
        async (audienceId: string) => {
          const snap = await adminDb.collection('message_audiences').doc(audienceId).get();
          return snap.exists ? snap.data() : null;
        },
        async (eId: string, aId: string, operator: string) => {
          if (operator === 'currently_in') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .where('status', '==', 'running')
              .limit(1)
              .get();
            return !snap.empty;
          }
          if (operator === 'has_entered') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .limit(1)
              .get();
            return !snap.empty;
          }
          if (operator === 'has_completed') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .where('status', '==', 'completed')
              .limit(1)
              .get();
            return !snap.empty;
          }
          if (operator === 'not_entered') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .limit(1)
              .get();
            return snap.empty;
          }
          return false;
        }
      );

      if (isTrue) {
        // Goal achieved! Teleport the contact to this node
        console.log(`>>> [JUMP:ENGINE] Contact ${entityId} met conditions for goal node ${jumpNode.id} in run ${runId}`);

        // A. Find and cancel all pending waiting delay jobs or resend check jobs for this run
        const pendingJobsSnap = await adminDb.collection('automation_jobs')
          .where('runId', '==', runId)
          .where('status', '==', 'pending')
          .get();

        const batch = adminDb.batch();

        for (const doc of pendingJobsSnap.docs) {
          const jobData = doc.data();
          const targetNodeId = jobData.targetNodeId as string;

          batch.update(doc.ref, { 
            status: 'cancelled', 
            cancelledAt: new Date().toISOString(),
            reason: `Teleported to goal milestone node: ${jumpNode.id}` 
          });

          if (targetNodeId) {
            // Actively cancel task in GCP Queue / local mock queue
            await cancelDelayTask(runId, targetNodeId).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(`[JUMP:ENGINE] Non-fatal failure cancelling GCP task for run ${runId} node ${targetNodeId}:`, msg);
            });
          }
        }

        // B. Update the run document's current step pointer
        const jumpLabel = jumpNode.data?.label || 'Jump To Milestone';
        batch.update(runDoc.ref, {
          currentNodeId: jumpNode.id,
          currentNodeLabel: jumpLabel,
          chainDepth: currentChainDepth + 1,
          updatedAt: new Date().toISOString()
        });

        await batch.commit();

        // C. Log the success milestone step
        logStepExecution(runId, {
          nodeId: jumpNode.id,
          nodeType: 'jumpToNode',
          nodeLabel: jumpLabel,
          status: 'success',
          executedAt: new Date().toISOString(),
          metadata: { teleported: true, conditionMet: true },
        });

        // D. Traverse nodes downstream starting from this milestone node
        const context = {
          entityId,
          entityType: (runData.entityType as EntityType) || 'institution',
          workspaceId,
          payload,
          automationId,
          runId,
          chainDepth: ((runData.chainDepth as number) || 0) + 1,
        };

        await traverseNodes(jumpNode.id, automation, context);

        // Terminate after first jump match in the loop to avoid multiple concurrent teleportations
        break;
      }
    }
  }
}
