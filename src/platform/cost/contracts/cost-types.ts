/**
 * @fileOverview Canonical Cost Contracts, Schemas, Error Taxonomy & Governance Matrices (Phase 15 Milestone 2)
 *
 * Implements Rules 1, 4, 8, 11, 12, 14, 16, 17, 22, 23, 27, 40, 48, 57, 58, 60, 67, 68, 69,
 * and Rules 1940-1953 (The 4 Mandatory Governance Matrices).
 *
 * Provides the single source of truth for:
 * 1. Integer Micro-USD Token Accounting ($1 USD = 1,000,000 micro-USD)
 * 2. Multi-Tier Dynamic Model Routing Schemas
 * 3. Proactive Budget Guard Policies
 * 4. The 4 Mandatory Cost Governance Matrices
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. Constants & Canonical Identifiers (Rule 11 & Rule 58)
// ============================================================================

/**
 * Exact micro-USD multiplier ($1 USD = 1,000,000 micro-USD).
 * Guarantees zero floating-point calculation drift across accounting and billing.
 */
export const MICRO_USD_PER_USD = 1_000_000;

/**
 * 4 Canonical AI Model Providers supported by the platform.
 */
export const MODEL_PROVIDERS = ['anthropic', 'openai', 'google', 'deepseek'] as const;
export type ModelProvider = (typeof MODEL_PROVIDERS)[number];
export const ModelProviderSchema = z.enum(MODEL_PROVIDERS);

/**
 * 3 Canonical Model Routing Tiers balancing performance, reasoning, and cost.
 */
export const MODEL_TIERS = [
  'TIER_1_LOW_COST',
  'TIER_2_GENERAL_REASONING',
  'TIER_3_HIGH_END',
] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];
export const ModelTierSchema = z.enum(MODEL_TIERS);

/**
 * Task complexity categories for routing decisions.
 */
export const TASK_COMPLEXITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TaskComplexity = (typeof TASK_COMPLEXITIES)[number];
export const TaskComplexitySchema = z.enum(TASK_COMPLEXITIES);

/**
 * Capability Risk Levels (aligned with platform identity ceiling, Rule 12).
 */
export const CAPABILITY_RISK_LEVELS = [
  'L0_READ',
  'L1_INTERNAL_DRAFT',
  'L2_STATE_MUTATION',
  'L3_EXTERNAL_COMMUNICATION_FINANCE',
  'L4_PRIVILEGED_DESTRUCTIVE',
] as const;
export type CapabilityRiskLevel = (typeof CAPABILITY_RISK_LEVELS)[number];
export const CapabilityRiskLevelSchema = z.enum(CAPABILITY_RISK_LEVELS);

/**
 * Budget periods for proactive guard policies.
 */
export const BUDGET_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];
export const BudgetPeriodSchema = z.enum(BUDGET_PERIODS);

/**
 * Hard-cap actions triggered upon 100% budget exhaustion (Rule 23).
 */
export const HARD_CAP_ACTIONS = ['HALT', 'DEGRADE_TIER', 'REQUIRE_APPROVAL'] as const;
export type HardCapAction = (typeof HARD_CAP_ACTIONS)[number];
export const HardCapActionSchema = z.enum(HARD_CAP_ACTIONS);

// ============================================================================
// 2. Canonical Contracts & Schemas
// ============================================================================

/**
 * Canonical Pricing Card for a registered model with exact integer rates.
 */
export const ModelPricingCardSchema = z.object({
  modelId: z.string().min(1),
  provider: ModelProviderSchema,
  tier: ModelTierSchema,
  inputRatePerMillionMicroUSD: z.number().int().nonnegative(),
  outputRatePerMillionMicroUSD: z.number().int().nonnegative(),
  cachedInputRatePerMillionMicroUSD: z.number().int().nonnegative(),
  contextWindowTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  supportsStructuredOutput: z.boolean(),
  supportsPromptCaching: z.boolean(),
  isDefaultInTier: z.boolean().default(false),
});
export type ModelPricingCard = z.infer<typeof ModelPricingCardSchema>;

/**
 * Immutable token usage record for a single LLM execution step.
 */
export const TokenUsageRecordSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  personaId: z.string().min(1),
  executionId: z.string().min(1),
  modelId: z.string().min(1),
  provider: ModelProviderSchema,
  tier: ModelTierSchema,
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  cachedPromptTokens: z.number().int().nonnegative().default(0),
  costMicroUSD: z.number().int().nonnegative(),
  recordedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.string()).optional(),
});
export type TokenUsageRecord = z.infer<typeof TokenUsageRecordSchema>;

/**
 * Budget guard policy defining allocations and alert/hard-cap boundaries (Rule 23).
 */
