/**
 * @fileOverview Canonical Workflow Contracts, Schemas & Error Taxonomy (Phase 7 Milestone 1)
 *
 * ARCHITECTURAL INVARIANTS & GOVERNANCE:
 * 1. ZERO ANY POLICY (Rule 4): All definitions, instances, steps, and checkpoints are strictly typed with Zod v4.
 * 2. TENANT ISOLATION (Rule 8 & 47): Every workflow, step, and checkpoint is immutably scoped to organizationId and workspaceId.
 * 3. SUBCOLLECTION PARTITIONING (Rule 9): Steps and checkpoints are designed to live in dedicated subcollections
 *    under `/organizations/{orgId}/workflows/{workflowId}/` to prevent exceeding Firestore 1MB limits.
 * 4. CRYPTOGRAPHIC PROVENANCE (Rule 40): Checkpoints record SHA-256 integrity hashes chained to previousHash.
 * 5. TRUE CANCELLATION & BUDGETS (Rule 23 & 26): Instances enforce hard duration and step ceilings and can be cancelled.
 */

import { z } from 'zod/v4';
import { StoredPrincipalSchema, type StoredPrincipal } from '../tasks/agent-step-contract';
export { StoredPrincipalSchema, type StoredPrincipal };

// ── 1. Workflow State Machine States (10 States) ───────────────────────────
export const WORKFLOW_STATES = [
  'CREATED',
  'QUEUED',
  'RUNNING',
  'WAITING',
  'RESUMED',
  'VERIFYING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
] as const;

export const WorkflowStateSchema = z.enum(WORKFLOW_STATES);
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// ── 2. Wait Condition Types & Schemas ──────────────────────────────────────
export const WAIT_CONDITION_TYPES = [
  'approval',
  'webhook',
  'schedule',
  'human_input',
  'external_system',
] as const;

export const WaitConditionTypeSchema = z.enum(WAIT_CONDITION_TYPES);
export type WaitConditionType = z.infer<typeof WaitConditionTypeSchema>;

export const WaitConditionSchema = z.object({
  type: WaitConditionTypeSchema,
  token: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  details: z.record(z.string(), z.unknown()).default({}),
});
export const WorkflowWaitConditionSchema = WaitConditionSchema;
export type WaitCondition = z.output<typeof WaitConditionSchema>;
export type WaitConditionInput = z.input<typeof WaitConditionSchema>;

// ── 3. Step Statuses ────────────────────────────────────────────────────────
export const WORKFLOW_STEP_STATUSES = [
  'PENDING',
  'QUEUED',
  'RUNNING',
  'WAITING',
  'VERIFYING',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
  'COMPENSATED',
] as const;

export const WorkflowStepStatusSchema = z.enum(WORKFLOW_STEP_STATUSES);
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;

// ── 4. Workflow Budgets ────────────────────────────────────────────────────
export const WorkflowBudgetsSchema = z.object({
  /** Maximum total duration in milliseconds before timing out (default 7 days). */
  maxTotalDurationMs: z.number().int().positive().default(7 * 24 * 60 * 60 * 1000),
  /** Maximum total steps allowed in DAG execution (default 50). */
  maxSteps: z.number().int().positive().default(50),
  /** Maximum retries per failed step (default 5). */
  maxRetries: z.number().int().nonnegative().default(5),
});
export type WorkflowBudgets = z.infer<typeof WorkflowBudgetsSchema>;

