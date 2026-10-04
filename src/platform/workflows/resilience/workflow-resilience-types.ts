/**
 * @fileOverview Canonical Workflow Resilience Contracts, Error Taxonomy & DLQ Schemas (Phase 7 Milestone 4)
 *
 * ARCHITECTURAL INVARIANTS & GOVERNANCE:
 * 1. ZERO ANY POLICY (Rule 4): All schemas, error categories, DLQ records, and Saga structures strictly typed with Zod v4.
 * 2. ANTI-IDOR & MULTI-TENANCY (Rule 8 & 47): Every DLQ record, retry task, and remediation action immutably binds
 *    `organizationId` and `workspaceId`. Cross-tenant queries are rejected with IDOR_VIOLATION.
 * 3. TRI-STATE ERROR CLASSIFICATION: Errors are partitioned into TRANSIENT (retry with jitter), PERMANENT (quarantine to DLQ),
 *    and FATAL (immediate termination).
 * 4. 5-STATE CIRCUIT BREAKERS (Rule 24): Tracks capability health (healthy -> degraded -> open -> half_open -> recovered).
 * 5. ERROR SANITIZATION (Rule 48): Sensitive tokens, keys, and internal DB stack traces stripped before DLQ persistence.
 */

import { z } from 'zod/v4';

// ── 1. Error Classification Taxonomy ─────────────────────────────────────────

export const ERROR_CATEGORIES = ['TRANSIENT', 'PERMANENT', 'FATAL'] as const;
export const ErrorCategorySchema = z.enum(ERROR_CATEGORIES);
export type ErrorCategory = z.infer<typeof ErrorCategorySchema>;

export interface ErrorClassificationResult {
  category: ErrorCategory;
  retryable: boolean;
  reason: string;
  suggestedBackoffMultiplier?: number;
}

// ── 2. Retry Policy Configuration Schema ──────────────────────────────────────

export const JITTER_MODES = ['full', 'equal', 'none'] as const;
export const JitterModeSchema = z.enum(JITTER_MODES);
export type JitterMode = z.infer<typeof JitterModeSchema>;

export const WorkflowRetryPolicyConfigSchema = z.object({
  /** Maximum number of retries before routing to DLQ (Rule 23: default 5, max 10) */
  maxRetries: z.number().int().min(0).max(10).default(5),
  /** Initial backoff delay in milliseconds (default 1,000ms = 1s) */
  baseBackoffMs: z.number().int().positive().default(1000),
  /** Maximum backoff ceiling in milliseconds to prevent unbounded delays (default 60,000ms = 1 min) */
  maxBackoffMs: z.number().int().positive().default(60000),
  /** Exponential backoff multiplier factor (default 2.0) */
  backoffMultiplier: z.number().positive().default(2.0),
  /** Jitter randomization mode: 'full' distributes uniformly between 0.5x and 1.5x base delay */
  jitter: JitterModeSchema.default('full'),
  /** Specific error codes that are unconditionally retryable */
  retryableErrorCodes: z.array(z.string()).default([]),
  /** Specific error codes that are permanently fatal (never retried) */
  fatalErrorCodes: z.array(z.string()).default([]),
});

export type WorkflowRetryPolicyConfig = z.infer<typeof WorkflowRetryPolicyConfigSchema>;
export type WorkflowRetryPolicyConfigInput = z.input<typeof WorkflowRetryPolicyConfigSchema>;

export const DEFAULT_WORKFLOW_RETRY_POLICY: WorkflowRetryPolicyConfig = {
  maxRetries: 5,
  baseBackoffMs: 1000,
  maxBackoffMs: 60000,
  backoffMultiplier: 2.0,
  jitter: 'full',
  retryableErrorCodes: [
    'RATE_LIMITED',
    'TIMEOUT',
    'DEADLOCK',
    'NETWORK_ERROR',
    'SERVICE_UNAVAILABLE',
    'PROVIDER_DEGRADED',
    '503',
    '429',
    '502',
    '504',
    'ECONNRESET',
    'ETIMEDOUT',
  ],
  fatalErrorCodes: [
    'DEAD_MAN_PAUSED',
    'AUTHORIZATION_DENIED',
    'TENANT_MISMATCH',
    'PAYLOAD_TAMPERED',
    'NON_DELEGABLE_ACTION',
    'INSUFFICIENT_SCOPE',
    'IDOR_VIOLATION',
  ],
};

// ── 3. 5-State Circuit Breaker Schemas (Rule 24) ──────────────────────────────

export const CIRCUIT_BREAKER_STATES = [
  'healthy',
  'degraded',
  'open',
  'half_open',
  'recovered',
] as const;

export const CircuitBreakerStateSchema = z.enum(CIRCUIT_BREAKER_STATES);
export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>;

export interface CircuitBreakerConfig {
  /** Consecutive failures before tripping breaker from degraded to open (default 5) */
  failureThreshold: number;
  /** Cooldown in ms before transitioning from open to half_open probe (default 30,000ms = 30s) */
  cooldownMs: number;
  /** Number of successful probe requests needed in half_open before marking recovered (default 2) */
  successThreshold: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30000,
  successThreshold: 2,
};

export interface CapabilityCircuitState {
  capabilityId: string;
  state: CircuitBreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTimestamp?: number;
  lastStateChangeTimestamp: number;
  trippedReason?: string;
}

