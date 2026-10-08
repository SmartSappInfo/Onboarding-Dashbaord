/**
 * @fileOverview Canonical Saga Compensation Contracts, Types & Error Taxonomy (Phase 14 Milestone 3)
 *
 * Implements Rule 2 (FMEA Failure Analysis), Rule 4 (Strict Typing),
 * Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock), Rule 10 (Inline Architectural Documentation),
 * Rule 11 (Mathematical Determinism), Rule 12 (Risk Vocabulary),
 * Rule 14 (Schema Fingerprinting), Rule 16 (Explicit Scoped RBAC),
 * Rule 17 (Non-Delegable Restrictions), Rule 18 (TOCTOU Defense),
 * Rule 19 (Deterministic Idempotency), Rule 20 (Replay Protection),
 * Rule 21 & 22 (Two-Phase Execution & SHA-256 Digest Tamper Defense),
 * Rule 25 (Dead-Letter and Recovery Queues), Rule 26 (Cooperative Cancellation),
 * Rule 27 (Formal Saga / Compensation Model), Rule 40 (Domain Event Auditing),
 * Rule 41 (Explainability Grid), Rule 42 (Shadow Mode Simulation),
 * Rule 48 (Sanitized Error Taxonomy), Rule 54 (State Machine Invariants),
 * Rule 60 (Emergency Dead-Man Pause Check), Rule 67, 68, 69, 1961.
 */

import { z } from 'zod';
import { ResourceSnapshotSchema, type ResourceSnapshot } from '../concurrency/state-version-types';
export { ResourceSnapshotSchema, type ResourceSnapshot };

// ============================================================================
// 1. SAGA STEP STATUS & REVERSIBILITY ENUMS (Rules 12, 54)
// ============================================================================

export const SagaStepStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'COMPENSATING',
  'COMPENSATED',
  'FAILED',
  'SKIPPED',
  'IRREVERSIBLE',
  'DLQ_QUARANTINED',
]);
export type SagaStepStatus = z.infer<typeof SagaStepStatusSchema>;

export const ReversibilityClassificationSchema = z.enum([
  'REVERSIBLE',
  'PARTIALLY_REVERSIBLE',
  'IRREVERSIBLE',
]);
export type ReversibilityClassification = z.infer<typeof ReversibilityClassificationSchema>;

export const SagaDomainSchema = z.enum([
  'crm',
  'sales',
  'finance',
  'knowledge',
  'meetings',
  'supervisor',
  'platform',
]);
export type SagaDomain = z.infer<typeof SagaDomainSchema>;

// ============================================================================
// 2. UNIVERSAL ROLLBACK MATRIX ENTRY CONTRACT (Rule 27)
// ============================================================================

export const UniversalRollbackEntrySchema = z.object({
  mutatingCapabilityId: z.string().min(1, 'Mutating capability ID is required'),
  compensatingCapabilityId: z.string().min(1, 'Compensating capability ID is required'),
  reversibility: ReversibilityClassificationSchema,
  domain: SagaDomainSchema,
  description: z.string().optional(),
  requiresManualReview: z.boolean().default(false),
});
export type UniversalRollbackEntry = z.infer<typeof UniversalRollbackEntrySchema>;

// ============================================================================
// 3. SAGA STEP EXECUTION RECORD (Rules 18, 21, 22, 27)
// ============================================================================