// ── 5. Workflow Step Schema ────────────────────────────────────────────────
export const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  stepIndex: z.number().int().nonnegative(),
  capabilityId: z.string().min(1),
  capabilityVersion: z.string().optional(),
  name: z.string().min(1),
  status: WorkflowStepStatusSchema,
  dependsOn: z.array(z.string()).default([]),
  waitCondition: WaitConditionSchema.optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
  attempt: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(3),
  idempotencyKey: z.string().min(1),
  isMutating: z.boolean().default(false),
  compensatingCapabilityId: z.string().optional(),
  compensationStatus: z.enum(['none', 'pending', 'completed', 'failed']).default('none'),
  riskLevel: z.string().optional(),
  isNonDelegable: z.boolean().default(false),
  capabilityFingerprint: z.string().optional(),
  fingerprintApproved: z.boolean().optional(),
  outputValidated: z.boolean().optional(),
  outputValidationErrors: z.array(z.string()).optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().nonnegative().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  lease: z
    .object({
      workerId: z.string().min(1),
      leaseExpiresAt: z.string().datetime(),
      leaseVersion: z.number().int().positive().default(1),
      acquiredAt: z.string().datetime(),
    })
    .nullable()
    .optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// ── 6. Workflow Checkpoint Schema ──────────────────────────────────────────
export const WorkflowCheckpointSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  checkpointSequence: z.number().int().nonnegative(),
  fromState: WorkflowStateSchema,
  toState: WorkflowStateSchema,
  stepId: z.string().optional(),
  statePayload: z.record(z.string(), z.unknown()).default({}),
  /** SHA-256 integrity hash of this checkpoint's contents. */
  hash: z.string().length(64),
  /** Chained SHA-256 hash of the previous checkpoint (tamper-evident audit chain). */
  previousHash: z.string().length(64).optional(),
  timestamp: z.string().datetime(),
});
export type WorkflowCheckpoint = z.infer<typeof WorkflowCheckpointSchema>;

// ── 7. Workflow Step Definition Schema (Template) ──────────────────────────
export const WorkflowStepDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  capabilityId: z.string().min(1),
  capabilityVersion: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
  defaultWaitCondition: WaitConditionSchema.optional(),
  isMutating: z.boolean().default(false),
  compensatingCapabilityId: z.string().optional(),
  riskLevel: z.string().optional(),
  timeoutSeconds: z.number().int().positive().default(300),
  maxAttempts: z.number().int().positive().default(3),
});
export type WorkflowStepDefinition = z.infer<typeof WorkflowStepDefinitionSchema>;

// ── 8. Workflow Definition Schema (Template DAG) ───────────────────────────
export const WorkflowDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().default('1.0.0'),
  steps: z.array(WorkflowStepDefinitionSchema),
  budgets: WorkflowBudgetsSchema.optional(),
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// ── 9. Workflow Instance Schema ────────────────────────────────────────────
export const WorkflowInstanceSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  definitionId: z.string().min(1),
  definitionVersion: z.string().default('1.0.0'),
  title: z.string().min(1),
  status: WorkflowStateSchema,
  currentStepId: z.string().optional(),
  currentWaitCondition: WaitConditionSchema.optional(),
  initiator: z.object({
    actorType: z.enum(['user', 'agent', 'system', 'cron']),
    actorId: z.string().min(1),
  }),
  principal: StoredPrincipalSchema,
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()).default({}),
  outputs: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
  budgets: WorkflowBudgetsSchema,
  stepCounts: z
    .object({
      total: z.number().int().nonnegative().default(0),
      completed: z.number().int().nonnegative().default(0),
      failed: z.number().int().nonnegative().default(0),
      skipped: z.number().int().nonnegative().default(0),
    })
    .default({ total: 0, completed: 0, failed: 0, skipped: 0 }),
  dryRun: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});
export type WorkflowInstance = z.infer<typeof WorkflowInstanceSchema>;

// ── 10. Creation / Update Types (Bifurcated Inputs) ─────────────────────────
export interface CreateWorkflowInstanceInput {
  id?: string;
  organizationId: string;
  workspaceId: string;
  definitionId: string;
  definitionVersion?: string;
  title: string;
  initiator: {
    actorType: 'user' | 'agent' | 'system' | 'cron';
    actorId: string;
  };
  principal: StoredPrincipal;
  correlationId?: string;
  idempotencyKey?: string;
  inputs?: Record<string, unknown>;
  budgets?: Partial<WorkflowBudgets>;
  dryRun?: boolean;
}

