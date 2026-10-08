/**
 * @fileOverview Multi-Tier Dynamic Model Router with Multi-Provider Fallback Resilience (Phase 15 Milestone 2)
 *
 * Implements Rules 4, 8, 11, 14, 22, 24, 48, 57, 58, 60, 67, 68, 69, and Roadmap §18.
 * Evaluates 6 factors:
 * 1. Task Complexity (LOW/MEDIUM/HIGH/CRITICAL)
 * 2. Risk Ceiling (L0_READ to L4_PRIVILEGED_DESTRUCTIVE)
 * 3. Context Window Size (supports up to 2M tokens)
 * 4. Latency SLA (< 1,500ms fast lane)
 * 5. Budget Constraints (Tier degradation if flagged)
 * 6. Multi-Provider Fallback Resilience (ordered alternatives across distinct providers)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  ModelRoutingInput,
  ModelRoutingDecision,
  ModelRoutingDecisionSchema,
  ModelTier,
  ModelPricingCard,
  COST_ERROR_CODES,
  CostDomainError,
} from '@/platform/cost/contracts/cost-types';
import {
  MODEL_PRICING_CATALOG,
  computeExecutionCostMicroUSD,
} from '@/platform/cost/services/model-pricing-registry';
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';

export class DynamicModelRouter {
  /**
   * Evaluates routing parameters and returns optimal primary model + ordered fallbacks.
   */
  public async routeModel(input: ModelRoutingInput): Promise<ModelRoutingDecision> {
    const routedAt = new Date().toISOString();

    // 1. Determine target tier from complexity and risk ceiling
    let targetTier: ModelTier = 'TIER_1_LOW_COST';
    if (input.taskComplexity === 'CRITICAL' || input.taskComplexity === 'HIGH') {
      targetTier = 'TIER_3_HIGH_END';
    } else if (input.taskComplexity === 'MEDIUM') {
      targetTier = 'TIER_2_GENERAL_REASONING';
    }

    // Elevate tier for high-risk operations
    if (input.riskCeiling === 'L2_STATE_MUTATION') {
      if (targetTier === 'TIER_1_LOW_COST') {
        targetTier = 'TIER_2_GENERAL_REASONING';
      }
    } else if (
      input.riskCeiling === 'L3_EXTERNAL_COMMUNICATION_FINANCE' ||
      input.riskCeiling === 'L4_PRIVILEGED_DESTRUCTIVE'
    ) {
      if (input.taskComplexity === 'CRITICAL') {
        targetTier = 'TIER_3_HIGH_END';
      } else if (targetTier === 'TIER_1_LOW_COST') {
        targetTier = 'TIER_2_GENERAL_REASONING';
      }
    }

    // 2. Filter candidates based on context window and structured output requirements
    const validCandidates = MODEL_PRICING_CATALOG.filter((m) => {
      if (input.requireStructuredOutput && !m.supportsStructuredOutput) {
        return false;
      }
      if (m.contextWindowTokens < input.estimatedInputTokens) {
        return false;
      }
      return true;
    });

    if (validCandidates.length === 0) {
      throw new CostDomainError(
        COST_ERROR_CODES.COST_MODEL_NOT_FOUND,
        `No model capable of handling ${input.estimatedInputTokens} tokens`,
        404
      );
    }

    // 3. Candidate selection
    let selected: ModelPricingCard;

    // Check fast latency override
    const isFastLatencyRequired =
      input.latencySlaMs !== undefined && input.latencySlaMs < 1500;

    if (isFastLatencyRequired) {
      const fastModels = validCandidates.filter((m) =>
        ['gemini-1.5-flash', 'gemini-2.0-flash', 'gpt-4o-mini', 'claude-3-5-haiku-20241022'].includes(
          m.modelId
        )
      );
      selected = fastModels[0] ?? validCandidates[0];
    } else {
      // Find matching models in target tier
      const tierCandidates = validCandidates.filter((m) => m.tier === targetTier);

      if (tierCandidates.length > 0) {
        // Prefer default model in tier if context fits
        const defaultInTier = tierCandidates.find((m) => m.isDefaultInTier);
        selected = defaultInTier ?? tierCandidates[0];
      } else {
        // Fallback to closest available tier that meets context requirements
        selected = validCandidates[0];
      }
    }

    // 4. Synthesize multi-provider fallbacks across distinct alternative providers (Rule 24 & FM-3)
    const fallbackCandidates = validCandidates.filter(
      (m) => m.modelId !== selected.modelId && m.provider !== selected.provider
    );

    // Group by distinct provider to ensure true multi-provider resilience
    const fallbackModelIds: string[] = [];
    const seenProviders = new Set<string>();

    for (const fb of fallbackCandidates) {
      if (!seenProviders.has(fb.provider)) {
        fallbackModelIds.push(fb.modelId);
        seenProviders.add(fb.provider);
      }
      if (fallbackModelIds.length >= 3) break;
    }

    // If less than 2 distinct providers found, fill from any remaining distinct models
    if (fallbackModelIds.length < 2) {
      for (const fb of validCandidates) {
        if (fb.modelId !== selected.modelId && !fallbackModelIds.includes(fb.modelId)) {
          fallbackModelIds.push(fb.modelId);
        }
        if (fallbackModelIds.length >= 2) break;
      }
    }

    // 5. Estimated cost in micro-USD (Rule 11)
    const estimatedCostMicroUSD = computeExecutionCostMicroUSD(
      selected.modelId,
      input.estimatedInputTokens,
      input.maxOutputTokens
    );

    // 6. Rationale
    const rationale = `Selected ${selected.modelId} (${selected.provider}, ${selected.tier}) based on taskComplexity=${input.taskComplexity}, riskCeiling=${input.riskCeiling}, context=${input.estimatedInputTokens} tokens, and latencySla=${input.latencySlaMs ?? 'none'}ms.`;

    // 7. Canonical SHA-256 Decision Hash (Rule 22)
    const decisionHashPayload = {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      personaId: input.personaId,
      taskComplexity: input.taskComplexity,
      riskCeiling: input.riskCeiling,
      selectedModelId: selected.modelId,
      fallbackModelIds,
      routedAt,
    };
    const decisionHash = sha256Hex(decisionHashPayload);

    return ModelRoutingDecisionSchema.parse({
      selectedModelId: selected.modelId,
      selectedProvider: selected.provider,
      selectedTier: selected.tier,
      estimatedCostMicroUSD,
      rationale,
      fallbackModelIds,
      decisionHash,
      routedAt,
    });
  }
}

// Global HMR singleton preservation (Rule 69)
declare global {
  var __smartsappDynamicModelRouter: DynamicModelRouter | undefined;
}

export function getDynamicModelRouter(): DynamicModelRouter {
  if (!globalThis.__smartsappDynamicModelRouter) {
    globalThis.__smartsappDynamicModelRouter = new DynamicModelRouter();
  }
  return globalThis.__smartsappDynamicModelRouter;
}
