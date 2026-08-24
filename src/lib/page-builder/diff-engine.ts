/**
 * @file src/lib/page-builder/diff-engine.ts
 * @description Fast O(N) Page Structure Diff Engine for SmartSapp AI Experience Builder.
 * Compares two `CampaignPageStructure` documents (original vs AI target structure)
 * and generates structured diff diagnostics for the visual diff viewer and change sets.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - O(N) Map-based lookups by ID (avoids expensive recursive JSON stringification).
 * - Pure function for unit testing and instant rendering on mobile/desktop canvas.
 */

import type {
  CampaignPageStructure,
  PageStructureDiff,
  SectionDiff,
  BlockDiff,
  PageBlock,
  PageSection,
} from '@/lib/types';

/**
 * Computes deep structural diff between original structure and target structure.
 * 
 * TESTABILITY POINTER:
 * Pass identical structures to verify `hasChanges: false`. Pass modified/added/deleted blocks
 * to verify correct counts and diff details.
 */
export function computePageStructureDiff(
  original: CampaignPageStructure,
  target: CampaignPageStructure,
): PageStructureDiff {
  const sectionDiffs: SectionDiff[] = [];
  let addedSectionCount = 0;
  let modifiedSectionCount = 0;
  let deletedSectionCount = 0;
  let addedBlockCount = 0;
  let modifiedBlockCount = 0;
  let deletedBlockCount = 0;

  const origSectionMap = new Map<string, PageSection>(
    (original.sections || []).map((s) => [s.id, s]),
  );
  const targetSectionMap = new Map<string, PageSection>(
    (target.sections || []).map((s) => [s.id, s]),
  );

  // Track deleted sections
  for (const [sId, origSection] of origSectionMap.entries()) {
    if (!targetSectionMap.has(sId)) {
      deletedSectionCount++;
      sectionDiffs.push({
        sectionId: sId,
        changeType: 'deleted',
        blockDiffs: (origSection.blocks || []).map((b) => ({
          blockId: b.id,
          type: b.type,
          changeType: 'deleted',
        })),
      });
    }
  }

  // Track added and modified sections
  for (const [sId, targetSection] of targetSectionMap.entries()) {
    const origSection = origSectionMap.get(sId);

    if (!origSection) {
      // New section
      addedSectionCount++;
      const blockDiffs: BlockDiff[] = (targetSection.blocks || []).map((b) => {
        addedBlockCount++;
        return {
          blockId: b.id,
          type: b.type,
          changeType: 'added',
        };
      });

      sectionDiffs.push({
        sectionId: sId,
        changeType: 'added',
        blockDiffs,
      });
    } else {
      // Existing section — compare blocks
      const blockDiffs = compareBlocks(origSection.blocks || [], targetSection.blocks || []);
      const isModified = blockDiffs.length > 0;

      if (isModified) {
        modifiedSectionCount++;
        blockDiffs.forEach((bd) => {
          if (bd.changeType === 'added') addedBlockCount++;
          if (bd.changeType === 'modified') modifiedBlockCount++;
          if (bd.changeType === 'deleted') deletedBlockCount++;
        });

        sectionDiffs.push({
          sectionId: sId,
          changeType: 'modified',
          blockDiffs,
        });
      }
    }
  }

  const hasChanges =
    addedSectionCount > 0 ||
    modifiedSectionCount > 0 ||
    deletedSectionCount > 0 ||
    addedBlockCount > 0 ||
    modifiedBlockCount > 0 ||
    deletedBlockCount > 0;

  return {
    hasChanges,
    addedSectionCount,
    modifiedSectionCount,
    deletedSectionCount,
    addedBlockCount,
    modifiedBlockCount,
    deletedBlockCount,
    sections: sectionDiffs,
  };
}

/**
 * Compares two block lists O(N) using ID maps.
 */
function compareBlocks(origBlocks: PageBlock[], targetBlocks: PageBlock[]): BlockDiff[] {
  const diffs: BlockDiff[] = [];
  const origMap = new Map<string, PageBlock>(origBlocks.map((b) => [b.id, b]));
  const targetMap = new Map<string, PageBlock>(targetBlocks.map((b) => [b.id, b]));

  // Deleted blocks
  for (const [bId, origBlock] of origMap.entries()) {
    if (!targetMap.has(bId)) {
      diffs.push({
        blockId: bId,
        type: origBlock.type,
        changeType: 'deleted',
      });
    }
  }

  // Added & Modified blocks
  for (const [bId, targetBlock] of targetMap.entries()) {
    const origBlock = origMap.get(bId);

    if (!origBlock) {
      diffs.push({
        blockId: bId,
        type: targetBlock.type,
        changeType: 'added',
      });
    } else {
      const propChanges = compareProps(origBlock.props || {}, targetBlock.props || {});
      if (Object.keys(propChanges).length > 0) {
        diffs.push({
          blockId: bId,
          type: targetBlock.type,
          changeType: 'modified',
          propChanges,
        });
      }
    }
  }

  return diffs;
}

/**
 * Deterministic deep equality check preventing false positives from object key reordering.
 */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, k)) return false;
    if (!isDeepEqual(objA[k], objB[k])) return false;
  }

  return true;
}

/**
 * Compares two props dictionaries and returns key-level diff entries.
 */
function compareProps(
  origProps: Record<string, unknown>,
  targetProps: Record<string, unknown>,
): Record<string, { oldValue: unknown; newValue: unknown }> {
  const changes: Record<string, { oldValue: unknown; newValue: unknown }> = {};
  const allKeys = new Set([...Object.keys(origProps), ...Object.keys(targetProps)]);

  for (const key of allKeys) {
    const oldVal = origProps[key];
    const newVal = targetProps[key];

    if (!isDeepEqual(oldVal, newVal)) {
      changes[key] = { oldValue: oldVal, newValue: newVal };
    }
  }

  return changes;
}
