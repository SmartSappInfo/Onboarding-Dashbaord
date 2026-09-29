/**
 * @fileOverview Agent Run / Step Durable Execution Contract (Phase 0 / Phase 7)
 *
 * Schemas and pure decision rules for Cloud Tasks-driven agent steps
 * (Cloud Run blueprint §5.2, Rules 19, 20, 25, 26).
 *
 * TRUST MODEL — read before changing:
 * - The Cloud Tasks payload carries ONLY `{ runId, stepNumber, idempotencyKey }`.
 *   Principal, tenant scope, capability id and input are read from Firestore records that the
 *   dispatcher wrote server-side (`agent_runs/{runId}` and `agent_runs/{runId}/steps/{n}`).
 *   Never read authority or input from the task body: anyone holding the worker secret could forge it.
 * - Firestore records are parsed with Zod before use (Rule 4: unknown only at the boundary).
 *
 * The claim rules below are pure so they can be unit-tested without Firestore; the Firestore
 * adapter (`firestore-agent-step-store.ts`) only runs them inside a transaction.
 */

import { z } from 'zod/v4';

export const AGENT_RUNS_COLLECTION = 'agent_runs';
export const AGENT_STEPS_SUBCOLLECTION = 'steps';

/** Firestore documents cap at 1 MiB; keep step input well below it. */
export const MAX_STEP_INPUT_BYTES = 256 * 1024;
/** Step results are stored for replay/inspection; larger results are recorded as truncated. */
export const MAX_STEP_RESULT_BYTES = 64 * 1024;
/** After this many claimed attempts the step is failed permanently (dead-lettered). */
export const MAX_STEP_ATTEMPTS = 5;
/** Extra lease time on top of the capability's maxDurationMs before a stuck step may be reclaimed. */
export const LEASE_BUFFER_MS = 30_000;

const idSegment = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, 'must contain only letters, digits, "_" or "-"');

// ── Task payload (untrusted beyond the shared-secret handshake) ─────────────
export const AgentStepTaskPayloadSchema = z.object({
  runId: idSegment,
  stepNumber: z.number().int().min(0).max(10_000),
  idempotencyKey: z.string().min(8).max(200),
});
export type AgentStepTaskPayload = z.infer<typeof AgentStepTaskPayloadSchema>;

// ── Stored records ──────────────────────────────────────────────────────────
export const StoredPrincipalSchema = z.object({
  /** Background steps are never interactive: the dispatcher always stores 'agent'. */
  actorType: z.literal('agent'),
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  agentId: z.string().optional(),
  agentVersion: z.string().optional(),
  delegationId: z.string().optional(),
  policyVersion: z.string().optional(),
  grantedScopes: z.array(z.string()),
  effectiveRole: z.string().min(1),
});
export type StoredPrincipal = z.infer<typeof StoredPrincipalSchema>;

export const AGENT_RUN_STATUSES = [
  'queued',
  'running',
  'waiting_for_approval',
  'completed',
  'failed',
  'cancelled',
] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const AgentRunRecordSchema = z.object({
  runId: idSegment,
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  principal: StoredPrincipalSchema,
  status: z.enum(AGENT_RUN_STATUSES),
  correlationId: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentRunRecord = z.infer<typeof AgentRunRecordSchema>;

export const AGENT_STEP_STATUSES = [
  'queued',
  'running',
  'retry_pending',
  'completed',
  'failed',
  'cancelled',
] as const;
export type AgentStepStatus = (typeof AGENT_STEP_STATUSES)[number];

export const StepErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});
export type StepError = z.infer<typeof StepErrorSchema>;

