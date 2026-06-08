import type { Automation } from '../../types';
import { evaluateConditionNode } from '../../automation-condition';
import { processActionNode } from '../actions';
import type { ExecutionContext } from '../execution-types';
import { handleDelayNode } from './delay';
import { evaluateTagConditionNode, processTagActionNode } from './tag-nodes';
import { adminDb } from '../../firebase-admin';
import { logStepExecution } from '../step-logger';
import { fetchLiveEntityTags, nodeChecksTags } from '../tag-enrichment';

export async function traverseNodes(
  nodeId: string,
  automation: Automation,
  context: ExecutionContext
): Promise<void> {
  const currentNode = automation.nodes.find((n) => n.id === nodeId);
  if (!currentNode) return;

  // Log trigger node execution or delay node resumption
  if (currentNode.type === 'triggerNode') {
    logStepExecution(context.runId, {
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      nodeLabel: currentNode.data?.label || 'Trigger',
      status: 'success',
      executedAt: new Date().toISOString(),
    });
  } else if (currentNode.type === 'delayNode') {
    // Visited at start of traversal during resumption
    logStepExecution(context.runId, {
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      nodeLabel: currentNode.data?.label || 'Delay',
      status: 'success',
      executedAt: new Date().toISOString(),
      metadata: {
        resumedAt: new Date().toISOString(),
      },
    });
  }

  let outgoingEdges = automation.edges.filter((e) => e.source === nodeId);

  if (currentNode.type === 'conditionNode') {
    // Enrich payload with live Firestore tags when the node checks tag fields.
    // This bypasses the contact-adapter cache so we always see the entity's
    // current tag state — not a snapshot from earlier in the same run.
    let evalPayload = context.payload;
    if (context.entityId && context.workspaceId && nodeChecksTags(currentNode)) {
      const liveTags = await fetchLiveEntityTags(context.entityId, context.workspaceId);
      // __liveTags (double-underscore) signals internal enrichment, never collides with user data
      evalPayload = { ...context.payload, __liveTags: liveTags };
    }

    const isTrue = await evaluateConditionNode(
      currentNode,
      evalPayload,
      async (audienceId) => {
        const snap = await adminDb.collection('message_audiences').doc(audienceId).get();
        return snap.exists ? snap.data() : null;
      },
      async (entityId, automationId, operator) => {
        if (operator === 'currently_in') {
          const snap = await adminDb.collection('automation_runs')
            .where('entityId', '==', entityId)
            .where('automationId', '==', automationId)
            .where('status', '==', 'running')
            .limit(1)
            .get();
          return !snap.empty;
        }
        if (operator === 'has_entered') {
          const snap = await adminDb.collection('automation_runs')
            .where('entityId', '==', entityId)
            .where('automationId', '==', automationId)
            .limit(1)
            .get();
          return !snap.empty;
        }
        if (operator === 'has_completed') {
          const snap = await adminDb.collection('automation_runs')
            .where('entityId', '==', entityId)
            .where('automationId', '==', automationId)
            .where('status', '==', 'completed')
            .limit(1)
            .get();
          return !snap.empty;
        }
        if (operator === 'not_entered') {
          const snap = await adminDb.collection('automation_runs')
            .where('entityId', '==', entityId)
            .where('automationId', '==', automationId)
            .limit(1)
            .get();
          return snap.empty;
        }
        return false;
      }
    );
    const targetHandle = isTrue ? 'true' : 'false';
    outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle === targetHandle);

    logStepExecution(context.runId, {
      nodeId: currentNode.id,
      nodeType: 'conditionNode',
      nodeLabel: currentNode.data?.label || 'Condition',
      status: 'success',
      executedAt: new Date().toISOString(),
      metadata: { evaluation: targetHandle as 'true' | 'false' },
    });
  } else if (currentNode.type === 'tagConditionNode') {
    const isTrue = await evaluateTagConditionNode(currentNode, context);
    const targetHandle = isTrue ? 'true' : 'false';
    outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle === targetHandle);

    logStepExecution(context.runId, {
      nodeId: currentNode.id,
      nodeType: 'tagConditionNode',
      nodeLabel: currentNode.data?.label || 'Tag Condition',
      status: 'success',
      executedAt: new Date().toISOString(),
      metadata: { evaluation: targetHandle as 'true' | 'false' },
    });
  }

  for (const edge of outgoingEdges) {
    const nextNode = automation.nodes.find((n) => n.id === edge.target);
    if (!nextNode) continue;

    const stepStart = Date.now();

    try {
      if (nextNode.type === 'actionNode') {
        await processActionNode(nextNode, context);
        logStepExecution(context.runId, {
          nodeId: nextNode.id,
          nodeType: 'actionNode',
          nodeLabel: nextNode.data?.label || 'Action',
          status: 'success',
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - stepStart,
          metadata: { actionType: nextNode.data?.actionType },
        });
      } else if (nextNode.type === 'tagActionNode') {
        await processTagActionNode(nextNode, context);
        logStepExecution(context.runId, {
          nodeId: nextNode.id,
          nodeType: 'tagActionNode',
          nodeLabel: nextNode.data?.label || 'Tag Action',
          status: 'success',
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - stepStart,
          metadata: { actionType: nextNode.data?.action },
        });
      } else if (nextNode.type === 'delayNode') {
        const { value, unit } = nextNode.data?.config || { value: 5, unit: 'Minutes' };
        const now = new Date();
        const executeAt = new Date(now);
        if (unit === 'Minutes') executeAt.setMinutes(executeAt.getMinutes() + (value || 5));
        else if (unit === 'Hours') executeAt.setHours(executeAt.getHours() + (value || 1));
        else if (unit === 'Days') executeAt.setDate(executeAt.getDate() + (value || 1));
        else if (unit === 'Weeks') executeAt.setDate(executeAt.getDate() + (value || 1) * 7);

        logStepExecution(context.runId, {
          nodeId: nextNode.id,
          nodeType: 'delayNode',
          nodeLabel: nextNode.data?.label || 'Delay',
          status: 'waiting',
          executedAt: now.toISOString(),
          metadata: { delayUntil: executeAt.toISOString() },
        });

        await handleDelayNode(nextNode, context);
        return;
      }

      await traverseNodes(nextNode.id, automation, context);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const label = nextNode.data?.label || nextNode.id;
      logStepExecution(context.runId, {
        nodeId: nextNode.id,
        nodeType: nextNode.type || 'unknown',
        nodeLabel: label,
        status: 'failed',
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - stepStart,
        error: message,
      });
      throw new Error(`Node [${label}] failed: ${message}`);
    }
  }
}
