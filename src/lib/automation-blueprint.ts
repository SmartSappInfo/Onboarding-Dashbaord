import type { Automation, AutomationTrigger, AutomationTriggerDef } from './types';

type BlueprintNode = {
  id: string;
  type: string;
  data?: {
    trigger?: AutomationTrigger;
    triggerType?: AutomationTrigger;
    triggers?: AutomationTriggerDef[];
    config?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

/**
 * Reads trigger defs from the canvas triggerNode.
 * Used as a fallback when `data.triggers` is not yet set (e.g. canvas-edited node).
 */
export function deriveTriggerDefsFromNodes(
  nodes: BlueprintNode[] | undefined
): AutomationTriggerDef[] {
  if (!nodes?.length) return [];

  const triggerNode = nodes.find((n) => n.type === 'triggerNode');
  if (!triggerNode?.data) return [];

  // If the node already carries the full triggers array, use it directly
  if (triggerNode.data.triggers?.length) {
    return triggerNode.data.triggers;
  }

  // Fall back to legacy single-trigger fields
  const type = triggerNode.data.trigger ?? triggerNode.data.triggerType;
  if (!type) return [];

  return [
    {
      id: 'trigger_0',
      type,
      config: (triggerNode.data.config as Record<string, unknown>) ?? {},
    },
  ];
}

/**
 * Normalizes blueprint payload before Firestore write:
 * - Derives `triggers[]` from explicit array or canvas triggerNode
 * - Builds `triggerTypes[]` as a denormalized flat array for Firestore array-contains
 * - Syncs primary trigger + full triggers array into the canvas triggerNode data
 */
export function serializeBlueprint(data: Partial<Automation>): Partial<Automation> {
  const nodes = data.nodes as BlueprintNode[] | undefined;

  // `data.triggers` (from MultiTriggerPanel) is the source of truth when present
  const triggers: AutomationTriggerDef[] = data.triggers?.length
    ? data.triggers
    : deriveTriggerDefsFromNodes(nodes);

  // Deduplicated flat array for Firestore array-contains indexing
  const triggerTypes: string[] = [...new Set(triggers.map((t) => t.type))];

  // Sync the primary trigger type + full triggers array into the canvas triggerNode
  // so the visual node always reflects current state
  const primaryType = triggers[0]?.type;
  const syncedNodes = nodes?.map((node) => {
    if (node.type !== 'triggerNode') return node;
    return {
      ...node,
      data: {
        ...node.data,
        triggers,
        ...(primaryType ? { trigger: primaryType, triggerType: primaryType } : {}),
      },
    };
  });

  return {
    ...data,
    triggers,
    triggerTypes,
    ...(syncedNodes ? { nodes: syncedNodes as Automation['nodes'] } : {}),
  };
}
