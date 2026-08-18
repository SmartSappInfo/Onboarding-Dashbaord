import type { Automation } from './types';

/**
 * ARCHITECTURAL POINTER (Automation Stage Linking Helper):
 * Checks whether a given Automation workflow is linked to a specific pipeline stage.
 * Checks first-class `triggers` array, flow nodes data, and top-level triggerConfig.
 *
 * CAUTION FOR MAINTAINERS:
 * Both DEAL_STAGE_CHANGED and ENTITY_STAGE_CHANGED count as stage-level triggers.
 * Maintains zero runtime exceptions if trigger structures vary.
 *
 * TESTABILITY POINTER:
 * Unit tests should verify matching against both DEAL_STAGE_CHANGED and ENTITY_STAGE_CHANGED.
 */
export function isAutomationLinkedToStage(
  automation: Partial<Automation> | null | undefined,
  pipelineId: string,
  stageId: string
): boolean {
  if (!automation || !pipelineId || !stageId) return false;

  // 1. Check first-class triggers array
  if (Array.isArray(automation.triggers)) {
    for (const trig of automation.triggers) {
      const isStageTrigger = trig.type === 'DEAL_STAGE_CHANGED' || trig.type === 'ENTITY_STAGE_CHANGED';
      if (isStageTrigger && trig.config) {
        const cPipeline = String(trig.config.pipelineId || '');
        const cStage = String(trig.config.stageId || '');
        if (cPipeline === pipelineId && cStage === stageId) {
          return true;
        }
      }
    }
  }

  // 2. Check nodes array data
  if (Array.isArray(automation.nodes)) {
    for (const node of automation.nodes) {
      const nodeData = (node as Record<string, unknown>).data as Record<string, unknown> | undefined;
      if (nodeData) {
        const tType = String(nodeData.triggerType || nodeData.type || '');
        const isStageTrigger = tType === 'DEAL_STAGE_CHANGED' || tType === 'ENTITY_STAGE_CHANGED';
        const config = nodeData.config as Record<string, unknown> | undefined;
        if (isStageTrigger && config) {
          const cPipeline = String(config.pipelineId || '');
          const cStage = String(config.stageId || '');
          if (cPipeline === pipelineId && cStage === stageId) {
            return true;
          }
        }
      }
    }
  }

  // 3. Fallback: check top-level triggerConfig if present
  const topConfig = (automation as Record<string, unknown>).triggerConfig as Record<string, unknown> | undefined;
  if (topConfig) {
    const cPipeline = String(topConfig.pipelineId || '');
    const cStage = String(topConfig.stageId || '');
    if (cPipeline === pipelineId && cStage === stageId) {
      return true;
    }
  }

  return false;
}

/**
 * Builds an O(1) Stage ID -> Automation[] Map for a pipeline's stages.
 * Prevents performance degradation when rendering high-volume Kanban boards.
 */
export function buildStageAutomationsMap(
  automations: Automation[] | undefined | null,
  pipelineId: string,
  stageIds: string[]
): Map<string, Automation[]> {
  const map = new Map<string, Automation[]>();
  stageIds.forEach(id => map.set(id, []));

  if (!automations || !pipelineId) return map;

  for (const auto of automations) {
    if (auto.isArchived) continue;
    for (const stageId of stageIds) {
      if (isAutomationLinkedToStage(auto, pipelineId, stageId)) {
        const list = map.get(stageId) || [];
        list.push(auto);
        map.set(stageId, list);
      }
    }
  }

  return map;
}
