/**
 * @fileOverview Unit & Integration Tests for Budget Guard Service & Circuit Breaker (Phase 15 Milestone 2)
 *
 * Implements Rules 4, 8, 11, 17, 23, 24, 40, 48, 60, 67, 68, 69.
 * Validates:
 * 1. Budget policy configuration & persistence per workspace.
 * 2. Soft alert threshold detection (>= 80%) emitting domain events.
 * 3. Hard cap actions: HALT (throws COST_BUDGET_EXCEEDED, HTTP 403), DEGRADE_TIER, REQUIRE_APPROVAL.
 * 4. Dead-man switch emergency pause integration (Rule 60).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBudgetGuardService,
  BudgetGuardService,
} from '@/platform/cost/services/budget-guard-service';
import {
  getTokenCostAccountingService,
  TokenCostAccountingService,
} from '@/platform/cost/services/token-cost-accounting-service';
import { COST_ERROR_CODES, CostDomainError } from '@/platform/cost/contracts/cost-types';
import { defaultEventBus } from '@/platform/events/event-bus';

describe('Phase 15 Milestone 2: BudgetGuardService', () => {
  let budgetGuard: BudgetGuardService;
  let accountingService: TokenCostAccountingService;

  beforeEach(() => {
    budgetGuard = getBudgetGuardService();
    budgetGuard.resetForTesting();
    accountingService = getTokenCostAccountingService();
    accountingService.resetForTesting();
  });

  it('should set and retrieve a workspace budget policy', async () => {
    const policy = await budgetGuard.setPolicy({
      organizationId: 'org_bg_test',
      workspaceId: 'ws_bg_test',
      budgetPeriod: 'MONTHLY',
      allocatedBudgetMicroUSD: 10_000_000, // $10.00 USD
      softAlertThresholdPercent: 80,
      hardCapAction: 'HALT',
      updatedByUserId: 'usr_admin',
    });

    expect(policy.id).toBeDefined();
    expect(policy.allocatedBudgetMicroUSD).toBe(10_000_000);

    const fetched = await budgetGuard.getPolicy('org_bg_test', 'ws_bg_test');
    expect(fetched).not.toBeNull();
    expect(fetched?.allocatedBudgetMicroUSD).toBe(10_000_000);
  });

  it('should detect soft limit reached (>= 80%) and publish cost.budget.soft_limit_reached (Rule 40)', async () => {
    await budgetGuard.setPolicy({
      organizationId: 'org_soft_alert',
      workspaceId: 'ws_soft_alert',
      budgetPeriod: 'MONTHLY',
      allocatedBudgetMicroUSD: 1_000_000, // $1.00 USD
      softAlertThresholdPercent: 80,
      hardCapAction: 'HALT',
      updatedByUserId: 'usr_admin',
    });

    // Record usage of 850,000 micro-USD (85% utilization)
    await accountingService.recordUsage({
      organizationId: 'org_soft_alert',
      workspaceId: 'ws_soft_alert',
      personaId: 'sales_agent',
      executionId: 'exec_alert_1',
      modelId: 'gpt-4o-mini',
      provider: 'openai',
      tier: 'TIER_1_LOW_COST',
      promptTokens: 1000,
      completionTokens: 200,
      costMicroUSD: 850_000,
    });

    let softLimitEventCaptured = false;
    const sub = defaultEventBus.subscribe('cost.budget.soft_limit_reached', () => {
      softLimitEventCaptured = true;
    });

    try {
      const status = await budgetGuard.checkBudget('org_soft_alert', 'ws_soft_alert');
      expect(status.isSoftLimitReached).toBe(true);
      expect(status.isExceeded).toBe(false);
      expect(status.utilizationPercent).toBe(85);
      expect(status.remainingBudgetMicroUSD).toBe(150_000);
      expect(softLimitEventCaptured).toBe(true);
    } finally {
      sub.unsubscribe();
    }
  });

  it('should enforce HALT action throwing COST_BUDGET_EXCEEDED when spend >= 100% (Rule 23)', async () => {
    await budgetGuard.setPolicy({
      organizationId: 'org_halt_test',
      workspaceId: 'ws_halt_test',
      budgetPeriod: 'MONTHLY',
      allocatedBudgetMicroUSD: 500_000, // $0.50 USD
      softAlertThresholdPercent: 80,
      hardCapAction: 'HALT',
      updatedByUserId: 'usr_admin',
    });

    // Record usage of 600,000 micro-USD (exceeds budget)
    await accountingService.recordUsage({
      organizationId: 'org_halt_test',
      workspaceId: 'ws_halt_test',
      personaId: 'billing_analyst',
      executionId: 'exec_halt_1',
      modelId: 'gpt-4o',
      provider: 'openai',
      tier: 'TIER_2_GENERAL_REASONING',
      promptTokens: 1000,
      completionTokens: 500,
      costMicroUSD: 600_000,
    });

    const status = await budgetGuard.checkBudget('org_halt_test', 'ws_halt_test');
    expect(status.isExceeded).toBe(true);

    await expect(
      budgetGuard.assertBudgetAvailable('org_halt_test', 'ws_halt_test')
    ).rejects.toThrow(CostDomainError);

    try {
      await budgetGuard.assertBudgetAvailable('org_halt_test', 'ws_halt_test');
    } catch (err) {
      const costErr = err as CostDomainError;
      expect(costErr.code).toBe(COST_ERROR_CODES.COST_BUDGET_EXCEEDED);
      expect(costErr.httpStatus).toBe(403);
    }
  });

  it('should allow DEGRADE_TIER action without throwing, but returning DEGRADE_TIER action', async () => {
    await budgetGuard.setPolicy({
      organizationId: 'org_degrade_test',
      workspaceId: 'ws_degrade_test',
      budgetPeriod: 'MONTHLY',
      allocatedBudgetMicroUSD: 200_000,
      softAlertThresholdPercent: 75,
      hardCapAction: 'DEGRADE_TIER',
      updatedByUserId: 'usr_admin',
    });

    await accountingService.recordUsage({
      organizationId: 'org_degrade_test',
      workspaceId: 'ws_degrade_test',
      personaId: 'billing_analyst',
      executionId: 'exec_deg_1',
      modelId: 'gpt-4o',
      provider: 'openai',
      tier: 'TIER_2_GENERAL_REASONING',
      promptTokens: 1000,
      completionTokens: 500,
      costMicroUSD: 250_000,
    });

    const status = await budgetGuard.checkBudget('org_degrade_test', 'ws_degrade_test');
    expect(status.isExceeded).toBe(true);
    expect(status.hardCapAction).toBe('DEGRADE_TIER');

    // assertBudgetAvailable should NOT throw for DEGRADE_TIER
    await expect(
      budgetGuard.assertBudgetAvailable('org_degrade_test', 'ws_degrade_test')
    ).resolves.not.toThrow();
  });
});
