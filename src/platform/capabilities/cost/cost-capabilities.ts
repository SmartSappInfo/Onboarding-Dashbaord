/**
 * @fileOverview Canonical Cost Domain Capabilities (cost.*) (Phase 15 Milestone 2)
 *
 * Implements Rules 1, 4, 8, 11, 12, 14, 16, 17, 19, 23, 27, 40, 47, 48, 57, 58, 60, 67, 68, 69.
 * Provides canonical capability layer endpoints for:
 * 1. `cost.record_usage` (L0_READ)
 * 2. `cost.get_metrics` (L0_READ)
 * 3. `cost.route_model` (L0_READ)
 * 4. `cost.check_budget` (L0_READ)
 * 5. `cost.set_budget_policy` (L2_STATE_MUTATION, Non-Delegable, Rule 17)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import {
  type CapabilityDefinition,
  type CapabilityExecutionContext,
  type CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from '../registry/capability-registry';
import {
  TokenUsageRecord,
  TokenUsageRecordSchema,
  CostAccountingMetrics,
  CostAccountingMetricsSchema,
  ModelRoutingInput,
  ModelRoutingInputSchema,
  ModelRoutingDecision,
  ModelRoutingDecisionSchema,
  CostBudgetPolicy,
  CostBudgetPolicySchema,
  ModelProviderSchema,
  ModelTierSchema,
  BudgetPeriodSchema,
  HardCapActionSchema,
  COST_ERROR_CODES,
  CostDomainError,
} from '@/platform/cost/contracts/cost-types';
import { getTokenCostAccountingService } from '@/platform/cost/services/token-cost-accounting-service';
import { getDynamicModelRouter } from '@/platform/cost/routing/dynamic-model-router';
import {
  getBudgetGuardService,
  BudgetStatusResult,
} from '@/platform/cost/services/budget-guard-service';

/**
 * Validates caller tenant context against target organization (Rules 8 & 47).
 */
