import type { Automation } from '../../types';
import { evaluateConditionNode } from '../../automation-condition';
import { processActionNode } from '../actions';
import type { ExecutionContext } from '../execution-types';
import { handleDelayNode } from './delay';
import { evaluateTagConditionNode, processTagActionNode } from './tag-nodes';
import { adminDb } from '../../firebase-admin';

export async function traverseNodes(
  nodeId: string,
  automation: Automation,
  context: ExecutionContext
): Promise<void> {
  const currentNode = automation.nodes.find((n) => n.id === nodeId);
  if (!currentNode) return;

  let outgoingEdges = automation.edges.filter((e) => e.source === nodeId);

  if (currentNode.type === 'conditionNode') {
    const isTrue = await evaluateConditionNode(currentNode, context.payload, async (audienceId) => {
      const snap = await adminDb.collection('message_audiences').doc(audienceId).get();
      return snap.exists ? snap.data() : null;
    });
    const targetHandle = isTrue ? 'true' : 'false';
    outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle === targetHandle);
  } else if (currentNode.type === 'tagConditionNode') {
    const isTrue = await evaluateTagConditionNode(currentNode, context);
    const targetHandle = isTrue ? 'true' : 'false';
    outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle === targetHandle);
  }

  for (const edge of outgoingEdges) {
    const nextNode = automation.nodes.find((n) => n.id === edge.target);
    if (!nextNode) continue;

    try {
      if (nextNode.type === 'actionNode') {
        await processActionNode(nextNode, context);
      } else if (nextNode.type === 'tagActionNode') {
        await processTagActionNode(nextNode, context);
      } else if (nextNode.type === 'delayNode') {
        await handleDelayNode(nextNode, context);
        return;
      }

      await traverseNodes(nextNode.id, automation, context);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const label = nextNode.data?.label || nextNode.id;
      throw new Error(`Node [${label}] failed: ${message}`);
    }
  }
}
