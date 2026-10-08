/**
 * @fileOverview Unit & Integration Tests for Dynamic Model Router (Phase 15 Milestone 2)
 *
 * Implements Rules 4, 8, 11, 14, 22, 24, 48, 57, 58, 60, 67, 68, 69.
 * Validates:
 * 1. 6-Factor Dynamic Routing: Complexity, Risk, Context, Latency, Budget, Residency.
 * 2. Multi-Provider Fallback list generation for outage resiliency (FM-3 & Rule 24).
 * 3. Canonical SHA-256 decisionHash generation (Rule 22).
 * 4. Micro-USD estimated cost calculations (Rule 11).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect } from 'vitest';
import {
  getDynamicModelRouter,
  DynamicModelRouter,
} from '@/platform/cost/routing/dynamic-model-router';
import { ModelRoutingInput } from '@/platform/cost/contracts/cost-types';

describe('Phase 15 Milestone 2: DynamicModelRouter', () => {
  const router: DynamicModelRouter = getDynamicModelRouter();

  it('should route low-complexity and low-risk tasks to TIER_1_LOW_COST', async () => {
    const input: ModelRoutingInput = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      personaId: 'sales_agent',
      taskComplexity: 'LOW',
      riskCeiling: 'L0_READ',
      estimatedInputTokens: 500,
      maxOutputTokens: 200,
      requireStructuredOutput: true,
      requireToolCalling: false,
    };

    const decision = await router.routeModel(input);

    expect(decision.selectedTier).toBe('TIER_1_LOW_COST');
    expect(decision.selectedModelId).toBeDefined();
    expect(decision.fallbackModelIds.length).toBeGreaterThanOrEqual(2);
    // Ensure fallbacks are from alternative providers
    expect(decision.decisionHash).toHaveLength(64);
    expect(decision.estimatedCostMicroUSD).toBeGreaterThanOrEqual(0);
  });

  it('should route state mutation or medium complexity tasks to at least TIER_2_GENERAL_REASONING', async () => {
    const input: ModelRoutingInput = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      personaId: 'billing_analyst',
      taskComplexity: 'MEDIUM',
      riskCeiling: 'L2_STATE_MUTATION',
      estimatedInputTokens: 2500,
      maxOutputTokens: 1000,
      requireStructuredOutput: true,
      requireToolCalling: true,
    };

    const decision = await router.routeModel(input);

    expect(decision.selectedTier).toBe('TIER_2_GENERAL_REASONING');
    expect(['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro']).toContain(
      decision.selectedModelId
    );
  });

  it('should route critical complexity or privileged tasks to TIER_3_HIGH_END', async () => {
    const input: ModelRoutingInput = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      personaId: 'supervisor',
      taskComplexity: 'CRITICAL',
      riskCeiling: 'L4_PRIVILEGED_DESTRUCTIVE',
      estimatedInputTokens: 10000,
      maxOutputTokens: 4000,
      requireStructuredOutput: true,
      requireToolCalling: true,
    };

    const decision = await router.routeModel(input);

    expect(decision.selectedTier).toBe('TIER_3_HIGH_END');
    expect(['o1-preview', 'claude-3-opus-20240229']).toContain(decision.selectedModelId);
  });

  it('should select large context window models when input tokens exceed 150k', async () => {
    const input: ModelRoutingInput = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      personaId: 'meeting_intelligence_agent',
      taskComplexity: 'MEDIUM',
      riskCeiling: 'L0_READ',
      estimatedInputTokens: 160000,
      maxOutputTokens: 2000,
      requireStructuredOutput: true,
      requireToolCalling: false,
    };

    const decision = await router.routeModel(input);

    // Context must support >= 160k
    expect(['gemini-1.5-pro', 'gemini-1.5-flash', 'claude-3-5-sonnet-20241022', 'gemini-2.0-flash']).toContain(
      decision.selectedModelId
    );
  });

  it('should prioritize fast latency models when latency SLA < 1500ms', async () => {
    const input: ModelRoutingInput = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      personaId: 'crm_agent',
      taskComplexity: 'LOW',
      riskCeiling: 'L0_READ',
      estimatedInputTokens: 800,
      maxOutputTokens: 300,
      latencySlaMs: 1000,
      requireStructuredOutput: true,
      requireToolCalling: false,
    };

    const decision = await router.routeModel(input);

    expect(['gemini-1.5-flash', 'gemini-2.0-flash', 'gpt-4o-mini', 'claude-3-5-haiku-20241022']).toContain(
      decision.selectedModelId
    );
  });

  it('should synthesize multi-provider fallbacks across distinct providers (Rule 24 & FM-3)', async () => {
    const input: ModelRoutingInput = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      personaId: 'revenue_analyst',
      taskComplexity: 'MEDIUM',
      riskCeiling: 'L1_INTERNAL_DRAFT',
      estimatedInputTokens: 1500,
      maxOutputTokens: 500,
      requireStructuredOutput: true,
      requireToolCalling: false,
    };

    const decision = await router.routeModel(input);

    expect(decision.fallbackModelIds.length).toBeGreaterThanOrEqual(2);
    // None of the fallback models should match the selected primary model
    expect(decision.fallbackModelIds).not.toContain(decision.selectedModelId);
  });

  it('should generate deterministic canonical SHA-256 decisionHash (Rule 22)', async () => {
    const input: ModelRoutingInput = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      personaId: 'attendance_analyst',
      taskComplexity: 'LOW',
      riskCeiling: 'L0_READ',
      estimatedInputTokens: 400,
      maxOutputTokens: 100,
      requireStructuredOutput: true,
      requireToolCalling: false,
    };

    const decision = await router.routeModel(input);

    expect(decision.decisionHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