export const CostBudgetPolicySchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  personaId: z.string().optional(),
  budgetPeriod: BudgetPeriodSchema,
  allocatedBudgetMicroUSD: z.number().int().positive(),
  softAlertThresholdPercent: z.number().int().min(1).max(100).default(80),
  hardCapAction: HardCapActionSchema.default('HALT'),
  updatedByUserId: z.string().min(1),
  updatedAt: z.string().datetime(),
});
export type CostBudgetPolicy = z.infer<typeof CostBudgetPolicySchema>;

/**
 * Input parameters for Dynamic Model Router evaluation.
 */
export const ModelRoutingInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  personaId: z.string().min(1),
  taskComplexity: TaskComplexitySchema,
  riskCeiling: CapabilityRiskLevelSchema,
  estimatedInputTokens: z.number().int().nonnegative(),
  maxOutputTokens: z.number().int().nonnegative(),
  latencySlaMs: z.number().int().positive().optional(),
  requireStructuredOutput: z.boolean().default(false),
  requireToolCalling: z.boolean().default(false),
  dataResidency: z.string().optional(),
});
export type ModelRoutingInput = z.infer<typeof ModelRoutingInputSchema>;

/**
 * Output routing decision with primary model, fallbacks, and SHA-256 decision hash.
 */
export const ModelRoutingDecisionSchema = z.object({
  selectedModelId: z.string().min(1),
  selectedProvider: ModelProviderSchema,
  selectedTier: ModelTierSchema,
  estimatedCostMicroUSD: z.number().int().nonnegative(),
  rationale: z.string().min(1),
  fallbackModelIds: z.array(z.string()).min(1),
  decisionHash: z.string().length(64),
  routedAt: z.string().datetime(),
});
export type ModelRoutingDecision = z.infer<typeof ModelRoutingDecisionSchema>;

/**
 * Aggregated cost and token telemetry metrics.
 */
export const CostAccountingMetricsSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalCostMicroUSD: z.number().int().nonnegative(),
  totalPromptTokens: z.number().int().nonnegative(),
  totalCompletionTokens: z.number().int().nonnegative(),
  totalCachedPromptTokens: z.number().int().nonnegative(),
  costByProvider: z.record(z.string(), z.number().int().nonnegative()),
  costByTier: z.record(z.string(), z.number().int().nonnegative()),
  costByPersona: z.record(z.string(), z.number().int().nonnegative()),
  totalRequests: z.number().int().nonnegative(),
});
export type CostAccountingMetrics = z.infer<typeof CostAccountingMetricsSchema>;

// ============================================================================
// 3. Error Taxonomy & Typed Domain Error (Rule 48)
// ============================================================================

export const COST_ERROR_CODES = {
  COST_INVALID_PAYLOAD: 'COST_INVALID_PAYLOAD',
  COST_IDOR_VIOLATION: 'COST_IDOR_VIOLATION',
  COST_MODEL_NOT_FOUND: 'COST_MODEL_NOT_FOUND',
  COST_RATE_LIMIT_429: 'COST_RATE_LIMIT_429',
  COST_PROVIDER_ERROR_500: 'COST_PROVIDER_ERROR_500',
  COST_BUDGET_EXCEEDED: 'COST_BUDGET_EXCEEDED',
  COST_DEAD_MAN_PAUSED: 'COST_DEAD_MAN_PAUSED',
  COST_CIRCUIT_BREAKER_OPEN: 'COST_CIRCUIT_BREAKER_OPEN',
  COST_UNAUTHORIZED_MUTATION: 'COST_UNAUTHORIZED_MUTATION',
} as const;

export type CostErrorCode = (typeof COST_ERROR_CODES)[keyof typeof COST_ERROR_CODES];

export class CostDomainError extends Error {
  public readonly code: CostErrorCode;
  public readonly httpStatus: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: CostErrorCode,
    message: string,
    httpStatus: number = 400,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CostDomainError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.context = context;
    Object.setPrototypeOf(this, CostDomainError.prototype);
  }
}

// ============================================================================
// 4. The 4 Mandatory Governance Matrices (Rules 1940-1953)
// ============================================================================

/**
 * 1. COST_PERMISSION_MATRIX:
 * Strictly maps operational personas to allowed cost permissions (Rules 8, 16, 17).
 * Notice: Subagents/personas hold `cost:read` to evaluate routing decisions.
 * Mutating budget policy (`cost:manage`) is strictly non-delegable to agents (Rule 17).
 */
