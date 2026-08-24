/**
 * @file src/lib/page-builder/personalization-engine.ts
 * @description Runtime Personalization & Experience Resolution Engine for SmartSapp AI Experience Builder.
 * Evaluates visitor attributes (tags, UTM tags, lifecycle stage, device type) against active `ExperienceRule` set in priority order,
 * applying block hiding, prop patches, and theme overrides without Cumulative Layout Shift (CLS).
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Early-exit O(N) evaluation for high visitor load performance.
 * - Pure function for fast SSR/edge resolution and unit testability.
 */

import type {
  Audience,
  AudienceCriterion,
  BlockOverride,
  CampaignPageStructure,
  ExperienceRule,
  PageBlock,
  PageSection,
  ResolvedPageExperience,
  VisitorContext,
} from '@/lib/types';

/**
 * Evaluates active experience rules against visitor context and returns the resolved page experience.
 * First matching enabled rule by priority integer wins.
 * 
 * TESTABILITY POINTER:
 * Pass matching and non-matching visitor contexts to verify priority resolution order and block override application.
 */
export function resolvePageExperience(
  baseStructure: CampaignPageStructure,
  visitorContext: VisitorContext,
  experienceRules: ExperienceRule[],
  audiencesMap: Map<string, Audience>,
): ResolvedPageExperience {
  if (!experienceRules || experienceRules.length === 0) {
    return {
      structure: baseStructure,
      appliedOverrides: [],
    };
  }

  // Sort rules strictly by priority integer ascending (1 = highest priority), with deterministic tie-breaker
  const enabledRules = experienceRules
    .filter((r) => r.isEnabled)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  let matchedRule: ExperienceRule | null = null;

  for (const rule of enabledRules) {
    const audience = audiencesMap.get(rule.audienceId);
    if (!audience) continue;

    if (evaluateAudienceCriteria(audience.criteria, visitorContext)) {
      matchedRule = rule;
      break;
    }
  }

  if (!matchedRule) {
    return {
      structure: baseStructure,
      appliedOverrides: [],
    };
  }

  // Apply matched experience rule overrides onto deep-cloned base structure
  const clonedStructure: CampaignPageStructure =
    typeof structuredClone === 'function'
      ? structuredClone(baseStructure)
      : (JSON.parse(JSON.stringify(baseStructure)) as CampaignPageStructure);

  const appliedOverrides = matchedRule.overrides.blockOverrides || [];
  const overrideMap = new Map<string, BlockOverride>(
    appliedOverrides.map((o) => [o.blockId, o]),
  );

  // Apply block overrides across all sections
  clonedStructure.sections = (clonedStructure.sections || []).map((section) => ({
    ...section,
    blocks: applyBlockOverridesToTree(section.blocks || [], overrideMap),
  }));

  // Apply optional design tokens theme override if present
  if (matchedRule.overrides.themeOverride && clonedStructure.designSystem) {
    clonedStructure.designSystem = {
      ...clonedStructure.designSystem,
      tokens: {
        ...clonedStructure.designSystem.tokens,
        colors: {
          ...clonedStructure.designSystem.tokens.colors,
          ...(matchedRule.overrides.themeOverride.colors || {}),
        },
      },
    };
  }

  return {
    activeExperienceRuleId: matchedRule.id,
    activeExperienceName: matchedRule.name,
    structure: clonedStructure,
    appliedOverrides,
  };
}

/**
 * Evaluates whether all criteria in an audience match the given visitor context (AND logic).
 */
export function evaluateAudienceCriteria(
  criteria: AudienceCriterion[],
  context: VisitorContext,
): boolean {
  if (!criteria || criteria.length === 0) return true;

  return criteria.every((criterion) => evaluateSingleCriterion(criterion, context));
}

/**
 * Evaluates a single AudienceCriterion against visitor attributes.
 */
function evaluateSingleCriterion(
  criterion: AudienceCriterion,
  context: VisitorContext,
): boolean {
  const actualValue = extractVisitorAttribute(criterion.field, context);

  switch (criterion.operator) {
    case 'has_tag': {
      const tags = context.contactTags || [];
      return tags.includes(String(criterion.value));
    }

    case 'equals':
      return String(actualValue).toLowerCase() === String(criterion.value).toLowerCase();

    case 'contains':
      return String(actualValue)
        .toLowerCase()
        .includes(String(criterion.value).toLowerCase());

    case 'in': {
      if (Array.isArray(criterion.value)) {
        return criterion.value.some(
          (val) => String(val).toLowerCase() === String(actualValue).toLowerCase(),
        );
      }
      return false;
    }

    case 'greater_than':
      return Number(actualValue) > Number(criterion.value);

    case 'less_than':
      return Number(actualValue) < Number(criterion.value);

    default:
      return false;
  }
}

/**
 * Extracts a nested visitor attribute value by field path (e.g. 'contact.tags', 'utm.utm_source', 'visitor.device').
 */
function extractVisitorAttribute(field: string, context: VisitorContext): unknown {
  switch (field) {
    case 'contact.tags':
      return context.contactTags || [];
    case 'contact.lifecycle_stage':
      return context.lifecycleStage || '';
    case 'utm.utm_source':
      return context.utmSource || '';
    case 'utm.utm_medium':
      return context.utmMedium || '';
    case 'utm.utm_campaign':
      return context.utmCampaign || '';
    case 'visitor.device':
      return context.deviceType || 'desktop';
    case 'visitor.country':
      return context.countryCode || '';
    default:
      return context.customAttributes?.[field] || '';
  }
}

/**
 * Recursively applies block overrides (hiding / prop patches) across block tree.
 */
function applyBlockOverridesToTree(
  blocks: PageBlock[],
  overrideMap: Map<string, BlockOverride>,
): PageBlock[] {
  const result: PageBlock[] = [];

  for (const block of blocks) {
    const override = overrideMap.get(block.id);

    // Filter out hidden blocks
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
        blocks: applyBlockOverridesToTree(updatedBlock.blocks, overrideMap),
      };
    }

    result.push(updatedBlock);
  }

  return result;
}