// ── 4. Dead-Letter Queue (DLQ) Contracts (Rule 25 & 48) ──────────────────────

export const DLQ_STATUSES = ['quarantined', 'replayed', 'skipped', 'discarded'] as const;
export const DlqStatusSchema = z.enum(DLQ_STATUSES);
export type DlqStatus = z.infer<typeof DlqStatusSchema>;

export const SanitizedErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  category: ErrorCategorySchema,
  safeDetails: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().datetime(),
});
export type SanitizedError = z.infer<typeof SanitizedErrorSchema>;

export const DlqRemediationActionSchema = z.enum(['retry', 'skip', 'reparameterize', 'discard']);
export type DlqRemediationAction = z.infer<typeof DlqRemediationActionSchema>;

export const DlqRemediationRecordSchema = z.object({
  action: DlqRemediationActionSchema,
  remediatedBy: z.string().min(1),
  remediatedAt: z.string().datetime(),
  newStepInput: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
});
export type DlqRemediationRecord = z.infer<typeof DlqRemediationRecordSchema>;

export const WorkflowDlqEntrySchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  workflowId: z.string().min(1),
  stepId: z.string().min(1),
  stepIndex: z.number().int().nonnegative(),
  capabilityId: z.string().min(1),
  attempt: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  errorCategory: ErrorCategorySchema,
  sanitizedError: SanitizedErrorSchema,
  stepInput: z.record(z.string(), z.unknown()),
  contextSnapshot: z.record(z.string(), z.unknown()).default({}),
  correlationId: z.string().optional(),
  quarantinedAt: z.string().datetime(),
  status: DlqStatusSchema.default('quarantined'),
  remediation: DlqRemediationRecordSchema.optional(),
});

export type WorkflowDlqEntry = z.output<typeof WorkflowDlqEntrySchema>;
export type WorkflowDlqEntryInput = z.input<typeof WorkflowDlqEntrySchema>;

export interface RouteToDlqInput {
  organizationId: string;
  workspaceId: string;
  workflowId: string;
  stepId: string;
  stepIndex: number;
  capabilityId: string;
  attempt: number;
  maxAttempts: number;
  rawError: unknown;
  stepInput: Record<string, unknown>;
  contextSnapshot?: Record<string, unknown>;
  correlationId?: string;
}

export interface DlqFilter {
  status?: DlqStatus;
  workflowId?: string;
  capabilityId?: string;
  limit?: number;
  startAfter?: string;
}

export interface RemediateDlqInput {
  dlqId: string;
  tenant: {
    organizationId: string;
    workspaceId: string;
  };
  remediatedBy: string;
  action: DlqRemediationAction;
  newStepInput?: Record<string, unknown>;
  notes?: string;
}

// ── 5. Distributed Saga Compensation Contracts (Rule 27) ──────────────────────

export const SAGA_STEP_STATUSES = ['pending', 'executing', 'compensated', 'failed'] as const;
export const SagaStepStatusSchema = z.enum(SAGA_STEP_STATUSES);
export type SagaStepStatus = z.infer<typeof SagaStepStatusSchema>;

export const WorkflowSagaStepSchema = z.object({
  stepId: z.string().min(1),
  stepIndex: z.number().int().nonnegative(),
  capabilityId: z.string().min(1),
  compensatingCapabilityId: z.string().min(1),
  status: SagaStepStatusSchema,
  idempotencyKey: z.string().min(1),
  durationMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
  executedAt: z.string().datetime().optional(),
});
export type WorkflowSagaStep = z.infer<typeof WorkflowSagaStepSchema>;

export const WorkflowSagaResultSchema = z.object({
  workflowId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  success: z.boolean(),
  totalStepsToCompensate: z.number().int().nonnegative(),
  compensatedStepsCount: z.number().int().nonnegative(),
  failedStepsCount: z.number().int().nonnegative(),
  requiresOperatorIntervention: z.boolean(),
  dryRun: z.boolean(),
  steps: z.array(WorkflowSagaStepSchema),
  completedAt: z.string().datetime(),
  errorMessage: z.string().optional(),
});
export type WorkflowSagaResult = z.infer<typeof WorkflowSagaResultSchema>;

export interface RollbackWorkflowInput {
  organizationId: string;
  workspaceId: string;
  workflowId: string;
  reason: string;
  failedStepId?: string;
  dryRun?: boolean;
  correlationId?: string;
}

// ── 6. Resilience Error Taxonomy (Rule 48) ───────────────────────────────────

export const WORKFLOW_RESILIENCE_ERROR_CODES = [
  'CIRCUIT_BREAKER_OPEN',
  'CIRCUIT_BREAKER_DEGRADED',
  'DLQ_ENTRY_NOT_FOUND',
  'DLQ_ALREADY_REMEDIATED',
  'INVALID_REMEDIATION_ACTION',
  'SAGA_COMPENSATION_FAILED',
  'DEAD_MAN_PAUSED',
  'TENANT_MISMATCH',
  'IDOR_VIOLATION',
  'RETRY_BUDGET_EXHAUSTED',
  'WORKFLOW_NOT_FOUND',
] as const;

export type WorkflowResilienceErrorCode = (typeof WORKFLOW_RESILIENCE_ERROR_CODES)[number];

export class WorkflowResilienceError extends Error {
  public readonly code: WorkflowResilienceErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: WorkflowResilienceErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowResilienceError';
    this.code = code;
    this.details = details;
  }
}
