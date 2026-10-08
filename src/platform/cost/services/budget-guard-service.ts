/**
 * @fileOverview Proactive Budget Guard Service & Exhaustion Circuit Breaker (Phase 15 Milestone 2)
 *
 * Implements Rules 4, 8, 11, 17, 23, 24, 40, 48, 60, 67, 68, 69.
 * Tracks workspace budget ceilings, issues proactive soft limit alerts (>= 80%),
 * and trips circuit breakers on 100% exhaustion via HALT, DEGRADE_TIER, or REQUIRE_APPROVAL.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  CostBudgetPolicy,
  CostBudgetPolicySchema,
  HardCapAction,
  COST_ERROR_CODES,
  CostDomainError,
} from '@/platform/cost/contracts/cost-types';
import { getTokenCostAccountingService } from './token-cost-accounting-service';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { defaultEventBus } from '@/platform/events/event-bus';

export interface BudgetStatusResult {
  readonly isExceeded: boolean;
  readonly isSoftLimitReached: boolean;
  readonly utilizationPercent: number;
  readonly remainingBudgetMicroUSD: number;
  readonly hardCapAction: HardCapAction;
  readonly policy?: CostBudgetPolicy;
}

export class BudgetGuardService {
  private readonly policies = new Map<string, CostBudgetPolicy>();

  private getPolicyKey(organizationId: string, workspaceId: string): string {
    return `${organizationId}:${workspaceId}`;
  }

  /**
   * Sets or updates a workspace budget guard policy.
   * Enforces Rule 60 emergency dead-man pause and emits domain event.
   */
  public async setPolicy(
    input: Omit<CostBudgetPolicy, 'id' | 'updatedAt'>
  ): Promise<CostBudgetPolicy> {
    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        throw new CostDomainError(
          COST_ERROR_CODES.COST_DEAD_MAN_PAUSED,
          'Policy modification paused by emergency dead-man control',
          503
        );
      }
      throw err;
    }

    const policyId = `bpol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const updatedAt = new Date().toISOString();

    const policy = CostBudgetPolicySchema.parse({
      ...input,
      id: policyId,
      updatedAt,
    });

    const key = this.getPolicyKey(policy.organizationId, policy.workspaceId);
    this.policies.set(key, policy);

    // Emit domain event for real-time reactivity (Rule 40)
    const event = createDomainEvent({
      type: 'cost.budget.policy_updated',
      organizationId: policy.organizationId,
      workspaceId: policy.workspaceId,
      actor: {
        type: 'user',
        id: policy.updatedByUserId,
      },
      entity: {
        type: 'budget_policy',
        id: policy.id,
      },
      correlationId: `bpol_corr_${Date.now()}`,
      source: 'cost.budget_guard_service',
      payload: {
        allocatedBudgetMicroUSD: policy.allocatedBudgetMicroUSD,
        softAlertThresholdPercent: policy.softAlertThresholdPercent,
        hardCapAction: policy.hardCapAction,
        budgetPeriod: policy.budgetPeriod,
        updatedAt: policy.updatedAt,
      },
    });

    try {
      await defaultEventBus.publish(event);
    } catch {
      // Non-fatal event dispatch failure
    }

    return policy;
  }

  /**
   * Retrieves configured budget policy for a workspace.
   */
  public async getPolicy(
    organizationId: string,
    workspaceId: string
  ): Promise<CostBudgetPolicy | null> {
    const key = this.getPolicyKey(organizationId, workspaceId);
    return this.policies.get(key) ?? null;
  }

  /**
   * Evaluates current budget spend and returns utilization status.
   */
  public async checkBudget(
    organizationId: string,
    workspaceId: string,
    _personaId?: string
  ): Promise<BudgetStatusResult> {
    const policy = await this.getPolicy(organizationId, workspaceId);

    if (!policy) {
      return {
        isExceeded: false,
        isSoftLimitReached: false,
        utilizationPercent: 0,
        remainingBudgetMicroUSD: Number.MAX_SAFE_INTEGER,
        hardCapAction: 'HALT',
      };
    }

    const accounting = getTokenCostAccountingService();
    const currentSpend = await accounting.getWorkspaceTotalSpendMicroUSD(
      organizationId,
      workspaceId
    );

    const utilizationPercent = Math.round(
      (currentSpend / policy.allocatedBudgetMicroUSD) * 100
    );
    const isExceeded = currentSpend >= policy.allocatedBudgetMicroUSD;
    const isSoftLimitReached = utilizationPercent >= policy.softAlertThresholdPercent;
    const remainingBudgetMicroUSD = Math.max(0, policy.allocatedBudgetMicroUSD - currentSpend);

    // Emit soft threshold alert if reached and not yet completely exceeded
    if (isSoftLimitReached && !isExceeded) {
      const event = createDomainEvent({
        type: 'cost.budget.soft_limit_reached',
        organizationId,
        workspaceId,
        actor: {
          type: 'system',
          id: 'budget_guard',
        },
        entity: {
          type: 'budget_policy',
          id: policy.id,
        },
        correlationId: `alert_corr_${Date.now()}`,
        source: 'cost.budget_guard_service',
        payload: {
          utilizationPercent,
          currentSpendMicroUSD: currentSpend,
          allocatedBudgetMicroUSD: policy.allocatedBudgetMicroUSD,
          remainingBudgetMicroUSD,
        },
      });

      try {
        await defaultEventBus.publish(event);
      } catch {
        // Non-fatal
      }
    }

    return {
      isExceeded,
      isSoftLimitReached,
      utilizationPercent,
      remainingBudgetMicroUSD,
      hardCapAction: policy.hardCapAction,
      policy,
    };
  }

  /**
   * Asserts that budget is available for execution, triggering circuit breaker if exhausted (Rule 23).
   */
  public async assertBudgetAvailable(
    organizationId: string,
    workspaceId: string,
    personaId?: string
  ): Promise<void> {
    const status = await this.checkBudget(organizationId, workspaceId, personaId);

    if (!status.isExceeded) {
      return;
    }

    if (status.hardCapAction === 'HALT') {
      throw new CostDomainError(
        COST_ERROR_CODES.COST_BUDGET_EXCEEDED,
        `Budget allocation exhausted for workspace (${status.utilizationPercent}% utilized). Execution halted by circuit breaker.`,
        403,
        {
          utilizationPercent: status.utilizationPercent,
          remainingBudgetMicroUSD: status.remainingBudgetMicroUSD,
          hardCapAction: 'HALT',
        }
      );
    }

    if (status.hardCapAction === 'REQUIRE_APPROVAL') {
      throw new CostDomainError(
        COST_ERROR_CODES.COST_BUDGET_EXCEEDED,
        `Budget threshold reached (${status.utilizationPercent}% utilized). Operation requires manager approval.`,
        403,
        {
          requireApproval: true,
          utilizationPercent: status.utilizationPercent,
          hardCapAction: 'REQUIRE_APPROVAL',
        }
      );
    }

    // If hardCapAction === 'DEGRADE_TIER', allow caller to proceed under degraded model routing
  }

  /**
   * Resets in-memory policies for testing.
   */
  public resetForTesting(): void {
    this.policies.clear();
  }
}

// Global HMR singleton preservation (Rule 69)
declare global {
  // eslint-disable-next-line no-var
  var __smartsappBudgetGuardService: BudgetGuardService | undefined;
}

export function getBudgetGuardService(): BudgetGuardService {
  if (!globalThis.__smartsappBudgetGuardService) {
    globalThis.__smartsappBudgetGuardService = new BudgetGuardService();
  }
  return globalThis.__smartsappBudgetGuardService;
}