function assertTenantContext(
  context: CapabilityExecutionContext,
  organizationId: string
): void {
  if (
    context.principal.organizationId &&
    context.principal.organizationId !== organizationId
  ) {
    throw new CostDomainError(
      COST_ERROR_CODES.COST_IDOR_VIOLATION,
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId})`,
      403
    );
  }
}

// ============================================================================
// 1. cost.record_usage (L0_READ)
// ============================================================================

export const RecordUsageCapabilityInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  personaId: z.string().min(1),
  executionId: z.string().min(1),
  modelId: z.string().min(1),
  provider: ModelProviderSchema,
  tier: ModelTierSchema,
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  cachedPromptTokens: z.number().int().nonnegative().optional(),
  costMicroUSD: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type RecordUsageCapabilityInput = z.infer<typeof RecordUsageCapabilityInputSchema>;

export const RecordUsageCapability: CapabilityDefinition<
  RecordUsageCapabilityInput,
  TokenUsageRecord
> = {
  id: 'cost.record_usage',
  version: '1.0.0',
  name: 'Record Token Usage',
  description:
    'Appends token spend record to workspace ledger using exact integer micro-USD computation.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: RecordUsageCapabilityInputSchema,
  outputSchema: TokenUsageRecordSchema,
  permissions: ['cost:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: RecordUsageCapabilityInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<TokenUsageRecord>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getTokenCostAccountingService();
    const record = await service.recordUsage(input);

    return {
      success: true,
      data: record,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 2. cost.get_metrics (L0_READ)
// ============================================================================

export const GetCostMetricsCapabilityInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  personaId: z.string().optional(),
});

export type GetCostMetricsCapabilityInput = z.infer<typeof GetCostMetricsCapabilityInputSchema>;

export const GetCostMetricsCapability: CapabilityDefinition<
  GetCostMetricsCapabilityInput,
  CostAccountingMetrics
> = {
  id: 'cost.get_metrics',
  version: '1.0.0',
  name: 'Get Cost Accounting Metrics',
  description:
    'Returns total spend, tokens, and breakdowns by provider, tier, and persona in micro-USD.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: GetCostMetricsCapabilityInputSchema,
  outputSchema: CostAccountingMetricsSchema,
  permissions: ['cost:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 15000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: GetCostMetricsCapabilityInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<CostAccountingMetrics>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getTokenCostAccountingService();
    const metrics = await service.getMetrics(input.organizationId, input.workspaceId, {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      personaId: input.personaId,
    });

    return {
      success: true,
      data: metrics,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 3. cost.route_model (L0_READ)
// ============================================================================

export const RouteModelCapability: CapabilityDefinition<
  ModelRoutingInput,
  ModelRoutingDecision
> = {
  id: 'cost.route_model',
  version: '1.0.0',
  name: 'Route Model Dynamically',
  description:
    'Selects optimal model tier, primary model, and ordered fallback models across providers.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: ModelRoutingInputSchema,
  outputSchema: ModelRoutingDecisionSchema,
  permissions: ['cost:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: ModelRoutingInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ModelRoutingDecision>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const router = getDynamicModelRouter();
    const decision = await router.routeModel(input);

    return {
      success: true,
      data: decision,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 4. cost.check_budget (L0_READ)
// ============================================================================

export const CheckBudgetCapabilityInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  personaId: z.string().optional(),
});

export type CheckBudgetCapabilityInput = z.infer<typeof CheckBudgetCapabilityInputSchema>;

export const CheckBudgetCapabilityOutputSchema = z.object({
  isExceeded: z.boolean(),
  isSoftLimitReached: z.boolean(),
  utilizationPercent: z.number(),
  remainingBudgetMicroUSD: z.number(),
  hardCapAction: HardCapActionSchema,
  policy: CostBudgetPolicySchema.optional(),
});

export const CheckBudgetCapability: CapabilityDefinition<
  CheckBudgetCapabilityInput,
  BudgetStatusResult
> = {
  id: 'cost.check_budget',
  version: '1.0.0',
  name: 'Check Budget Status',
  description: 'Evaluates utilization percent, soft limit alerts, and hard-cap boundaries.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: CheckBudgetCapabilityInputSchema,
  outputSchema: CheckBudgetCapabilityOutputSchema,
  permissions: ['cost:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: CheckBudgetCapabilityInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<BudgetStatusResult>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const guard = getBudgetGuardService();
    const status = await guard.checkBudget(input.organizationId, input.workspaceId, input.personaId);

    return {
      success: true,
      data: status,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 5. cost.set_budget_policy (L2_STATE_MUTATION, Non-Delegable, Rule 17)
// ============================================================================

export const SetBudgetPolicyCapabilityInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  personaId: z.string().optional(),
  budgetPeriod: BudgetPeriodSchema,
  allocatedBudgetMicroUSD: z.number().int().positive(),
  softAlertThresholdPercent: z.number().int().min(1).max(100).default(80),
  hardCapAction: HardCapActionSchema.default('HALT'),
  updatedByUserId: z.string().min(1),
});

export type SetBudgetPolicyCapabilityInput = z.infer<typeof SetBudgetPolicyCapabilityInputSchema>;

export const SetBudgetPolicyCapability: CapabilityDefinition<
  SetBudgetPolicyCapabilityInput,
  CostBudgetPolicy
> = {
  id: 'cost.set_budget_policy',
  version: '1.0.0',
  name: 'Set Budget Policy',
  description:
    'Sets spending ceilings, alert thresholds, and circuit-breaker behavior (HALT, DEGRADE_TIER, REQUIRE_APPROVAL). Non-delegable to agents (Rule 17).',
  domain: 'ai_governance',
  operation: 'update',
  inputSchema: SetBudgetPolicyCapabilityInputSchema,
  outputSchema: CostBudgetPolicySchema,
  permissions: ['cost:manage'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: true,
    nonDelegable: true,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 15000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: true,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: SetBudgetPolicyCapabilityInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<CostBudgetPolicy>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    // Rule 17 Non-Delegable Enforcement: Agents cannot modify budget policies
    if (context.principal.actorType === 'agent') {
      throw new CostDomainError(
        COST_ERROR_CODES.COST_UNAUTHORIZED_MUTATION,
        'Non-delegable action: Agents and subagents are strictly forbidden from modifying budget policies (Rule 17)',
        403
      );
    }

    const guard = getBudgetGuardService();
    const policy = await guard.setPolicy(input);

    return {
      success: true,
      data: policy,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// Register all capabilities in CapabilityRegistry
registerCapability(RecordUsageCapability);
registerCapability(GetCostMetricsCapability);
registerCapability(RouteModelCapability);
registerCapability(CheckBudgetCapability);
registerCapability(SetBudgetPolicyCapability);
