/**
 * @fileOverview Governance Contracts, Zod Schemas & Error Taxonomy (Rules 4, 19, 20, 23, 26, 27, 28, 48, 56)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 19: Mandatory idempotency keys for compensating steps (`saga_comp_${stepId}`).
 * - Rule 20: Distributed tracing correlation propagation (`correlationId`, `traceId`, `spanId`).
 * - Rule 23: Multi-dimensional resource budgets (tokens, tool calls, duration, mutated records).
 * - Rule 26: Cooperative cancellation contracts and token state.
 * - Rule 27: Formal Saga compensation state and rollback result contracts.
 * - Rule 28 & 56: Knapsack context compression types.
 * - Rule 48: Sanitized error taxonomy (`GOVERNANCE_ERROR_CODES`).
 */

import { z } from 'zod/v4';
import {
  AgentRunBudgetUsageSchema,
} from '../agent-run-types';

export const GOVERNANCE_ERROR_CODES = [
  'BUDGET_EXCEEDED',
  'RUN_CANCELLED',
  'COMPENSATION_FAILED',
  'CONTEXT_OVERFLOW',
  'DATA_EXFILTRATION_BLOCKED',
  'DEAD_MAN_PAUSED',
  'INVALID_GOVERNANCE_INPUT',
] as const;

export type GovernanceErrorCode = (typeof GOVERNANCE_ERROR_CODES)[number];

export interface GovernanceErrorDetails {
  readonly code: GovernanceErrorCode;
  readonly message: string;
  readonly runId?: string;
  readonly stepId?: string;
  readonly organizationId?: string;
  readonly details?: Record<string, unknown>;
}

export class GovernanceError extends Error {
  readonly code: GovernanceErrorCode;
  readonly runId?: string;
  readonly stepId?: string;
  readonly organizationId?: string;
  readonly details?: Record<string, unknown>;

  constructor(opts: GovernanceErrorDetails) {
    super(`[Governance:${opts.code}] ${opts.message}`);
    this.name = 'GovernanceError';
    this.code = opts.code;
    this.runId = opts.runId;
    this.stepId = opts.stepId;
    this.organizationId = opts.organizationId;
    this.details = opts.details;
    Object.setPrototypeOf(this, GovernanceError.prototype);
  }
}

// ============================================================================
// 1. BUDGET CHECKING & USAGE SCHEMAS (Rule 23 & Rule 54)
// ============================================================================

export const RemainingBudgetsSchema = z.object({
  maxTokens: z.number().int().min(0),
  maxToolCalls: z.number().int().min(0),
  maxDurationMs: z.number().int().min(0),
  maxRecordsMutated: z.number().int().min(0),
  maxFinancialAmount: z.number().min(0),
  maxDelegationDepth: z.number().int().min(0),
});

export type RemainingBudgets = z.infer<typeof RemainingBudgetsSchema>;

export const BudgetCheckResultSchema = z.object({
  allowed: z.boolean(),
  breachedDimensions: z.array(z.string()).default([]),
  currentUsage: AgentRunBudgetUsageSchema,
  remainingBudgets: RemainingBudgetsSchema,
  rejectionReason: z.string().optional(),
  traceId: z.string().optional(),
  correlationId: z.string().optional(),
});

export type BudgetCheckResult = z.infer<typeof BudgetCheckResultSchema>;

export const RecordUsageDeltaSchema = z.object({
  tokensUsed: z.number().int().min(0).default(0),
  toolCallsExecuted: z.number().int().min(0).default(0),
  durationMs: z.number().int().min(0).default(0),
  recordsMutated: z.number().int().min(0).default(0),
  financialAmount: z.number().min(0).default(0),
});

export type RecordUsageDelta = z.infer<typeof RecordUsageDeltaSchema>;

// ============================================================================
// 2. CANCELLATION SCHEMAS (Rule 26)
// ============================================================================

export const CancellationReasonSchema = z.object({
  requestedBy: z.string().min(1),
  reason: z.string().min(1),
  timestamp: z.string().datetime(),
  immediate: z.boolean().default(false),
  triggerSagaCompensation: z.boolean().default(true),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
});

export type CancellationReason = z.infer<typeof CancellationReasonSchema>;

// ============================================================================
// 3. SAGA COMPENSATION SCHEMAS (Rule 19 & Rule 27)
// ============================================================================

export const CompensationStepSchema = z.object({
  stepId: z.string().min(1),
  capabilityId: z.string().min(1),
  compensatingCapabilityId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  compensationArguments: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  error: z.string().optional(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().min(0).optional(),
});

export type CompensationStep = z.infer<typeof CompensationStepSchema>;

export const SagaExecutionResultSchema = z.object({
  success: z.boolean(),
  totalCompensations: z.number().int().min(0),
  completedCompensations: z.number().int().min(0),
  failedCompensations: z.number().int().min(0),
  compensationSteps: z.array(CompensationStepSchema),
  error: z.string().optional(),
  compensatedAt: z.string().datetime(),
  dryRun: z.boolean().default(false),
  requiresOperatorIntervention: z.boolean().default(false),
});

export type SagaExecutionResult = z.infer<typeof SagaExecutionResultSchema>;

// ============================================================================
// 4. CONTEXT COMPRESSOR SCHEMAS (Rule 28, 30, 32, 33, 56)
// ============================================================================

export const CompressContextOptionsSchema = z.object({
  maxTokens: z.number().int().min(500).max(32000).default(4000),
  charsPerToken: z.number().min(1).max(10).default(4.0),
  includeSystemInstructions: z.boolean().default(true),
  preserveRecentStepsCount: z.number().int().min(1).max(10).default(3),
  redactSensitiveData: z.boolean().default(true),
});

export type CompressContextOptions = z.infer<typeof CompressContextOptionsSchema>;

export const CompressedContextResultSchema = z.object({
  xmlPromptContext: z.string().min(1),
  totalTokens: z.number().int().min(0),
  maxTokens: z.number().int().min(0),
  compressedStepCount: z.number().int().min(0),
  retainedStepCount: z.number().int().min(0),
  redactedTokensCount: z.number().int().min(0).default(0),
  compressionRatio: z.number().min(0),
});

export type CompressedContextResult = z.infer<typeof CompressedContextResultSchema>;
