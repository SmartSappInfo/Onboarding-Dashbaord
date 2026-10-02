/**
 * @fileOverview Agent Step Executor (Phase 0 / Phase 1 / Phase 7)
 *
 * Executes ONE durable agent step delivered by Cloud Tasks by delegating
 * to the Canonical Capability Execution Gateway (`executeCapability`):
 *   parse payload → claim step (transactional) → executeCapability → record outcome.
 *
 * HTTP semantics (Cloud Tasks retries every non-2xx):
 * - 200: finished, or permanently rejected/failed — retrying cannot help, so stop.
 * - 409: another delivery holds the lease — retry later.
 * - 503: retryable failure (capability said retryable, or timed out) — retry.
 * - 400: malformed payload.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Implements Rule 69 (The Unified Layering Axiom): Do not maintain duplicate policy
 *   evaluation or execution code in the task worker. All validation, scoping, authorization,
 *   approval verification, bounded execution, and output validation route through `executeCapability`.
 * - Authority is re-evaluated at execution time, not only at enqueue time (TOCTOU, Rule 18).
 * - A timed-out handler may still be running, so the lease is NOT released on timeout; the next
 *   delivery gets 409 until the lease expires. The handler receives the idempotency key so a
 *   re-run after lease expiry cannot duplicate side effects (Rule 19).
 */

import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
} from '../capabilities/contracts/capability-definition';
import type { DomainEvent } from '../capabilities/events/domain-event';
import type { ApprovalVerifier } from '../capabilities/policy/approval-verifier';
import { executeCapability } from '../capabilities/execution/execute-capability';
import { createTaskWorkerInvocation } from '../capabilities/execution/invocation';
import {
  AgentStepTaskPayloadSchema,
  LEASE_BUFFER_MS,
  MAX_STEP_RESULT_BYTES,
  jsonByteSize,
  type AgentRunRecord,
  type AgentStepRecord,
  type AgentStepTaskPayload,
  type ClaimDecision,
  type StepError,
} from './agent-step-contract';

// ── Store port (implemented by firestore-agent-step-store.ts; faked in tests) ──
export interface ClaimResult {
  decision: ClaimDecision;
  run: AgentRunRecord | null;
  step: AgentStepRecord | null;
}

export interface AgentStepStore {
  /** Reads run + step, applies `decideStepClaim`, and on `claim` marks the step running — atomically. */
  claim(payload: AgentStepTaskPayload, options: { nowMs: number; leaseMsFor: (capabilityId: string) => number }): Promise<ClaimResult>;
  markCompleted(payload: AgentStepTaskPayload, outcome: { result: StoredStepResult; nowIso: string }): Promise<void>;
  /** `releaseLease` false keeps the lease (timeouts: the handler may still be running). */
  markRetryPending(payload: AgentStepTaskPayload, outcome: { error: StepError; nowIso: string; releaseLease: boolean }): Promise<void>;
  /** Terminal failure: fails the step and the run (dead-letter for manual recovery, Rule 25). */
  markFailed(payload: AgentStepTaskPayload, outcome: { error: StepError; nowIso: string }): Promise<void>;
}

export type StoredStepResult =
  | { truncated: false; data: unknown; emittedEventCount: number }
  | { truncated: true; bytes: number; emittedEventCount: number };

export interface AgentStepExecutorDeps {
  store: AgentStepStore;
  resolveCapability: (capabilityId: string) => AnyCapabilityDefinition | undefined;
  /** Required to run approval-requiring agent steps; without it they fail closed. */
  approvals?: ApprovalVerifier;
  /** Optional hook to verify live actor standing against auth/database before execution (Rule 18). */
  verifyActorStanding?: (principal: AgentPrincipal) => Promise<{ active: boolean; reason?: string }>;
  nowMs?: () => number;
}

export interface AgentStepOutcome {
  httpStatus: 200 | 400 | 409 | 503;
  body: {
    status: 'completed' | 'already_completed' | 'in_progress' | 'retry_pending' | 'failed' | 'rejected' | 'terminal';
    runId?: string;
    stepNumber?: number;
    code?: string;
    message?: string;
  };
}

function toStoredResult(result: { data: unknown; emittedEvents: DomainEvent[] }): StoredStepResult {
  const emittedEventCount = result.emittedEvents.length;
  const bytes = jsonByteSize(result.data);
  if (bytes > MAX_STEP_RESULT_BYTES) {
    return { truncated: true, bytes, emittedEventCount };
  }
  // JSON round-trip strips `undefined` and class instances Firestore would reject.
  const data: unknown = JSON.parse(JSON.stringify(result.data ?? null));
  return { truncated: false, data, emittedEventCount };
}

