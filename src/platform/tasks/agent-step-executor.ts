/**
 * @fileOverview Agent Step Executor (Phase 0 / Phase 7)
 *
 * Executes ONE durable agent step delivered by Cloud Tasks:
 *   parse payload → claim step (transactional) → resolve capability → authorize
 *   → validate input → execute (bounded) → validate output → record outcome.
 *
 * HTTP semantics (Cloud Tasks retries every non-2xx):
 * - 200: finished, or permanently rejected/failed — retrying cannot help, so stop.
 * - 409: another delivery holds the lease — retry later.
 * - 503: retryable failure (capability said retryable, or timed out) — retry.
 * - 400: malformed payload.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Never mark a step `completed` unless the capability handler returned success AND its output
 *   passed the output schema. A no-op "completed" silently drops agent work.
 * - Authority is re-evaluated at execution time, not only at enqueue time (TOCTOU, Rule 18):
 *   scopes can be revoked while a step waits in the queue.
 * - A timed-out handler may still be running, so the lease is NOT released on timeout; the next
 *   delivery gets 409 until the lease expires. The handler receives the idempotency key so a
 *   re-run after lease expiry cannot duplicate side effects (Rule 19).
 */

import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
  VerifiedApproval,
} from '../capabilities/contracts/capability-definition';
import { isAutomatedPrincipal } from '../capabilities/contracts/capability-definition';
import { requiresAgentApproval } from '../capabilities/contracts/risk-levels';
import { computeApprovalPayloadHash, type ApprovalVerifier } from '../capabilities/policy/approval-verifier';
import { evaluatePrincipalAuthority } from '../capabilities/policy/principal-evaluator';
import {
  AgentStepTaskPayloadSchema,
  LEASE_BUFFER_MS,
  MAX_STEP_RESULT_BYTES,
  findTenantMismatch,
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

class StepTimeoutError extends Error {
  constructor(ms: number) {
    super(`Capability handler exceeded maxDurationMs (${ms} ms).`);
    this.name = 'StepTimeoutError';
  }
}

async function runWithTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StepTimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toStoredResult(result: Extract<CapabilityExecutionResult<unknown>, { success: true }>): StoredStepResult {
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

  const fail = async (error: StepError): Promise<AgentStepOutcome> => {
    await deps.store.markFailed(payload, { error, nowIso: new Date(nowMs()).toISOString() });
    return { httpStatus: 200, body: { ...ids, status: 'failed', code: error.code, message: error.message } };
  };

  // 3. Resolve capability
  const capability = deps.resolveCapability(step.capabilityId);
  if (!capability) {
    return fail({ code: 'CAPABILITY_NOT_REGISTERED', message: `Capability '${step.capabilityId}' is not registered.`, retryable: false });
  }

  // Version pin (Rule 36): the step was validated and authorized against a specific contract.
  // Running it against a different version could apply a different schema or side effects.
  if (capability.version !== step.capabilityVersion) {
    return fail({
      code: 'CAPABILITY_VERSION_MISMATCH',
      message: `Step was queued for ${capability.id}@${step.capabilityVersion} but ${capability.version} is registered.`,
      retryable: false,
    });
  }

  // 4. Tenant binding: input may not point at another tenant than the run
  const tenantMismatch = findTenantMismatch(step.input, run);
  if (tenantMismatch) {
    return fail({ code: 'TENANT_SCOPE_VIOLATION', message: tenantMismatch, retryable: false });
  }

  // 5. Input validation — the handler only ever sees parsed data (Rule 31)
  const parsedInput = capability.inputSchema.safeParse(step.input);
  if (!parsedInput.success) {
    return fail({ code: 'INVALID_INPUT', message: 'Step input failed the capability input schema.', retryable: false });
  }
  const input: unknown = parsedInput.data;

  const principal: AgentPrincipal = {
    ...run.principal,
    runId: run.runId,
    toolInvocationId: `${run.runId}:${step.stepNumber}`,
  };
  const target = { organizationId: run.organizationId, workspaceId: run.workspaceId };
  const isAutomatedAgent = isAutomatedPrincipal(principal);

  // 6. Verified approval for approval-requiring agent steps (Rules 21, 22). The hash covers the
  //    VALIDATED input, so an approval can never authorize a different payload.
  let verifiedApproval: VerifiedApproval | undefined;
  let payloadHash: string | undefined;
  if (isAutomatedAgent && requiresAgentApproval(capability.risk)) {
    if (!step.approvalId) {
      return fail({ code: 'APPROVAL_REQUIRED', message: 'Step requires a verified human approval but has none.', retryable: false });
    }
    if (!deps.approvals) {
      return fail({ code: 'APPROVAL_VERIFIER_UNAVAILABLE', message: 'No approval verifier is configured.', retryable: false });
    }
    payloadHash = computeApprovalPayloadHash({
      capabilityId: capability.id,
      capabilityVersion: capability.version,
      ...target,
      input,
    });
    const verification = await deps.approvals.verifyAndBind({
      approvalId: step.approvalId,
      capabilityId: capability.id,
      capabilityVersion: capability.version,
      ...target,
      payloadHash,
      toolInvocationId: principal.toolInvocationId ?? '',
      agentId: principal.agentId,
      nowMs: nowMs(),
    });
    if (!verification.ok) {
      return fail({ code: verification.code, message: verification.message, retryable: false });
    }
    verifiedApproval = verification.approval;
  }

  // 7. Re-evaluate authority at execution time against the RUN's recorded tenant (Rules 16, 17, 18)
  const authority = evaluatePrincipalAuthority(principal, capability, target, {
    verifiedApproval,
    payloadHash,
    nowMs: nowMs(),
  });
  if (!authority.allowed) {
    return fail({ code: 'AUTHORIZATION_DENIED', message: authority.reason ?? 'Principal is not authorized.', retryable: false });
  }

  // 8. Execute, bounded by the capability's declared max duration
  const context: CapabilityExecutionContext = {
    principal,
    correlationId: run.correlationId,
    causationId: principal.toolInvocationId,
    idempotencyKey: step.idempotencyKey,
    timestamp: new Date(nowMs()).toISOString(),
  };

  let result: CapabilityExecutionResult<unknown>;
  try {
    result = await runWithTimeout(capability.handler(input, context), capability.execution.maxDurationMs);
  } catch (err: unknown) {
    const isTimeout = err instanceof StepTimeoutError;
    await deps.store.markRetryPending(payload, {
      error: {
        code: isTimeout ? 'TIMEOUT' : 'HANDLER_EXCEPTION',
        // Full detail goes to server logs only; the stored message stays generic.
        message: isTimeout ? err.message : 'Capability handler threw an exception.',
        retryable: true,
      },
      nowIso: new Date(nowMs()).toISOString(),
      releaseLease: !isTimeout,
    });
    if (!isTimeout) {
      console.error(`[AGENT-STEP] Handler exception run=${ids.runId} step=${ids.stepNumber} cap=${capability.id}:`, err);
    }
    return { httpStatus: 503, body: { ...ids, status: 'retry_pending', code: isTimeout ? 'TIMEOUT' : 'HANDLER_EXCEPTION' } };
  }

  // 9. Capability-reported failure
  if (!result.success) {
    const error: StepError = { code: result.error.code, message: result.error.message, retryable: result.error.retryable };
    if (error.retryable) {
      await deps.store.markRetryPending(payload, { error, nowIso: new Date(nowMs()).toISOString(), releaseLease: true });
      return { httpStatus: 503, body: { ...ids, status: 'retry_pending', code: error.code } };
    }
    return fail(error);
  }

  // 10. Output validation (Rule 48: never trust the tool either)
  if (capability.outputSchema && !capability.outputSchema.safeParse(result.data).success) {
    return fail({ code: 'INVALID_OUTPUT', message: 'Capability output failed its output schema.', retryable: false });
  }

  await deps.store.markCompleted(payload, { result: toStoredResult(result), nowIso: new Date(nowMs()).toISOString() });
  return { httpStatus: 200, body: { ...ids, status: 'completed' } };
}
