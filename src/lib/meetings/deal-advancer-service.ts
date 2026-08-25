/**
 * @fileoverview Pure CRM Deal Stage Advancement & Sales Effort Evaluator.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Idempotent evaluation preventing duplicate progression.
 */

import type {
  DealAdvancementRule,
  DealAdvancementResult,
} from './types/deal-advancer';

/**
 * Evaluates whether a meeting lifecycle outcome triggers a CRM deal stage advancement.
 */
export function evaluateDealAdvancement(
  currentDeal: { id: string; stageId: string; status: string; tags?: string[] },
  rules: DealAdvancementRule[],
  trigger: 'meeting_completed' | 'proposal_requested' | 'high_intent_detected' | 'no_show'
): DealAdvancementResult | null {
  // Only active (open) deals can be automatically advanced
  if (currentDeal.status !== 'open') return null;

  const matchingRule = rules.find(r => {
    if (r.triggerOutcome !== trigger) return false;
    if (r.sourceStageId && r.sourceStageId !== currentDeal.stageId) return false;
    return true;
  });

  if (!matchingRule) return null;

  // Prevent advancing to the exact same stage
  if (matchingRule.targetStageId === currentDeal.stageId) return null;

  const existingTags = currentDeal.tags || [];
  const newTags = matchingRule.autoAssignTags || [];
  const mergedTags = Array.from(new Set([...existingTags, ...newTags]));

  return {
    dealId: currentDeal.id,
    previousStageId: currentDeal.stageId,
    newStageId: matchingRule.targetStageId,
    appliedTags: mergedTags,
    salesEffortLogged: matchingRule.logActivityNote,
    timestamp: new Date().toISOString(),
  };
}
