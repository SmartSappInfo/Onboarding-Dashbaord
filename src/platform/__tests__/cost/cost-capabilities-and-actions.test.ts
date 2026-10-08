/**
 * @fileOverview Unit & Integration Tests for Cost Capabilities & Governed Server Actions (Phase 15 Milestone 2)
 *
 * Implements Rules 1, 4, 8, 11, 12, 14, 16, 17, 19, 22, 23, 27, 40, 47, 48, 51, 57, 58, 60, 67, 68, 69.
 * Validates:
 * 1. Capability registration in CapabilityRegistry with risk levels and non-delegable security (Rule 17).
 * 2. Next.js 15 Server Actions: Clerk auth, Anti-IDOR validation, dead-man pause gating.
 * 3. RBAC permission reference parsing for cost:read and cost:manage.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';
import '@/platform/capabilities/cost/cost-capabilities';
import {
  recordTokenUsageAction,
  getCostMetricsAction,
  routeModelAction,
  checkBudgetStatusAction,
  setBudgetPolicyAction,
} from '@/app/actions/cost-actions';
import * as requireAuthModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import { parsePermissionRef } from '@/platform/capabilities/contracts/permission-refs';
import { getTokenCostAccountingService } from '@/platform/cost/services/token-cost-accounting-service';
import { getBudgetGuardService } from '@/platform/cost/services/budget-guard-service';

describe('Phase 15 Milestone 2: Canonical Cost Capabilities', () => {
  it('should register all 5 cost capabilities in CapabilityRegistry', () => {
    const recordUsage = getCapability('cost.record_usage');
    expect(recordUsage).toBeDefined();
    expect(recordUsage?.risk.level).toBe('L0_READ');
    expect(recordUsage?.permissions).toContain('cost:read');

    const getMetrics = getCapability('cost.get_metrics');
    expect(getMetrics).toBeDefined();
    expect(getMetrics?.risk.level).toBe('L0_READ');

    const routeModel = getCapability('cost.route_model');
    expect(routeModel).toBeDefined();
    expect(routeModel?.risk.level).toBe('L0_READ');

    const checkBudget = getCapability('cost.check_budget');
    expect(checkBudget).toBeDefined();
    expect(checkBudget?.risk.level).toBe('L0_READ');

    const setPolicy = getCapability('cost.set_budget_policy');
    expect(setPolicy).toBeDefined();
    expect(setPolicy?.risk.level).toBe('L2_STATE_MUTATION');
    expect(setPolicy?.policies.requiresIdempotencyKey).toBe(true);
    expect(setPolicy?.policies.auditRequired).toBe(true);
    expect(setPolicy?.permissions).toContain('cost:manage');
  });

  it('should enforce Rule 17 non-delegable protection in cost.set_budget_policy', async () => {
    const setPolicy = getCapability('cost.set_budget_policy');
    expect(setPolicy).toBeDefined();

    // Invoking with agent actor should be rejected with 403 / UNAUTHORIZED_MUTATION
    await expect(
      setPolicy!.handler(
        {
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          budgetPeriod: 'MONTHLY',
          allocatedBudgetMicroUSD: 5_000_000,
          softAlertThresholdPercent: 80,
          hardCapAction: 'HALT',
          updatedByUserId: 'billing_analyst',
        },
        {
          principal: {
            actorType: 'agent',
            userId: 'usr_agent_001',
            organizationId: 'org_test',
            workspaceId: 'ws_test',
            grantedScopes: ['cost:read', 'cost:manage'],
            effectiveRole: 'agent',
          },
          correlationId: 'corr_test_1',
          timestamp: new Date().toISOString(),
        }
      )
    ).rejects.toThrow(/Non-delegable action/);
  });
});

describe('Phase 15 Milestone 2: Permission References Parsing', () => {
  it('should parse cost:read and cost:manage correctly', () => {
    const readPerm = parsePermissionRef('cost:read');
    expect(readPerm).toEqual({
      kind: 'rbac',
      section: 'operations',
      feature: 'dashboard',
      action: 'view',
    });

    const managePerm = parsePermissionRef('cost:manage');
    expect(managePerm).toEqual({
      kind: 'rbac',
      section: 'operations',
      feature: 'dashboard',
      action: 'edit',
    });
  });
});

describe('Phase 15 Milestone 2: Governed Cost Server Actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getTokenCostAccountingService().resetForTesting();
    getBudgetGuardService().resetForTesting();

    // Default mock auth session
    vi.spyOn(requireAuthModule, 'requireAuth').mockResolvedValue({
      uid: 'usr_admin_001',
      profile: {
        organizationId: 'org_cost_test',
      },
      isSystemAdmin: false,
    } as unknown as requireAuthModule.AuthContext);

    // Default dead-man switch inactive
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockResolvedValue();
  });

  describe('recordTokenUsageAction & getCostMetricsAction', () => {
    it('records token usage and queries aggregated metrics for authorized caller', async () => {
      const recordRes = await recordTokenUsageAction({
        organizationId: 'org_cost_test',
        workspaceId: 'ws_cost_test',
        personaId: 'sales_agent',
        executionId: 'exec_action_001',
        modelId: 'gpt-4o-mini',
        provider: 'openai',
        tier: 'TIER_1_LOW_COST',
        promptTokens: 2000,
        completionTokens: 400,
      });

      expect(recordRes.success).toBe(true);
      expect(recordRes.data?.id).toBeDefined();
      expect(recordRes.data?.costMicroUSD).toBeGreaterThan(0);

      const metricsRes = await getCostMetricsAction('org_cost_test', 'ws_cost_test');
      expect(metricsRes.success).toBe(true);
      expect(metricsRes.data?.totalRequests).toBe(1);
      expect(metricsRes.data?.totalPromptTokens).toBe(2000);
      expect(metricsRes.data?.totalCostMicroUSD).toBe(recordRes.data?.costMicroUSD);
    });

    it('rejects cross-tenant caller with IDOR_VIOLATION (Rules 8 & 47)', async () => {
      vi.spyOn(requireAuthModule, 'requireAuth').mockResolvedValue({
        uid: 'usr_attacker',
        profile: {
          organizationId: 'org_attacker',
        },
        isSystemAdmin: false,
      } as unknown as requireAuthModule.AuthContext);

      const res = await recordTokenUsageAction({
        organizationId: 'org_cost_test',
        workspaceId: 'ws_cost_test',
        personaId: 'sales_agent',
        executionId: 'exec_action_attack',
        modelId: 'gpt-4o-mini',
        provider: 'openai',
        tier: 'TIER_1_LOW_COST',
        promptTokens: 100,
        completionTokens: 50,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('COST_IDOR_VIOLATION');
    });
  });

  describe('routeModelAction', () => {
    it('evaluates model routing decision successfully', async () => {
      const res = await routeModelAction({
        organizationId: 'org_cost_test',
        workspaceId: 'ws_cost_test',
        personaId: 'billing_analyst',
        taskComplexity: 'MEDIUM',
        riskCeiling: 'L2_STATE_MUTATION',
        estimatedInputTokens: 3000,
        maxOutputTokens: 1000,
        requireStructuredOutput: true,
        requireToolCalling: true,
      });

      expect(res.success).toBe(true);
      expect(res.data?.selectedModelId).toBeDefined();
      expect(res.data?.selectedTier).toBe('TIER_2_GENERAL_REASONING');
      expect(res.data?.fallbackModelIds.length).toBeGreaterThanOrEqual(2);
      expect(res.data?.decisionHash).toHaveLength(64);
    });
  });

  describe('checkBudgetStatusAction & setBudgetPolicyAction', () => {
    it('configures policy and checks budget status', async () => {
      const setRes = await setBudgetPolicyAction({
        organizationId: 'org_cost_test',
        workspaceId: 'ws_cost_test',
        budgetPeriod: 'MONTHLY',
        allocatedBudgetMicroUSD: 5_000_000,
        softAlertThresholdPercent: 80,
        hardCapAction: 'HALT',
        updatedByUserId: 'usr_admin_001',
      });

      expect(setRes.success).toBe(true);
      expect(setRes.data?.allocatedBudgetMicroUSD).toBe(5_000_000);

      const checkRes = await checkBudgetStatusAction('org_cost_test', 'ws_cost_test');
      expect(checkRes.success).toBe(true);
      expect(checkRes.data?.isExceeded).toBe(false);
      expect(checkRes.data?.remainingBudgetMicroUSD).toBe(5_000_000);
    });

    it('fails closed when emergency dead-man pause is active (Rule 60)', async () => {
      vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValue(
        new deadManModule.AgentGovernanceEmergencyPausedError(
          'Emergency pause active'
        )
      );

      const setRes = await setBudgetPolicyAction({
        organizationId: 'org_cost_test',
        workspaceId: 'ws_cost_test',
        budgetPeriod: 'MONTHLY',
        allocatedBudgetMicroUSD: 5_000_000,
        softAlertThresholdPercent: 80,
        hardCapAction: 'HALT',
        updatedByUserId: 'usr_admin_001',
      });

      expect(setRes.success).toBe(false);
      expect(setRes.error?.code).toBe('COST_DEAD_MAN_PAUSED');
    });
  });
});
