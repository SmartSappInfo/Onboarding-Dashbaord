/**
 * @fileOverview Canonical Execution, Lease, Recovery & Replay Types (Phase 7 Milestone 2)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): All schemas strictly typed via Zod v4.
 * 2. DISTRIBUTED LEASE TIME-TO-LIVE (Rule 9): Default lease TTL 120s, max 300s.
 * 3. RETRY CEILINGS & BACKOFF (Rule 23): Base retry 5s, max ceiling 300s with randomized jitter.
 * 4. CRYPTOGRAPHIC REPLAY AUDITING (Rule 40 & 43): Verification models for hash chain integrity.
 * 5. ZOMBIE RECOVERY (Rule 9 & 24): Bounded recovery batches for crashed/orphaned workers.
 */

import { z } from 'zod/v4';

export const DEFAULT_LEASE_TTL_MS = 120_000;
export const MAX_LEASE_TTL_MS = 300_000;
export const DEFAULT_RETRY_BASE_SECONDS = 5;
export const DEFAULT_RETRY_MAX_SECONDS = 300;

// ── 1. Distributed Workflow Lease Schema ────────────────────────────────────
export const WorkflowLeaseSchema = z.object({
  workflowId: z.string().min(1),
  stepId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  workerId: z.string().min(1),
  leaseExpiresAt: z.string().datetime(),
  leaseVersion: z.number().int().positive().default(1),
  acquiredAt: z.string().datetime(),
});
export type WorkflowLease = z.infer<typeof WorkflowLeaseSchema>;

// ── 2. Replay Verification Result Schema ────────────────────────────────────
export const ReplayVerificationResultSchema = z.object({
  workflowId: z.string().min(1),
  isValid: z.boolean(),
  totalCheckpoints: z.number().int().nonnegative(),
  verifiedCheckpoints: z.number().int().nonnegative(),
  lastVerifiedSequence: z.number().int().nonnegative(),
  failureReason: z.string().optional(),
  divergenceIndex: z.number().int().optional(),
});
export type ReplayVerificationResult = z.infer<typeof ReplayVerificationResultSchema>;

// ── 3. Zombie Reaper Result Schema ──────────────────────────────────────────
export const ZombieReapResultSchema = z.object({
  scannedSteps: z.number().int().nonnegative(),
  recoveredSteps: z.array(z.string()),
  failedSteps: z.array(z.string()),
  errors: z.array(z.string()),
});
export type ZombieReapResult = z.infer<typeof ZombieReapResultSchema>;

// ── 4. Step Execution Result Schema ─────────────────────────────────────────
export const StepExecutionResultSchema = z.object({
  stepId: z.string().min(1),
  status: z.enum(['COMPLETED', 'FAILED', 'WAITING', 'SKIPPED', 'CANCELLED']),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      category: z.enum(['TRANSIENT', 'PERMANENT', 'FATAL']).optional(),
      details: z.unknown().optional(),
    })
    .optional(),
  durationMs: z.number().int().nonnegative(),
  nextStepsScheduled: z.array(z.string()).default([]),
  retryScheduled: z.boolean().default(false),
  retryDelaySeconds: z.number().optional(),
});
export type StepExecutionResult = z.infer<typeof StepExecutionResultSchema>;

// ── 5. Error Taxonomies ─────────────────────────────────────────────────────
export const LEASE_ERROR_CODES = [
  'LEASE_ALREADY_ACQUIRED',
  'LEASE_EXPIRED',
  'LEASE_HEARTBEAT_FAILED',
  'LEASE_NOT_FOUND',
  'LEASE_CONCURRENCY_CONFLICT',
  'TENANT_SCOPE_VIOLATION',
] as const;
export type LeaseErrorCode = (typeof LEASE_ERROR_CODES)[number];

export class WorkflowLeaseError extends Error {
  constructor(
    public readonly code: LeaseErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WorkflowLeaseError';
  }
}

export const REPLAY_ERROR_CODES = [
  'HASH_CHAIN_BROKEN',
  'CHECKPOINT_FORK_DETECTED',
  'STATE_DIVERGENCE',
  'CHECKPOINTS_EMPTY',
] as const;
export type ReplayErrorCode = (typeof REPLAY_ERROR_CODES)[number];

export class WorkflowReplayError extends Error {
  constructor(
    public readonly code: ReplayErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WorkflowReplayError';
  }
}

export const RECOVERY_ERROR_CODES = [
  'RECOVERY_FAILED',
  'TRANSACTION_ABORTED',
  'STEP_NOT_FOUND',
] as const;
export type RecoveryErrorCode = (typeof RECOVERY_ERROR_CODES)[number];

export class WorkflowRecoveryError extends Error {
  constructor(
    public readonly code: RecoveryErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WorkflowRecoveryError';
  }
}

export const EXECUTION_PIPELINE_ERROR_CODES = [
  'CAPABILITY_NOT_FOUND',
  'FINGERPRINT_DRIFT_DETECTED',
  'INPUT_VALIDATION_FAILED',
  'INJECTION_DETECTED',
  'STEP_TIMEOUT',
  'EXECUTION_FAILED',
  'OUTPUT_VALIDATION_FAILED',
  'DEAD_MAN_PAUSED',
  'AUTHORIZATION_DENIED',
  'CIRCUIT_BREAKER_OPEN',
  'CIRCUIT_BREAKER_DEGRADED',
  // Durable step approvals (Phase 11 M0 · T5): permanent, never retried.
  'APPROVAL_REJECTED',
  'APPROVAL_EXPIRED',
] as const;
export type ExecutionPipelineErrorCode = (typeof EXECUTION_PIPELINE_ERROR_CODES)[number];

export class WorkflowExecutionError extends Error {
  constructor(
    public readonly code: ExecutionPipelineErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WorkflowExecutionError';
  }
}
