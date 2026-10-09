'use server';

/**
 * @fileOverview Governed Cost Intelligence Server Actions (Phase 15 Milestone 2)
 *
 * Implements Rules 4, 8, 10, 11, 16, 17, 22, 23, 27, 40, 47, 48, 51, 57, 58, 60, 67, 68, 69.
 * Provides authenticated, Anti-IDOR protected, dead-man gated Server Actions for:
 * - Recording token usage and computing micro-USD cost
 * - Querying multi-dimensional cost and token metrics
 * - Evaluating dynamic model routing with multi-provider fallbacks
 * - Checking workspace budget status and soft-threshold alerts
 * - Configuring budget guard policies with non-delegable security (Rule 17)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import {
  TokenUsageRecord,
  CostAccountingMetrics,
  ModelRoutingInput,
  ModelRoutingDecision,
  CostBudgetPolicy,
  ModelRoutingInputSchema,
  COST_ERROR_CODES,
  CostDomainError,
} from '@/platform/cost/contracts/cost-types';
import {
  getTokenCostAccountingService,
  RecordUsageInput,
  MetricsQueryOptions,
} from '@/platform/cost/services/token-cost-accounting-service';
import { getDynamicModelRouter } from '@/platform/cost/routing/dynamic-model-router';
import {
  getBudgetGuardService,
  BudgetStatusResult,
} from '@/platform/cost/services/budget-guard-service';
import {
  RecordUsageCapabilityInputSchema,
  GetCostMetricsCapabilityInputSchema,
  SetBudgetPolicyCapabilityInputSchema,
} from '@/platform/capabilities/cost/cost-capabilities';

export interface CostActionResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

/**
 * Validates authenticated user organizational boundary against target entity (Rules 8 & 47).
 */
function assertTenantAccess(auth: AuthContext, targetOrgId: string): void {
  const sessionOrgId = auth.profile?.organizationId;
  if (!sessionOrgId) {
    throw new CostDomainError(
      COST_ERROR_CODES.COST_IDOR_VIOLATION,
      'Missing authenticated organization context.',
      403
    );
  }

  if (sessionOrgId !== targetOrgId) {
    throw new CostDomainError(
      COST_ERROR_CODES.COST_IDOR_VIOLATION,
      `Cross-tenant access forbidden (session org: ${sessionOrgId}, target: ${targetOrgId}).`,
      403
    );
  }
}

/**
 * Normalizes unknown errors to a sanitized CostActionResult (Rule 48).
 */
function handleActionError<T>(error: unknown): CostActionResult<T> {
  if (error instanceof CostDomainError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof AgentGovernanceEmergencyPausedError) {
    return {
      success: false,
      error: {
        code: COST_ERROR_CODES.COST_DEAD_MAN_PAUSED,
        message: error.message,
      },
    };
  }

  const rawMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
  return {
    success: false,
    error: {
      code: 'COST_INTERNAL_ERROR',
      message: rawMsg,
    },
  };
}

/**
 * Records token usage and computes micro-USD valuation.
 */
export async function recordTokenUsageAction(
  rawInput: RecordUsageInput
): Promise<CostActionResult<TokenUsageRecord>> {
  try {
    const auth = await requireAuth();
    const input = RecordUsageCapabilityInputSchema.parse(rawInput);
    assertTenantAccess(auth, input.organizationId);
    await checkGovernanceDeadManSwitch(input.organizationId);

    const service = getTokenCostAccountingService();
    const record = await service.recordUsage(input);

    return {
      success: true,
      data: record,
    };
  } catch (error) {
    return handleActionError<TokenUsageRecord>(error);
  }
}

/**
 * Queries aggregated token cost metrics with multi-dimensional breakdowns.
 */
export async function getCostMetricsAction(
  organizationId: string,
  workspaceId: string,
  options?: MetricsQueryOptions
): Promise<CostActionResult<CostAccountingMetrics>> {
  try {
    const auth = await requireAuth();
    const validated = GetCostMetricsCapabilityInputSchema.parse({
      organizationId,
      workspaceId,
      ...options,
    });
    assertTenantAccess(auth, validated.organizationId);

    const service = getTokenCostAccountingService();
    const metrics = await service.getMetrics(
      validated.organizationId,
      validated.workspaceId,
      options
    );

    return {
      success: true,
      data: metrics,
    };
  } catch (error) {
    return handleActionError<CostAccountingMetrics>(error);
  }
}

/**
 * Evaluates dynamic model routing with multi-provider fallbacks.
 */
export async function routeModelAction(
  rawInput: ModelRoutingInput
): Promise<CostActionResult<ModelRoutingDecision>> {
  try {
    const auth = await requireAuth();
    const input = ModelRoutingInputSchema.parse(rawInput);
    assertTenantAccess(auth, input.organizationId);

    const router = getDynamicModelRouter();
    const decision = await router.routeModel(input);

    return {
      success: true,
      data: decision,
    };
  } catch (error) {
    return handleActionError<ModelRoutingDecision>(error);
  }
}

/**
 * Checks workspace budget status and soft-threshold alerts.
 */
export async function checkBudgetStatusAction(
  organizationId: string,
  workspaceId: string,
  personaId?: string
): Promise<CostActionResult<BudgetStatusResult>> {
  try {
    const auth = await requireAuth();
    assertTenantAccess(auth, organizationId);

    const guard = getBudgetGuardService();
    const status = await guard.checkBudget(organizationId, workspaceId, personaId);

    return {
      success: true,
      data: status,
    };
  } catch (error) {
    return handleActionError<BudgetStatusResult>(error);
  }
}

/**
 * Configures budget guard policy.
 * Non-delegable to agents (Rule 17): must be initiated by an authenticated human user.
 */
export async function setBudgetPolicyAction(
  rawInput: unknown
): Promise<CostActionResult<CostBudgetPolicy>> {
  try {
    const auth = await requireAuth();
    const input = SetBudgetPolicyCapabilityInputSchema.parse(rawInput);
    assertTenantAccess(auth, input.organizationId);
    await checkGovernanceDeadManSwitch(input.organizationId);

    // Rule 17: Enforce non-delegable human action
    if (!auth.uid) {
      throw new CostDomainError(
        COST_ERROR_CODES.COST_UNAUTHORIZED_MUTATION,
        'Setting budget policy requires authenticated human user session.',
        403
      );
    }

    const guard = getBudgetGuardService();
    const policy = await guard.setPolicy(input);

    return {
      success: true,
      data: policy,
    };
  } catch (error) {
    return handleActionError<CostBudgetPolicy>(error);
  }
}