export async function processAgentStep(rawPayload: unknown, deps: AgentStepExecutorDeps): Promise<AgentStepOutcome> {
  const nowMs = deps.nowMs ?? (() => Date.now());

  // 1. Payload boundary validation (Rule 4)
  const parsedPayload = AgentStepTaskPayloadSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    return {
      httpStatus: 400,
      body: { status: 'rejected', code: 'INVALID_PAYLOAD', message: 'Payload must contain runId, stepNumber and idempotencyKey.' },
    };
  }
  const payload = parsedPayload.data;
  const ids = { runId: payload.runId, stepNumber: payload.stepNumber };

  // 2. Transactional claim (idempotency + lease, Rules 19/20)
  const { decision, run, step } = await deps.store.claim(payload, {
    nowMs: nowMs(),
    leaseMsFor: (capabilityId) => (deps.resolveCapability(capabilityId)?.execution.maxDurationMs ?? 60_000) + LEASE_BUFFER_MS,
  });

  switch (decision.kind) {
    case 'already_completed':
      return { httpStatus: 200, body: { ...ids, status: 'already_completed' } };
    case 'in_progress':
      return { httpStatus: 409, body: { ...ids, status: 'in_progress', message: `Leased until ${decision.leaseExpiresAt}.` } };
    case 'terminal':
      return { httpStatus: 200, body: { ...ids, status: 'terminal', message: `Step is ${decision.status}.` } };
    case 'reject': {
      // Exhausted retries are recorded as a terminal failure so they surface in the run center.
      if (decision.code === 'MAX_ATTEMPTS_EXCEEDED') {
        await deps.store.markFailed(payload, {
          error: { code: decision.code, message: decision.message, retryable: false },
          nowIso: new Date(nowMs()).toISOString(),
        });
      }
      return { httpStatus: 200, body: { ...ids, status: 'rejected', code: decision.code, message: decision.message } };
    }
    case 'claim':
      break;
  }

  if (!run || !step) {
    // Unreachable if the store honours its contract; fail closed rather than execute blind.
    return { httpStatus: 200, body: { ...ids, status: 'rejected', code: 'STORE_CONTRACT_VIOLATION' } };
  }

  // 3. Delegate execution directly to Canonical Execution Gateway (PR-4 / Rule 69)
  const invocation = createTaskWorkerInvocation({
    capabilityId: step.capabilityId,
    version: step.capabilityVersion,
    input: step.input,
    principal: {
      ...run.principal,
      runId: run.runId,
      toolInvocationId: `${run.runId}:${step.stepNumber}`,
    },
    idempotencyKey: step.idempotencyKey,
    correlationId: run.correlationId,
    causationId: `${run.runId}:${step.stepNumber}`,
    approvalId: step.approvalId,
  });

  const outcome = await executeCapability(invocation, {
    registryLookup: (id) => deps.resolveCapability(id),
    approvals: deps.approvals,
    verifyActorStanding: deps.verifyActorStanding,
    nowMs,
  });

  // 4. Handle Successful Execution
  if (outcome.success) {
    await deps.store.markCompleted(payload, {
      result: toStoredResult(outcome),
      nowIso: new Date(nowMs()).toISOString(),
    });
    return { httpStatus: 200, body: { ...ids, status: 'completed' } };
  }

  // 5. Handle Gateway Refusal or Execution Failure
  const error: StepError = {
    code: outcome.error.code,
    message: outcome.error.message,
    retryable: outcome.error.retryable,
  };

  const isTimeout = outcome.error.code === 'TIMEOUT';
  const isHandlerException = outcome.error.code === 'HANDLER_EXCEPTION';
  const isRetryable = error.retryable || isTimeout || isHandlerException;

  if (isRetryable) {
    await deps.store.markRetryPending(payload, {
      error: {
        code: error.code,
        message: isTimeout
          ? error.message
          : (isHandlerException ? 'Capability handler threw an exception.' : error.message),
        retryable: true,
      },
      nowIso: new Date(nowMs()).toISOString(),
      releaseLease: !isTimeout,
    });

    if (!isTimeout) {
      console.error(
        `[AGENT-STEP] Handler exception run=${ids.runId} step=${ids.stepNumber} cap=${step.capabilityId}:`,
        outcome.error
      );
    }

    return {
      httpStatus: 503,
      body: {
        ...ids,
        status: 'retry_pending',
        code: error.code,
      },
    };
  }

  // Terminal failure: fail step permanently in store
  await deps.store.markFailed(payload, {
    error,
    nowIso: new Date(nowMs()).toISOString(),
  });

  return {
    httpStatus: 200,
    body: {
      ...ids,
      status: 'failed',
      code: error.code,
      message: error.message,
    },
  };
}