export interface CreateWorkflowStepInput {
  id?: string;
  workflowId: string;
  organizationId: string;
  workspaceId: string;
  stepIndex: number;
  capabilityId: string;
  capabilityVersion?: string;
  name: string;
  dependsOn?: string[];
  status?: WorkflowStepStatus;
  waitCondition?: WaitConditionInput;
  input?: Record<string, unknown>;
  idempotencyKey?: string;
  isMutating?: boolean;
  compensatingCapabilityId?: string;
  riskLevel?: string;
  isNonDelegable?: boolean;
  maxAttempts?: number;
}

export interface UpdateWorkflowStepInput {
  status?: WorkflowStepStatus;
  input?: Record<string, unknown>;
  waitCondition?: WaitConditionInput;
  output?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  attempt?: number;
  compensationStatus?: 'none' | 'pending' | 'completed' | 'failed';
  compensatingCapabilityId?: string;
  outputValidated?: boolean;
  outputValidationErrors?: string[];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface CreateWorkflowCheckpointInput {
  id?: string;
  workflowId: string;
  organizationId: string;
  workspaceId: string;
  checkpointSequence: number;
  fromState: WorkflowState;
  toState: WorkflowState;
  stepId?: string;
  statePayload?: Record<string, unknown>;
  hash: string;
  previousHash?: string;
}

export interface ListWorkflowInstancesOptions {
  organizationId: string;
  workspaceId: string;
  status?: WorkflowState;
  definitionId?: string;
  limit?: number;
  offset?: number;
}

export interface TenantBoundary {
  organizationId: string;
  workspaceId: string;
}

// ── 11. Error Taxonomy & Mapping ───────────────────────────────────────────
export const WORKFLOW_ERROR_CODES = [
  'WORKFLOW_NOT_FOUND',
  'STEP_NOT_FOUND',
  'CHECKPOINT_NOT_FOUND',
  'INVALID_TRANSITION',
  'TERMINAL_STATE_IMMUTABLE',
  'TENANT_SCOPE_VIOLATION',
  'IDEMPOTENCY_CONFLICT',
  'WAIT_CONDITION_MISMATCH',
  'WAIT_CONDITION_NOT_MET',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'BUDGET_EXCEEDED',
  'COMPENSATION_FAILED',
  'DEAD_MAN_PAUSED',
  'CONCURRENCY_CONFLICT',
  'INVALID_STEP_INPUT',
  'STEP_VERIFICATION_FAILED',
  'CIRCUIT_BREAKER_OPEN',
] as const;

export type WorkflowErrorCode = (typeof WORKFLOW_ERROR_CODES)[number];

export class WorkflowError extends Error {
  constructor(
    public readonly code: WorkflowErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export function mapWorkflowErrorToHttpStatus(code: WorkflowErrorCode): number {
  switch (code) {
    case 'WORKFLOW_NOT_FOUND':
    case 'STEP_NOT_FOUND':
    case 'CHECKPOINT_NOT_FOUND':
      return 404;
    case 'TENANT_SCOPE_VIOLATION':
      return 403;
    case 'TOKEN_INVALID':
      return 401;
    case 'TOKEN_EXPIRED':
      return 410;
    case 'INVALID_TRANSITION':
    case 'WAIT_CONDITION_MISMATCH':
    case 'WAIT_CONDITION_NOT_MET':
    case 'INVALID_STEP_INPUT':
    case 'STEP_VERIFICATION_FAILED':
      return 400;
    case 'TERMINAL_STATE_IMMUTABLE':
    case 'IDEMPOTENCY_CONFLICT':
    case 'CONCURRENCY_CONFLICT':
      return 409;
    case 'BUDGET_EXCEEDED':
      return 429;
    case 'COMPENSATION_FAILED':
    case 'DEAD_MAN_PAUSED':
    case 'CIRCUIT_BREAKER_OPEN':
      return 503;
    default:
      return 500;
  }
}
