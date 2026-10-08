/**
 * @fileOverview Unit & Contract Tests for Canonical Cost Contracts & Matrices (Phase 15 Milestone 2)
 *
 * Implements Rules 1, 4, 8, 11, 12, 14, 16, 17, 22, 23, 27, 48, 57, 58, 60, 67, 68, 69.
 * Validates Zod v4 schemas, exact integer micro-USD representations, error taxonomy,
 * and the 4 Mandatory Governance Matrices.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect } from 'vitest';
import {
  MODEL_PROVIDERS,
  MODEL_TIERS,
  ModelProviderSchema,
  ModelTierSchema,
  ModelPricingCardSchema,
  TokenUsageRecordSchema,
  CostBudgetPolicySchema,
  ModelRoutingInputSchema,
  ModelRoutingDecisionSchema,
  CostAccountingMetricsSchema,
  COST_ERROR_CODES,
  CostDomainError,
  COST_PERMISSION_MATRIX,
  COST_TOOL_MATRIX,
  COST_FAILURE_MATRIX,
  COST_ROLLBACK_MATRIX,
  validateCostPersonaPermission,
  resolveCostFailureStrategy,
  getCostRollbackCapability,
  MICRO_USD_PER_USD,
} from '@/platform/cost/contracts/cost-types';

describe('Phase 15 Milestone 2: Cost Contracts & Schemas', () => {
  it('should expose correct constants and micro-USD scaling factor (Rule 11)', () => {
    expect(MICRO_USD_PER_USD).toBe(1_000_000);
    expect(MODEL_PROVIDERS).toEqual(['anthropic', 'openai', 'google', 'deepseek']);
    expect(MODEL_TIERS).toEqual(['TIER_1_LOW_COST', 'TIER_2_GENERAL_REASONING', 'TIER_3_HIGH_END']);
  });

  it('should validate ModelProviderSchema and ModelTierSchema', () => {
    expect(ModelProviderSchema.safeParse('anthropic').success).toBe(true);
    expect(ModelProviderSchema.safeParse('deepseek').success).toBe(true);
    expect(ModelProviderSchema.safeParse('unknown_provider').success).toBe(false);

    expect(ModelTierSchema.safeParse('TIER_1_LOW_COST').success).toBe(true);
    expect(ModelTierSchema.safeParse('TIER_2_GENERAL_REASONING').success).toBe(true);
    expect(ModelTierSchema.safeParse('TIER_3_HIGH_END').success).toBe(true);
    expect(ModelTierSchema.safeParse('INVALID_TIER').success).toBe(false);
  });

  it('should validate ModelPricingCardSchema with exact integer rates (Rule 11)', () => {
    const validCard = {
      modelId: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic' as const,
      tier: 'TIER_2_GENERAL_REASONING' as const,
      inputRatePerMillionMicroUSD: 3_000_000,
      outputRatePerMillionMicroUSD: 15_000_000,
      cachedInputRatePerMillionMicroUSD: 300_000,
      contextWindowTokens: 200_000,
      maxOutputTokens: 8_192,
      supportsStructuredOutput: true,
      supportsPromptCaching: true,
      isDefaultInTier: true,
    };

    const parsed = ModelPricingCardSchema.safeParse(validCard);
    expect(parsed.success).toBe(true);

    // Reject negative rates
    const invalidCard = {
      ...validCard,
      inputRatePerMillionMicroUSD: -100,
    };
    expect(ModelPricingCardSchema.safeParse(invalidCard).success).toBe(false);
  });

  it('should validate TokenUsageRecordSchema with strictly non-negative integer tokens and micro-USD cost', () => {
    const validRecord = {
      id: 'usage_123',
      organizationId: 'org_enterprise',
      workspaceId: 'ws_prod',
      personaId: 'sales_agent',
      executionId: 'exec_abc',
      modelId: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic' as const,
      tier: 'TIER_2_GENERAL_REASONING' as const,
      promptTokens: 1500,
      completionTokens: 350,
      cachedPromptTokens: 200,
      costMicroUSD: 9750,
      recordedAt: new Date().toISOString(),
      metadata: {
        taskName: 'generate_outreach',
      },
    };

    const parsed = TokenUsageRecordSchema.safeParse(validRecord);
    expect(parsed.success).toBe(true);

    // Reject float token counts
    const invalidRecord = {
      ...validRecord,
      promptTokens: 15.5,
    };
    expect(TokenUsageRecordSchema.safeParse(invalidRecord).success).toBe(false);
  });

  it('should validate CostBudgetPolicySchema with hardCapActions', () => {
    const validPolicy = {
      id: 'policy_1',
      organizationId: 'org_enterprise',
      workspaceId: 'ws_prod',
      budgetPeriod: 'MONTHLY' as const,
      allocatedBudgetMicroUSD: 50_000_000, // $50 USD
      softAlertThresholdPercent: 80,
      hardCapAction: 'HALT' as const,
      updatedByUserId: 'usr_admin_1',
      updatedAt: new Date().toISOString(),
    };

    expect(CostBudgetPolicySchema.safeParse(validPolicy).success).toBe(true);

    // Reject soft threshold > 100
    expect(
      CostBudgetPolicySchema.safeParse({
        ...validPolicy,
        softAlertThresholdPercent: 120,
      }).success
    ).toBe(false);
  });

  it('should validate ModelRoutingInputSchema and ModelRoutingDecisionSchema with decisionHash (Rule 22)', () => {
    const routingInput = {
      organizationId: 'org_enterprise',
      workspaceId: 'ws_prod',
      personaId: 'billing_analyst',
      taskComplexity: 'MEDIUM' as const,
      riskCeiling: 'L2_STATE_MUTATION' as const,
      estimatedInputTokens: 2000,
      maxOutputTokens: 1000,
      latencySlaMs: 2500,
      requireStructuredOutput: true,
      requireToolCalling: true,
    };

    expect(ModelRoutingInputSchema.safeParse(routingInput).success).toBe(true);

    const routingDecision = {
      selectedModelId: 'claude-3-5-sonnet-20241022',
      selectedProvider: 'anthropic' as const,
      selectedTier: 'TIER_2_GENERAL_REASONING' as const,
      estimatedCostMicroUSD: 21000,
      rationale: 'Balanced reasoning with structured output support for state mutation',
      fallbackModelIds: ['gpt-4o', 'gemini-1.5-pro'],
      decisionHash: 'a'.repeat(64),
      routedAt: new Date().toISOString(),
    };

    expect(ModelRoutingDecisionSchema.safeParse(routingDecision).success).toBe(true);

    // Reject invalid decisionHash length
    expect(
      ModelRoutingDecisionSchema.safeParse({
        ...routingDecision,
        decisionHash: 'tooshort',
      }).success
    ).toBe(false);
  });

  it('should validate CostAccountingMetricsSchema', () => {
    const validMetrics = {
      organizationId: 'org_enterprise',
      workspaceId: 'ws_prod',
      periodStart: new Date(Date.now() - 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
      totalCostMicroUSD: 125_000_000,
      totalPromptTokens: 10_000_000,
      totalCompletionTokens: 2_500_000,
      totalCachedPromptTokens: 1_200_000,
      costByProvider: {
        anthropic: 75_000_000,
        openai: 35_000_000,
        google: 15_000_000,
        deepseek: 0,
      },
      costByTier: {
        TIER_1_LOW_COST: 20_000_000,
        TIER_2_GENERAL_REASONING: 85_000_000,
        TIER_3_HIGH_END: 20_000_000,
      },
      costByPersona: {
        sales_agent: 60_000_000,
        billing_analyst: 65_000_000,
      },
      totalRequests: 1420,
    };

    expect(CostAccountingMetricsSchema.safeParse(validMetrics).success).toBe(true);
  });
});

describe('Phase 15 Milestone 2: Error Taxonomy & Typed Error', () => {
  it('should properly map CostDomainError to HTTP status codes (Rule 48)', () => {
    const budgetExceededError = new CostDomainError(
      COST_ERROR_CODES.COST_BUDGET_EXCEEDED,
      'Monthly allocation depleted',
      403,
      { remainingMicroUSD: 0 }
    );
    expect(budgetExceededError.name).toBe('CostDomainError');
    expect(budgetExceededError.code).toBe(COST_ERROR_CODES.COST_BUDGET_EXCEEDED);
    expect(budgetExceededError.httpStatus).toBe(403);
    expect(budgetExceededError.context).toEqual({ remainingMicroUSD: 0 });

    const modelNotFoundError = new CostDomainError(
      COST_ERROR_CODES.COST_MODEL_NOT_FOUND,
      'Model non-existent',
      404
    );
    expect(modelNotFoundError.httpStatus).toBe(404);
  });
});

describe('Phase 15 Milestone 2: The 4 Mandatory Governance Matrices (Rules 1940-1953)', () => {
  it('should verify COST_PERMISSION_MATRIX least-privilege scoping (Rules 16 & 17)', () => {
    expect(COST_PERMISSION_MATRIX.billing_analyst).toContain('cost:read');
    expect(COST_PERMISSION_MATRIX.billing_analyst).not.toContain('cost:manage');

    // Subagent has cost:read, cannot have cost:manage
    expect(validateCostPersonaPermission('billing_analyst', 'cost:read')).toBe(true);
    expect(validateCostPersonaPermission('billing_analyst', 'cost:manage')).toBe(false);
  });

  it('should verify COST_TOOL_MATRIX capabilities, risk tiers, and idempotency (Rules 12 & 14)', () => {
    expect(COST_TOOL_MATRIX['cost.record_usage']).toEqual({
      capabilityId: 'cost.record_usage',
      riskLevel: 'L0_READ',
      requiresIdempotencyKey: false,
      auditRequired: false,
    });

    expect(COST_TOOL_MATRIX['cost.set_budget_policy']).toEqual({
      capabilityId: 'cost.set_budget_policy',
      riskLevel: 'L2_STATE_MUTATION',
      requiresIdempotencyKey: true,
      auditRequired: true,
      nonDelegable: true,
    });
  });

  it('should verify COST_FAILURE_MATRIX recovery strategies (Rule 2)', () => {
    expect(COST_FAILURE_MATRIX).toBeDefined();
    expect(resolveCostFailureStrategy('COST_RATE_LIMIT_429')).toBe('FAILOVER_TO_NEXT_PROVIDER');
    expect(resolveCostFailureStrategy('COST_BUDGET_EXCEEDED')).toBe('ENFORCE_HARD_CAP_POLICY');
    expect(resolveCostFailureStrategy('COST_DEAD_MAN_PAUSED')).toBe('FAIL_CLOSED');
  });

  it('should verify COST_ROLLBACK_MATRIX reverse-LIFO saga compensation (Rule 27)', () => {
    expect(COST_ROLLBACK_MATRIX).toBeDefined();
    expect(getCostRollbackCapability('cost.set_budget_policy')).toBe('cost.revert_budget_policy');
    expect(getCostRollbackCapability('cost.record_usage')).toBeNull();
    expect(getCostRollbackCapability('cost.route_model')).toBeNull();
  });
});
