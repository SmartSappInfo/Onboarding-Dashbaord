/**
 * @file src/lib/page-builder/page-agent.ts
 * @description AI Page Agent Engine (`PageAgent`) for SmartSapp AI Experience Builder.
 * Assembles rich page context (goal, structure, tags, variables, theme, performance stats),
 * executes structured LLM tool mutations, validates target structures via Phase 1 validator,
 * and produces immutable `AIChangeSet` documents.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - All AI target structures strictly validated via `validatePageStructure()`.
 * - Draft-only scope (never mutates live published versions).
 */

import type {
  AIChangeSet,
  CampaignPageStructure,
  PageAgentContext,
  PageAgentToolCall,
  PageBlock,
  PageSection,
} from '@/lib/types';
import { validatePageStructure } from './schema';
import { computePageStructureDiff } from './diff-engine';

/**
 * Assembles a structured PageAgentContext payload for LLM prompt context injection.
 */
export function assemblePageContext(
  pageId: string,
  pageGoal: PageAgentContext['pageGoal'],
  currentStructure: CampaignPageStructure,
  workspaceContactTags?: Array<{ id: string; name: string }>,
  availableVariables?: string[],
  statsSummary?: PageAgentContext['statsSummary'],
): PageAgentContext {
  return {
    pageId,
    pageGoal,
    currentStructure,
    workspaceContactTags,
    availableVariables,
    statsSummary,
  };
}

/**
 * Processes a sequence of structured tool calls against a base page structure,
 * validates the resulting target structure using Phase 1 schema validator,
 * and returns an immutable AIChangeSet.
 * 
 * TESTABILITY POINTER:
 * Pass tool calls (e.g. `addSection` or `updateBlockProps`) and verify that
 * `changeSet.targetStructure` is valid and `changeSet.diff` records additions/modifications.
 */
export function processAgentMutation(
  prompt: string,
  context: PageAgentContext,
  toolCalls: PageAgentToolCall[],
  organizationId: string,
  workspaceIds: string[],
  userId: string,
): { success: boolean; changeSet?: AIChangeSet; errors?: string[] } {
  let targetStructure: CampaignPageStructure =
    typeof structuredClone === 'function'
      ? structuredClone(context.currentStructure)
      : (JSON.parse(JSON.stringify(context.currentStructure)) as CampaignPageStructure);

  for (const call of toolCalls) {
    targetStructure = applyToolMutation(targetStructure, call);
  }

  // Phase 1 Schema Validation Boundary (Risk R1 Safeguard)
  const validation = validatePageStructure(targetStructure);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors.map((e) => `${e.path}: ${e.message}`),
    };
  }

  const sanitizedTarget = validation.sanitizedStructure;
  const diff = computePageStructureDiff(context.currentStructure, sanitizedTarget);

  const changeSet: AIChangeSet = {
    id: `cs-${context.pageId}-${Math.random().toString(36).substring(2, 9)}`,
    pageId: context.pageId,
    organizationId,
    workspaceIds,
    prompt,
    status: 'draft',
    diff,
    targetStructure: sanitizedTarget,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };

  return {
    success: true,
    changeSet,
  };
}

/**
 * Executes a single tool mutation against a page structure.
 */
function applyToolMutation(
  structure: CampaignPageStructure,
  toolCall: PageAgentToolCall,
): CampaignPageStructure {
  const nextSections = [...(structure.sections || [])];

  switch (toolCall.toolName) {
    case 'addSection': {
      const { heading, background, blocks } = toolCall.arguments as {
        heading?: string;
        background?: string;
        blocks?: PageBlock[];
      };
      const newSection: PageSection = {
        id: `sec-${Math.random().toString(36).substring(2, 9)}`,
        type: 'section',
        props: { heading, background },
        blocks: blocks || [],
      };
      nextSections.push(newSection);
      break;
    }

    case 'removeSection': {
      const { sectionId } = toolCall.arguments as { sectionId: string };
      const idx = nextSections.findIndex((s) => s.id === sectionId);
      if (idx !== -1) {
        nextSections.splice(idx, 1);
      }
      break;
    }

    case 'reorderSections': {
      const { sectionIds } = toolCall.arguments as { sectionIds: string[] };
      const sectionMap = new Map(nextSections.map((s) => [s.id, s]));
      const reordered: PageSection[] = [];
      for (const sId of sectionIds) {
        const found = sectionMap.get(sId);
        if (found) {
          reordered.push(found);
          sectionMap.delete(sId);
        }
      }
      // Keep remaining
      nextSections.length = 0;
      nextSections.push(...reordered, ...Array.from(sectionMap.values()));
      break;
    }

    case 'updateBlockProps': {
      const { blockId, propPatch } = toolCall.arguments as {
        blockId: string;
        propPatch: Record<string, unknown>;
      };
      updateBlockInSections(nextSections, blockId, (block) => ({
        ...block,
        props: {
          ...block.props,
          ...propPatch,
        },
      }));
      break;
    }

    case 'replaceBlock': {
      const { blockId, newBlock } = toolCall.arguments as {
        blockId: string;
        newBlock: PageBlock;
      };
      updateBlockInSections(nextSections, blockId, () => newBlock);
      break;
    }

    default:
      break;
  }

  return {
    ...structure,
    sections: nextSections,
  };
}

/** Recursively finds and updates a block inside sections with arbitrary nesting. */
function updateBlockInSections(
  sections: PageSection[],
  blockId: string,
  updater: (b: PageBlock) => PageBlock,
): boolean {
  for (const sec of sections) {
    if (sec.blocks && sec.blocks.length > 0) {
      if (updateBlockInArray(sec.blocks, blockId, updater)) {
        return true;
      }
    }
  }
  return false;
}

function updateBlockInArray(
  blocks: PageBlock[],
  blockId: string,
  updater: (b: PageBlock) => PageBlock,
  depth = 0,
): boolean {
  if (depth > 20) return false;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === blockId) {
      blocks[i] = updater(blocks[i]);
      return true;
    }
    const children = blocks[i].blocks;
    if (Array.isArray(children) && children.length > 0) {
      if (updateBlockInArray(children, blockId, updater, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}
