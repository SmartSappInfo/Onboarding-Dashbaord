import type { Automation, AutomationTrigger } from './types';

type BlueprintNode = {
  id: string;
  type: string;
  data?: {
    trigger?: AutomationTrigger;
    triggerType?: AutomationTrigger;
    [key: string]: unknown;
  };
};

/**
 * Reads the canonical trigger from the trigger node (single source in the graph).
 */
export function deriveTriggerFromNodes(
  nodes: BlueprintNode[] | undefined
): AutomationTrigger | undefined {
  if (!nodes?.length) return undefined;

  const triggerNode = nodes.find((n) => n.type === 'triggerNode');
  if (!triggerNode?.data) return undefined;

  return triggerNode.data.trigger ?? triggerNode.data.triggerType;
}

/**
 * Normalizes blueprint payload before Firestore write:
 * - Sets top-level `trigger` from trigger node
 * - Keeps trigger node `data.trigger` in sync
 */
export function serializeBlueprint(data: Partial<Automation>): Partial<Automation> {
  const nodes = data.nodes as BlueprintNode[] | undefined;
  const derivedTrigger = deriveTriggerFromNodes(nodes) ?? data.trigger;

  if (!nodes?.length) {
    return { ...data, ...(derivedTrigger ? { trigger: derivedTrigger } : {}) };
  }

  const syncedNodes = nodes.map((node) => {
    if (node.type !== 'triggerNode' || !derivedTrigger) return node;
    return {
      ...node,
      data: {
        ...node.data,
        trigger: derivedTrigger,
        triggerType: derivedTrigger,
      },
    };
  });

  return {
    ...data,
    nodes: syncedNodes as Automation['nodes'],
    ...(derivedTrigger ? { trigger: derivedTrigger } : {}),
  };
}
