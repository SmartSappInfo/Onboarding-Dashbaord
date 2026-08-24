/**
 * @file src/lib/page-builder/experiment-engine.ts
 * @description Deterministic Variant Resolver & Experiment Engine for SmartSapp AI Experience Builder.
 * Hashes visitor identity (`visitorId + experimentId`) to select experiment variants deterministically
 * across returning sessions without Cumulative Layout Shift (CLS).
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Pure O(1) mathematical bucket hashing.
 * - Testable utility pure functions.
 */

import type {
  BlockOverride,
  CampaignPageStructure,
  Experiment,
  ExperimentVariant,
  PageBlock,
} from '@/lib/types';

/**
 * Deterministically selects an experiment variant for a visitor.
 * Uses integer modulus bucketing over visitor ID hash.
 * 
 * TESTABILITY POINTER:
 * Pass fixed visitor ID strings and verify that the exact same variant is consistently returned.
 */
export function selectExperimentVariant(
  experiment: Experiment,
  visitorId: string,
): ExperimentVariant {
  if (
    !experiment ||
    experiment.status !== 'running' ||
    !experiment.variants ||
    experiment.variants.length === 0
  ) {
    // Return control or first variant as safe fallback
    const control = experiment?.variants?.find((v) => v.isControl);
    return control || experiment?.variants?.[0] || buildFallbackVariant();
  }

  // 1. Calculate deterministic bucket score (0–99)
  const bucketScore = hashVisitor(`${visitorId}:${experiment.id}`) % 100;

  // 2. Iterate through weighted variant buckets
  let cumulativeWeight = 0;
  for (const variant of experiment.variants) {
    cumulativeWeight += variant.weight;
    if (bucketScore < cumulativeWeight) {
      return variant;
    }
  }

  // Fallback to control if weight sum is less than 100
  return experiment.variants.find((v) => v.isControl) || experiment.variants[0];
}

/**
 * Simple, fast, deterministic string hash algorithm (djb2 variant).
 * Produces a positive 32-bit integer.
 */
export function hashVisitor(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash >>> 0);
}

/**
 * Applies an experiment variant structure patch onto a deep-cloned base CampaignPageStructure.
 */
export function applyVariantStructurePatch(
  baseStructure: CampaignPageStructure,
  variant: ExperimentVariant,
): CampaignPageStructure {
  if (!variant || !variant.structurePatch) {
    return baseStructure;
  }

  const clonedStructure: CampaignPageStructure =
    typeof structuredClone === 'function'
      ? structuredClone(baseStructure)
      : (JSON.parse(JSON.stringify(baseStructure)) as CampaignPageStructure);

  const blockOverrides = variant.structurePatch.blockOverrides || [];
  if (blockOverrides.length > 0) {
    const overrideMap = new Map<string, BlockOverride>(
      blockOverrides.map((o) => [o.blockId, o]),
    );

    clonedStructure.sections = (clonedStructure.sections || []).map((section) => ({
      ...section,
      blocks: applyBlockOverridesToTree(section.blocks || [], overrideMap),
    }));
  }

  return clonedStructure;
}

/**
 * Fallback empty variant used when experiment configuration is empty.
 */
function buildFallbackVariant(): ExperimentVariant {
  return {
    id: 'control-fallback',
    experimentId: 'none',
    name: 'Control Original',
    weight: 100,
    isControl: true,
    structurePatch: {},
    stats: { impressions: 0, conversions: 0, conversionRate: 0 },
  };
}

/**
 * Helper recursively applying block overrides across block tree with max depth guard (maxDepth = 20).
 */
function applyBlockOverridesToTree(
  blocks: PageBlock[],
  overrideMap: Map<string, BlockOverride>,
  depth = 0,
): PageBlock[] {
  if (depth > 20) return blocks;
  const result: PageBlock[] = [];

  for (const block of blocks) {
    const override = overrideMap.get(block.id);

    if (override?.hidden) {
      continue;
    }

    let updatedBlock = block;
    if (override?.propPatch) {
      updatedBlock = {
        ...block,
        props: {
          ...block.props,
          ...override.propPatch,
        },
      };
    }

    if (updatedBlock.blocks && updatedBlock.blocks.length > 0) {
      updatedBlock = {
        ...updatedBlock,
        blocks: applyBlockOverridesToTree(updatedBlock.blocks, overrideMap, depth + 1),
      };
    }

    result.push(updatedBlock);
  }

  return result;
}
