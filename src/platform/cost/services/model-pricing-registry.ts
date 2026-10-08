/**
 * @fileOverview Provider Pricing Registry & Micro-USD Cost Computation (Phase 15 Milestone 2)
 *
 * Implements Rules 4, 11, 14, 48, 57, 58.
 * Provides authoritative model pricing cards with exact integer rates (micro-USD per million tokens)
 * and zero floating-point calculation drift.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  ModelPricingCard,
  ModelProvider,
  ModelTier,
  MICRO_USD_PER_USD,
  COST_ERROR_CODES,
  CostDomainError,
} from '@/platform/cost/contracts/cost-types';

/**
 * Authoritative registry of supported AI models and verified pricing rate cards.
 * Rates are strictly non-negative integers in micro-USD per 1,000,000 tokens ($1 = 1,000,000 micro-USD).
 */
export const MODEL_PRICING_CATALOG: readonly ModelPricingCard[] = [
  // --------------------------------------------------------------------------
  // Anthropic Models
  // --------------------------------------------------------------------------
  {
    modelId: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    tier: 'TIER_1_LOW_COST',
    inputRatePerMillionMicroUSD: 800_000, // $0.80 / M
    outputRatePerMillionMicroUSD: 4_000_000, // $4.00 / M
    cachedInputRatePerMillionMicroUSD: 80_000, // $0.08 / M (90% discount)
    contextWindowTokens: 200_000,
    maxOutputTokens: 8_192,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: false,
  },
  {
    modelId: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    tier: 'TIER_2_GENERAL_REASONING',
    inputRatePerMillionMicroUSD: 3_000_000, // $3.00 / M
    outputRatePerMillionMicroUSD: 15_000_000, // $15.00 / M
    cachedInputRatePerMillionMicroUSD: 300_000, // $0.30 / M (90% discount)
    contextWindowTokens: 200_000,
    maxOutputTokens: 8_192,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: true,
  },
  {
    modelId: 'claude-3-opus-20240229',
    provider: 'anthropic',
    tier: 'TIER_3_HIGH_END',
    inputRatePerMillionMicroUSD: 15_000_000, // $15.00 / M
    outputRatePerMillionMicroUSD: 75_000_000, // $75.00 / M
    cachedInputRatePerMillionMicroUSD: 1_500_000, // $1.50 / M (90% discount)
    contextWindowTokens: 200_000,
    maxOutputTokens: 4_096,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: false,
  },

  // --------------------------------------------------------------------------
  // OpenAI Models
  // --------------------------------------------------------------------------
  {
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    tier: 'TIER_1_LOW_COST',
    inputRatePerMillionMicroUSD: 150_000, // $0.15 / M
    outputRatePerMillionMicroUSD: 600_000, // $0.60 / M
    cachedInputRatePerMillionMicroUSD: 75_000, // $0.075 / M (50% discount)
    contextWindowTokens: 128_000,
    maxOutputTokens: 16_384,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: true,
  },
  {
    modelId: 'gpt-4o',
    provider: 'openai',
    tier: 'TIER_2_GENERAL_REASONING',
    inputRatePerMillionMicroUSD: 2_500_000, // $2.50 / M
    outputRatePerMillionMicroUSD: 10_000_000, // $10.00 / M
    cachedInputRatePerMillionMicroUSD: 1_250_000, // $1.25 / M (50% discount)
    contextWindowTokens: 128_000,
    maxOutputTokens: 16_384,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: false,
  },
  {
    modelId: 'o1-preview',
    provider: 'openai',
    tier: 'TIER_3_HIGH_END',
    inputRatePerMillionMicroUSD: 15_000_000, // $15.00 / M
    outputRatePerMillionMicroUSD: 60_000_000, // $60.00 / M
    cachedInputRatePerMillionMicroUSD: 7_500_000, // $7.50 / M
    contextWindowTokens: 128_000,
    maxOutputTokens: 32_768,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: true,
  },

  // --------------------------------------------------------------------------
  // Google Models
  // --------------------------------------------------------------------------
  {
    modelId: 'gemini-1.5-flash',
    provider: 'google',
    tier: 'TIER_1_LOW_COST',
    inputRatePerMillionMicroUSD: 75_000, // $0.075 / M
    outputRatePerMillionMicroUSD: 300_000, // $0.30 / M
    cachedInputRatePerMillionMicroUSD: 18_750, // $0.01875 / M (75% discount)
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 8_192,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: false,
  },
  {
    modelId: 'gemini-2.0-flash',
    provider: 'google',
    tier: 'TIER_1_LOW_COST',
    inputRatePerMillionMicroUSD: 100_000, // $0.10 / M
    outputRatePerMillionMicroUSD: 400_000, // $0.40 / M
    cachedInputRatePerMillionMicroUSD: 25_000, // $0.025 / M
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 8_192,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: false,
  },
  {
    modelId: 'gemini-1.5-pro',
    provider: 'google',
    tier: 'TIER_2_GENERAL_REASONING',
    inputRatePerMillionMicroUSD: 1_250_000, // $1.25 / M
    outputRatePerMillionMicroUSD: 5_000_000, // $5.00 / M
    cachedInputRatePerMillionMicroUSD: 312_500, // $0.3125 / M
    contextWindowTokens: 2_000_000,
    maxOutputTokens: 8_192,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: false,
  },

  // --------------------------------------------------------------------------
  // DeepSeek Models
  // --------------------------------------------------------------------------
  {
    modelId: 'deepseek-chat',
    provider: 'deepseek',
    tier: 'TIER_1_LOW_COST',
    inputRatePerMillionMicroUSD: 140_000, // $0.14 / M
    outputRatePerMillionMicroUSD: 280_000, // $0.28 / M
    cachedInputRatePerMillionMicroUSD: 14_000, // $0.014 / M
    contextWindowTokens: 64_000,
    maxOutputTokens: 8_000,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: false,
  },
  {
    modelId: 'deepseek-reasoner',
    provider: 'deepseek',
    tier: 'TIER_2_GENERAL_REASONING',
    inputRatePerMillionMicroUSD: 550_000, // $0.55 / M
    outputRatePerMillionMicroUSD: 2_190_000, // $2.19 / M
    cachedInputRatePerMillionMicroUSD: 140_000, // $0.14 / M
    contextWindowTokens: 64_000,
    maxOutputTokens: 8_000,
    supportsStructuredOutput: true,
    supportsPromptCaching: true,
    isDefaultInTier: false,
  },
];