export const COST_PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  crm_agent: ['cost:read'],
  sales_agent: ['cost:read'],
  meeting_intelligence_agent: ['cost:read'],
  knowledge_agent: ['cost:read'],
  billing_analyst: ['cost:read'],
  collections_agent: ['cost:read'],
  reconciliation_agent: ['cost:read'],
  revenue_analyst: ['cost:read'],
  invoice_assistant: ['cost:read'],
  finance_reporter: ['cost:read'],
  school_ops_agent: ['cost:read'],
  attendance_analyst: ['cost:read'],
  fee_collection_agent: ['cost:read'],
  supervisor: ['cost:read'],
  qa_agent: ['cost:read'],
  admin_user: ['cost:read', 'cost:manage'],
};

export function validateCostPersonaPermission(personaId: string, permission: string): boolean {
  const allowed = COST_PERMISSION_MATRIX[personaId];
  if (!allowed) {
    return false;
  }
  return allowed.includes(permission);
}

/**
 * 2. COST_TOOL_MATRIX:
 * Exhaustive inventory of cost domain capabilities, their risk level, idempotency,
 * and non-delegable security flags (Rules 12, 14, 17).
 */
export interface CostToolDescriptor {
  readonly capabilityId: string;
  readonly riskLevel: CapabilityRiskLevel;
  readonly requiresIdempotencyKey: boolean;
  readonly auditRequired: boolean;
  readonly nonDelegable?: boolean;
}

export const COST_TOOL_MATRIX: Readonly<Record<string, CostToolDescriptor>> = {
  'cost.record_usage': {
    capabilityId: 'cost.record_usage',
    riskLevel: 'L0_READ',
    requiresIdempotencyKey: false,
    auditRequired: false,
  },
  'cost.get_metrics': {
    capabilityId: 'cost.get_metrics',
    riskLevel: 'L0_READ',
    requiresIdempotencyKey: false,
    auditRequired: false,
  },
  'cost.route_model': {
    capabilityId: 'cost.route_model',
    riskLevel: 'L0_READ',
    requiresIdempotencyKey: false,
    auditRequired: false,
  },
  'cost.check_budget': {
    capabilityId: 'cost.check_budget',
    riskLevel: 'L0_READ',
    requiresIdempotencyKey: false,
    auditRequired: false,
  },
  'cost.set_budget_policy': {
    capabilityId: 'cost.set_budget_policy',
    riskLevel: 'L2_STATE_MUTATION',
    requiresIdempotencyKey: true,
    auditRequired: true,
    nonDelegable: true,
  },
};

/**
 * 3. COST_FAILURE_MATRIX:
 * Deterministic failure handling and fallback recovery strategies (Rules 2, 24, 48).
 */
export const COST_FAILURE_RECOVERY_STRATEGIES = [
  'FAILOVER_TO_NEXT_PROVIDER',
  'ENFORCE_HARD_CAP_POLICY',
  'CIRCUIT_BREAKER_BACKOFF',
  'FAIL_CLOSED',
  'RETRY_WITH_BACKOFF',
] as const;
export type CostFailureStrategy = (typeof COST_FAILURE_RECOVERY_STRATEGIES)[number];

export const COST_FAILURE_MATRIX: Readonly<Record<CostErrorCode, CostFailureStrategy>> = {
  COST_INVALID_PAYLOAD: 'FAIL_CLOSED',
  COST_IDOR_VIOLATION: 'FAIL_CLOSED',
  COST_MODEL_NOT_FOUND: 'FAILOVER_TO_NEXT_PROVIDER',
  COST_RATE_LIMIT_429: 'FAILOVER_TO_NEXT_PROVIDER',
  COST_PROVIDER_ERROR_500: 'FAILOVER_TO_NEXT_PROVIDER',
  COST_BUDGET_EXCEEDED: 'ENFORCE_HARD_CAP_POLICY',
  COST_DEAD_MAN_PAUSED: 'FAIL_CLOSED',
  COST_CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_BACKOFF',
  COST_UNAUTHORIZED_MUTATION: 'FAIL_CLOSED',
};

export function resolveCostFailureStrategy(code: CostErrorCode | string): CostFailureStrategy {
  if (code in COST_FAILURE_MATRIX) {
    return COST_FAILURE_MATRIX[code as CostErrorCode];
  }
  return 'FAIL_CLOSED';
}

/**
 * 4. COST_ROLLBACK_MATRIX:
 * Saga rollback compensation mapping for mutating capabilities in exact reverse order (Rule 27).
 */
export const COST_ROLLBACK_MATRIX: Readonly<Record<string, string | null>> = {
  'cost.set_budget_policy': 'cost.revert_budget_policy',
  'cost.record_usage': null,
  'cost.get_metrics': null,
  'cost.route_model': null,
  'cost.check_budget': null,
};

export function getCostRollbackCapability(capabilityId: string): string | null {
  return COST_ROLLBACK_MATRIX[capabilityId] ?? null;
}