export const SagaStepExecutionRecordSchema = z.object({
  stepId: z.string().min(1, 'Step ID is required'),
  stepIndex: z.number().int().nonnegative('Step index must be a non-negative integer'),
  runId: z.string().min(1, 'Run ID is required'),
  capabilityId: z.string().min(1, 'Capability ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  actorId: z.string().min(1, 'Actor ID is required'),
  actorType: z.enum(['user', 'agent', 'system']).optional(),
  domain: z.string().optional(),
  actionType: z.string().optional(),
  inputPayload: z.record(z.string(), z.unknown()),
  outputPayload: z.record(z.string(), z.unknown()).optional(),
  preStateSnapshot: ResourceSnapshotSchema.optional(),
  postStateSnapshot: ResourceSnapshotSchema.optional(),
  status: SagaStepStatusSchema,
  compensatingCapabilityId: z.string().optional(),
  compensatingPayload: z.record(z.string(), z.unknown()).optional(),
  compensationError: z.string().optional(),
  dlqEntryId: z.string().optional(),
  executedAt: z.string().datetime({ message: 'executedAt must be an ISO 8601 datetime' }),
  compensatedAt: z.string().datetime({ message: 'compensatedAt must be an ISO 8601 datetime' }).optional(),
});
export type SagaStepExecutionRecord = z.infer<typeof SagaStepExecutionRecordSchema>;

// ============================================================================
// 4. SAGA EXECUTION LEDGER CONTRACT (Rules 20, 22, 50)
// ============================================================================

export const SagaLedgerStatusSchema = z.enum([
  'RUNNING',
  'COMPLETED',
  'COMPENSATING',
  'COMPENSATED',
  'FAILED_PARTIAL',
  'FAILED_DLQ',
]);
export type SagaLedgerStatus = z.infer<typeof SagaLedgerStatusSchema>;

export const SagaExecutionLedgerSchema = z.object({
  runId: z.string().min(1, 'Run ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  actorId: z.string().min(1, 'Actor ID is required'),
  status: SagaLedgerStatusSchema,
  steps: z.array(SagaStepExecutionRecordSchema),
  createdAt: z.string().datetime({ message: 'createdAt must be an ISO 8601 datetime' }),
  updatedAt: z.string().datetime({ message: 'updatedAt must be an ISO 8601 datetime' }),
  ledgerHash: z.string().length(64).optional(),
});
export type SagaExecutionLedger = z.infer<typeof SagaExecutionLedgerSchema>;

/**
 * Nominal alias for SagaExecutionLedgerSchema per Phase 14 Master Plan
 */
export const SagaExecutionPlanSchema = SagaExecutionLedgerSchema;
export type SagaExecutionPlan = SagaExecutionLedger;

// ============================================================================
// 5. SAGA COMPENSATION RESULT CONTRACT (Rules 11, 25, 41)
// ============================================================================

export const SagaCompensationStatusSchema = z.enum([
  'SUCCESS',
  'PARTIAL_COMPENSATION',
  'DLQ_ROUTED',
  'FAILED',
]);
export type SagaCompensationStatus = z.infer<typeof SagaCompensationStatusSchema>;

export const SagaCompensationResultSchema = z.object({
  runId: z.string().min(1, 'Run ID is required'),
  status: SagaCompensationStatusSchema,
  totalStepsCount: z.number().int().nonnegative(),
  compensatedStepsCount: z.number().int().nonnegative(),
  skippedStepsCount: z.number().int().nonnegative(),
  failedCompensationsCount: z.number().int().nonnegative(),
  dlqEnqueuedCount: z.number().int().nonnegative(),
  dlqEntryIds: z.array(z.string()),
  durationMs: z.number().nonnegative(),
  compensatedAt: z.string().datetime({ message: 'compensatedAt must be an ISO 8601 datetime' }),
  explainabilityGrid: z.object({
    what: z.string(),
    why: z.string(),
    expectedStateChange: z.string(),
    residualRisk: z.string(),
  }),
  dryRun: z.boolean().default(false),
});
export type SagaCompensationResult = z.infer<typeof SagaCompensationResultSchema>;

// ============================================================================
// 6. ACTION INPUT CONTRACTS
// ============================================================================

export const CompensateRunInputSchema = z.object({
  runId: z.string().min(1, 'Run ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  reason: z.string().min(1, 'Compensation reason is required'),
  dryRun: z.boolean().optional().default(false),
});
export type CompensateRunInput = z.input<typeof CompensateRunInputSchema>;

export const RecordSagaStepInputSchema = z.object({
  stepId: z.string().optional(),
  runId: z.string().min(1, 'Run ID is required'),
  stepIndex: z.number().int().nonnegative(),
  capabilityId: z.string().min(1, 'Capability ID is required'),
  domain: z.string().optional(),
  actionType: z.enum(['create', 'update', 'delete', 'custom']).optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  actorId: z.string().min(1, 'Actor ID is required'),
  actorType: z.enum(['user', 'agent', 'system']).optional().default('user'),
  inputPayload: z.record(z.string(), z.unknown()),
  outputPayload: z.record(z.string(), z.unknown()).optional(),
  preStateSnapshot: ResourceSnapshotSchema.optional(),
  postStateSnapshot: ResourceSnapshotSchema.optional(),
  status: SagaStepStatusSchema.optional().default('COMPLETED'),
});
export type RecordSagaStepInput = z.input<typeof RecordSagaStepInputSchema>;

// ============================================================================
// 7. ERROR TAXONOMY & STATUS MAPPINGS (Rule 48)
// ============================================================================

export const SAGA_ERROR_CODES = {
  SAGA_RUN_NOT_FOUND: 'SAGA_RUN_NOT_FOUND',
  SAGA_STEP_NOT_FOUND: 'SAGA_STEP_NOT_FOUND',
  SAGA_STEP_COMPENSATION_FAILED: 'SAGA_STEP_COMPENSATION_FAILED',
  SAGA_IRREVERSIBLE_STEP: 'SAGA_IRREVERSIBLE_STEP',
  SAGA_CONCURRENCY_DRIFT: 'SAGA_CONCURRENCY_DRIFT',
  SAGA_DEAD_MAN_PAUSED: 'SAGA_DEAD_MAN_PAUSED',
  SAGA_TIMEOUT: 'SAGA_TIMEOUT',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  CIRCUIT_BREAKER_TRIPPED: 'CIRCUIT_BREAKER_TRIPPED',
  INVALID_SAGA_INPUT: 'INVALID_SAGA_INPUT',
  INTERNAL_SAGA_ERROR: 'INTERNAL_SAGA_ERROR',
} as const;

export type SagaErrorCode = (typeof SAGA_ERROR_CODES)[keyof typeof SAGA_ERROR_CODES];

export const SAGA_HTTP_STATUS_MAP: Readonly<Record<SagaErrorCode, number>> = {
  [SAGA_ERROR_CODES.SAGA_RUN_NOT_FOUND]: 404,
  [SAGA_ERROR_CODES.SAGA_STEP_NOT_FOUND]: 404,
  [SAGA_ERROR_CODES.SAGA_STEP_COMPENSATION_FAILED]: 500,
  [SAGA_ERROR_CODES.SAGA_IRREVERSIBLE_STEP]: 400,
  [SAGA_ERROR_CODES.SAGA_CONCURRENCY_DRIFT]: 409,
  [SAGA_ERROR_CODES.SAGA_DEAD_MAN_PAUSED]: 503,
  [SAGA_ERROR_CODES.SAGA_TIMEOUT]: 504,
  [SAGA_ERROR_CODES.IDOR_VIOLATION]: 403,
  [SAGA_ERROR_CODES.CIRCUIT_BREAKER_TRIPPED]: 503,
  [SAGA_ERROR_CODES.INVALID_SAGA_INPUT]: 400,
  [SAGA_ERROR_CODES.INTERNAL_SAGA_ERROR]: 500,
};

export class SagaCompensationError extends Error {
  public readonly code: SagaErrorCode;
  public readonly statusCode: number;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: SagaErrorCode,
    message: string,
    statusCode?: number,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'SagaCompensationError';
    this.code = code;
    this.statusCode = statusCode ?? SAGA_HTTP_STATUS_MAP[code] ?? 500;
    this.details = details;
    Object.setPrototypeOf(this, SagaCompensationError.prototype);
  }
}