/**
 * Fast lookup map indexed by modelId.
 */
const PRICING_MAP = new Map<string, ModelPricingCard>(
  MODEL_PRICING_CATALOG.map((card) => [card.modelId, card])
);

/**
 * Retrieves a pricing card for a specified modelId.
 */
export function getModelPricingCard(modelId: string): ModelPricingCard | null {
  return PRICING_MAP.get(modelId) ?? null;
}

/**
 * Returns the default canonical model for a specified tier.
 */
export function getDefaultModelForTier(tier: ModelTier): ModelPricingCard {
  const defaultModel = MODEL_PRICING_CATALOG.find(
    (card) => card.tier === tier && card.isDefaultInTier
  );
  if (!defaultModel) {
    // Fallback to first model matching tier
    const fallback = MODEL_PRICING_CATALOG.find((card) => card.tier === tier);
    if (!fallback) {
      throw new CostDomainError(
        COST_ERROR_CODES.COST_MODEL_NOT_FOUND,
        `No model registered for tier: ${tier}`,
        404
      );
    }
    return fallback;
  }
  return defaultModel;
}

/**
 * Returns available models optionally filtered by provider and tier.
 */
export function getAvailableModels(filter?: {
  provider?: ModelProvider;
  tier?: ModelTier;
}): readonly ModelPricingCard[] {
  let results = MODEL_PRICING_CATALOG;
  if (filter?.provider) {
    results = results.filter((c) => c.provider === filter.provider);
  }
  if (filter?.tier) {
    results = results.filter((c) => c.tier === filter.tier);
  }
  return results;
}

/**
 * Computes execution cost in exact integer micro-USD (Rule 11).
 *
 * Formula:
 * uncachedPromptTokens = max(0, promptTokens - cachedPromptTokens)
 * costMicroUSD = round((uncachedPromptTokens * inRate + completionTokens * outRate + cachedPromptTokens * cachedRate) / 1,000,000)
 */
export function computeExecutionCostMicroUSD(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  cachedPromptTokens: number = 0
): number {
  const card = getModelPricingCard(modelId);
  if (!card) {
    throw new CostDomainError(
      COST_ERROR_CODES.COST_MODEL_NOT_FOUND,
      `Cannot compute cost: unknown modelId "${modelId}"`,
      404
    );
  }

  const safePromptTokens = Math.max(0, Math.floor(promptTokens));
  const safeCompletionTokens = Math.max(0, Math.floor(completionTokens));
  const safeCachedTokens = Math.min(safePromptTokens, Math.max(0, Math.floor(cachedPromptTokens)));
  const uncachedPromptTokens = safePromptTokens - safeCachedTokens;

  const totalNumerator =
    uncachedPromptTokens * card.inputRatePerMillionMicroUSD +
    safeCompletionTokens * card.outputRatePerMillionMicroUSD +
    safeCachedTokens * card.cachedInputRatePerMillionMicroUSD;

  // Exact integer round
  return Math.round(totalNumerator / MICRO_USD_PER_USD);
}