export const AgentStepRecordSchema = z.object({
  runId: idSegment,
  stepNumber: z.number().int().min(0),
  capabilityId: z.string().min(1),
  /** Version the step was validated and authorized against at enqueue (Rule 36). */
  capabilityVersion: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(8),
  /** Server-side approval record id (capability_approvals) for approval-requiring agent steps. */
  approvalId: z.string().min(1).optional(),
  status: z.enum(AGENT_STEP_STATUSES),
  attempts: z.number().int().min(0),
  leaseExpiresAt: z.string().nullable().optional(),
  error: StepErrorSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentStepRecord = z.infer<typeof AgentStepRecordSchema>;

// ── Claim decision (pure) ───────────────────────────────────────────────────
export type ClaimRejectCode =
  | 'RUN_NOT_FOUND'
  | 'RUN_NOT_ACTIVE'
  | 'STEP_NOT_FOUND'
  | 'IDEMPOTENCY_KEY_MISMATCH'
  | 'MAX_ATTEMPTS_EXCEEDED'
  /** A stored run/step document failed schema validation — never execute against it. */
  | 'RECORD_CORRUPT';

export type ClaimDecision =
  | { kind: 'claim'; attempt: number }
  | { kind: 'already_completed' }
  | { kind: 'in_progress'; leaseExpiresAt: string }
  | { kind: 'terminal'; status: 'failed' | 'cancelled' }
  | { kind: 'reject'; code: ClaimRejectCode; message: string };

export interface ClaimInput {
  run: AgentRunRecord | null;
  step: AgentStepRecord | null;
  idempotencyKey: string;
  nowMs: number;
  maxAttempts?: number;
}

/**
 * Decides whether this delivery may execute the step. Order matters:
 * run liveness → step existence → idempotency binding → terminal/completed → lease → attempt budget.
 */
export function decideStepClaim({ run, step, idempotencyKey, nowMs, maxAttempts = MAX_STEP_ATTEMPTS }: ClaimInput): ClaimDecision {
  if (!run) {
    return { kind: 'reject', code: 'RUN_NOT_FOUND', message: 'Agent run record does not exist.' };
  }
  if (run.status === 'cancelled' || run.status === 'failed' || run.status === 'completed') {
    return { kind: 'reject', code: 'RUN_NOT_ACTIVE', message: `Agent run is ${run.status}.` };
  }
  if (!step) {
    return { kind: 'reject', code: 'STEP_NOT_FOUND', message: 'Step record does not exist; it must be created by the dispatcher.' };
  }
  // The key binds this delivery to the exact step the dispatcher recorded (Rule 20).
  if (step.idempotencyKey !== idempotencyKey) {
    return { kind: 'reject', code: 'IDEMPOTENCY_KEY_MISMATCH', message: 'Idempotency key does not match the recorded step.' };
  }
  if (step.status === 'completed') {
    return { kind: 'already_completed' };
  }
  if (step.status === 'failed' || step.status === 'cancelled') {
    return { kind: 'terminal', status: step.status };
  }
  if (step.status === 'running' && step.leaseExpiresAt) {
    const leaseMs = Date.parse(step.leaseExpiresAt);
    if (!Number.isNaN(leaseMs) && leaseMs > nowMs) {
      return { kind: 'in_progress', leaseExpiresAt: step.leaseExpiresAt };
    }
    // Lease expired: the previous attempt crashed or timed out — fall through and reclaim.
  }
  if (step.attempts >= maxAttempts) {
    return { kind: 'reject', code: 'MAX_ATTEMPTS_EXCEEDED', message: `Step exceeded ${maxAttempts} attempts.` };
  }
  return { kind: 'claim', attempt: step.attempts + 1 };
}

/**
 * Rejects input that names a different tenant than the run it belongs to.
 * Capabilities must never be steered across tenants by their own arguments (tools §1).
 */
export function findTenantMismatch(input: Record<string, unknown>, run: Pick<AgentRunRecord, 'organizationId' | 'workspaceId'>): string | null {
  const orgId = input.organizationId;
  if (typeof orgId === 'string' && orgId !== run.organizationId) {
    return `Input organizationId (${orgId}) does not match run organization (${run.organizationId}).`;
  }
  const wsId = input.workspaceId;
  if (typeof wsId === 'string' && wsId !== run.workspaceId) {
    return `Input workspaceId (${wsId}) does not match run workspace (${run.workspaceId}).`;
  }
  return null;
}

/** JSON byte size, used to cap stored input/results below Firestore's document limit. */
export function jsonByteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}
