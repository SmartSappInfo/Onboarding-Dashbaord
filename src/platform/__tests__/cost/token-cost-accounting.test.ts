/**
 * @fileOverview Unit & Integration Tests for Pricing Registry & Token Cost Accounting Service (Phase 15 Milestone 2)
 *
 * Implements Rules 1, 4, 8, 11, 23, 40, 48, 57, 58, 60, 67, 68, 69.
 * Validates:
 * 1. Authoritative Pricing Registry lookups across all 4 providers.
 * 2. Exact integer micro-USD computation without floating point drift (Rule 11).
 * 3. Usage recording, domain event emission, and multi-dimensional metrics aggregation.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getModelPricingCard,
  getDefaultModelForTier,
  getAvailableModels,
  computeExecutionCostMicroUSD,
} from '@/platform/cost/services/model-pricing-registry';
import {
  getTokenCostAccountingService,
  TokenCostAccountingService,
} from '@/platform/cost/services/token-cost-accounting-service';
import { defaultEventBus } from '@/platform/events/event-bus';

describe('Phase 15 Milestone 2: Model Pricing Registry', () => {
  it('should retrieve pricing cards for supported models across all 4 providers', () => {
    const sonnet = getModelPricingCard('claude-3-5-sonnet-20241022');
    expect(sonnet).not.toBeNull();
    expect(sonnet?.provider).toBe('anthropic');
    expect(sonnet?.tier).toBe('TIER_2_GENERAL_REASONING');
    expect(sonnet?.inputRatePerMillionMicroUSD).toBe(3_000_000); // $3.00 / M
    expect(sonnet?.outputRatePerMillionMicroUSD).toBe(15_000_000); // $15.00 / M

    const gpt4oMini = getModelPricingCard('gpt-4o-mini');
    expect(gpt4oMini).not.toBeNull();
    expect(gpt4oMini?.provider).toBe('openai');
    expect(gpt4oMini?.tier).toBe('TIER_1_LOW_COST');

    const geminiFlash = getModelPricingCard('gemini-1.5-flash');
    expect(geminiFlash).not.toBeNull();
    expect(geminiFlash?.provider).toBe('google');

    const deepseekR1 = getModelPricingCard('deepseek-reasoner');
    expect(deepseekR1).not.toBeNull();
    expect(deepseekR1?.provider).toBe('deepseek');
  });

  it('should return default model per tier', () => {
    const tier1Default = getDefaultModelForTier('TIER_1_LOW_COST');
    expect(tier1Default.isDefaultInTier).toBe(true);
    expect(tier1Default.tier).toBe('TIER_1_LOW_COST');

    const tier2Default = getDefaultModelForTier('TIER_2_GENERAL_REASONING');
    expect(tier2Default.isDefaultInTier).toBe(true);
    expect(tier2Default.tier).toBe('TIER_2_GENERAL_REASONING');

    const tier3Default = getDefaultModelForTier('TIER_3_HIGH_END');
    expect(tier3Default.isDefaultInTier).toBe(true);
    expect(tier3Default.tier).toBe('TIER_3_HIGH_END');
  });

  it('should filter available models by provider and tier', () => {
    const anthropicModels = getAvailableModels({ provider: 'anthropic' });
    expect(anthropicModels.length).toBeGreaterThanOrEqual(2);
    expect(anthropicModels.every((m) => m.provider === 'anthropic')).toBe(true);

    const tier1Models = getAvailableModels({ tier: 'TIER_1_LOW_COST' });
    expect(tier1Models.every((m) => m.tier === 'TIER_1_LOW_COST')).toBe(true);
  });

  it('should calculate exact integer micro-USD costs without floating point drift (Rule 11)', () => {
    // Claude 3.5 Sonnet:
    // Input: $3/M = 3,000,000 micro-USD per 1,000,000 tokens => 3 micro-USD per token
    // Output: $15/M = 15,000,000 micro-USD per 1,000,000 tokens => 15 micro-USD per token
    // Cache: $0.30/M = 300,000 micro-USD per 1,000,000 tokens => 0.3 micro-USD per token
    //
    // For 1,000 input tokens (with 200 cached, so 800 uncached) + 200 output tokens:
    // Uncached: 800 * 3,000,000 = 2,400,000,000
    // Cached: 200 * 300,000 = 60,000,000
    // Output: 200 * 15,000,000 = 3,000,000,000
    // Sum = 5,460,000,000 / 1,000,000 = 5,460 micro-USD ($0.00546)
    const cost = computeExecutionCostMicroUSD(
      'claude-3-5-sonnet-20241022',
      1000,
      200,
      200
    );
    expect(cost).toBe(5460);
    expect(Number.isInteger(cost)).toBe(true);
  });
});

describe('Phase 15 Milestone 2: TokenCostAccountingService', () => {
  let service: TokenCostAccountingService;

  beforeEach(() => {
    service = getTokenCostAccountingService();
    service.resetForTesting();
  });

  it('should record token usage and auto-compute micro-USD cost', async () => {
    const record = await service.recordUsage({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      personaId: 'billing_analyst',
      executionId: 'exec_001',
      modelId: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      tier: 'TIER_2_GENERAL_REASONING',
      promptTokens: 1000,
      completionTokens: 200,
      cachedPromptTokens: 200,
    });

    expect(record.id).toBeDefined();
    expect(record.costMicroUSD).toBe(5460);
    expect(record.recordedAt).toBeDefined();

    const spend = await service.getWorkspaceTotalSpendMicroUSD('org_test', 'ws_test');
    expect(spend).toBe(5460);
  });

  it('should publish cost.usage.recorded domain event on recording (Rule 40)', async () => {
    let capturedEvent: unknown = null;
    const subscription = defaultEventBus.subscribe('cost.usage.recorded', (event) => {
      capturedEvent = event;
    });

    try {
      await service.recordUsage({
        organizationId: 'org_test_event',
        workspaceId: 'ws_test_event',
        personaId: 'sales_agent',
        executionId: 'exec_event_001',
        modelId: 'gpt-4o-mini',
        provider: 'openai',
        tier: 'TIER_1_LOW_COST',
        promptTokens: 500,
        completionTokens: 100,
        cachedPromptTokens: 0,
      });

      expect(capturedEvent).not.toBeNull();
      const eventObj = capturedEvent as { type: string; payload: { modelId: string } };
      expect(eventObj.type).toBe('cost.usage.recorded');
      expect(eventObj.payload.modelId).toBe('gpt-4o-mini');
    } finally {
      subscription.unsubscribe();
    }
  });

  it('should compute comprehensive cost accounting metrics with multi-dimensional breakdowns', async () => {
    await service.recordUsage({
      organizationId: 'org_metrics',
      workspaceId: 'ws_metrics',
      personaId: 'sales_agent',
      executionId: 'exec_m1',
      modelId: 'gpt-4o-mini',
      provider: 'openai',
      tier: 'TIER_1_LOW_COST',
      promptTokens: 1000,
      completionTokens: 500,
      cachedPromptTokens: 0,
    });

    await service.recordUsage({
      organizationId: 'org_metrics',
      workspaceId: 'ws_metrics',
      personaId: 'billing_analyst',
      executionId: 'exec_m2',
      modelId: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      tier: 'TIER_2_GENERAL_REASONING',
      promptTokens: 2000,
      completionTokens: 800,
      cachedPromptTokens: 500,
    });

    const metrics = await service.getMetrics('org_metrics', 'ws_metrics');

    expect(metrics.totalRequests).toBe(2);
    expect(metrics.totalPromptTokens).toBe(3000);
    expect(metrics.totalCompletionTokens).toBe(1300);
    expect(metrics.totalCachedPromptTokens).toBe(500);
    expect(metrics.totalCostMicroUSD).toBeGreaterThan(0);
    expect(metrics.costByProvider.openai).toBeGreaterThan(0);
    expect(metrics.costByProvider.anthropic).toBeGreaterThan(0);
    expect(metrics.costByTier.TIER_1_LOW_COST).toBeGreaterThan(0);
    expect(metrics.costByTier.TIER_2_GENERAL_REASONING).toBeGreaterThan(0);
    expect(metrics.costByPersona.sales_agent).toBeGreaterThan(0);
    expect(metrics.costByPersona.billing_analyst).toBeGreaterThan(0);
  });
});
