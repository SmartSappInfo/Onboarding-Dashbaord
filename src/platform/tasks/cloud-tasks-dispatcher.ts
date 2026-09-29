/**
 * @fileOverview Cloud Tasks Dispatcher for Async Agent Execution (Phase 0 / Phase 7)
 *
 * Implements Cloud Run blueprint §5.2 steps 1–3 and Rule 25.
 * Records the durable run + step server-side, THEN enqueues a Cloud Task that carries only
 * `{ runId, stepNumber, idempotencyKey }`. The worker reads principal, tenant, capability and
 * input from these records — never from the task body.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Call only from trusted server code with an already-authenticated principal. The principal is
 *   persisted on the run and re-authorized by the worker at execution time.
 * - Enqueueing is idempotent: the same (runId, stepNumber, idempotencyKey) reuses the existing
 *   step and Cloud Tasks dedupes the task name. A different key for an existing step is rejected.
 * - A run is bound to one organization/workspace for its lifetime; steps cannot move it.
 */

import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { scheduleTaskWithKey } from '@/lib/gcp-tasks-client';
import type { AgentPrincipal } from '../capabilities/contracts/capability-definition';
import { requiresAgentApproval } from '../capabilities/contracts/risk-levels';
import { evaluatePrincipalAuthority } from '../capabilities/policy/principal-evaluator';
import { getCapability } from '../capabilities/registry/capability-registry';
import { ensureCapabilitiesRegistered } from '../capabilities/registry/register-capabilities';
import {
  AgentRunRecordSchema,
  AgentStepRecordSchema,
  AgentStepTaskPayloadSchema,
  MAX_STEP_INPUT_BYTES,
  StoredPrincipalSchema,
  findTenantMismatch,
  jsonByteSize,
  type AgentRunRecord,
  type AgentStepRecord,
  type AgentStepTaskPayload,
} from './agent-step-contract';
import { agentStepRefs } from './firestore-agent-step-store';

export const AGENT_WORKER_QUEUE = 'agent-worker-queue';
export const AGENT_STEP_ENDPOINT = '/api/tasks/agent-step';

export interface EnqueueCapabilityTaskOptions {
  runId: string;
  stepNumber: number;
  capabilityId: string;
  input: Record<string, unknown>;
  idempotencyKey: string;
  /** Authenticated principal the step runs as. Approval proofs are not persisted here. */
  principal: AgentPrincipal;
  correlationId?: string;
  /** Required for approval-requiring capabilities run by an agent (capability_approvals record id). */
  approvalId?: string;
  delaySeconds?: number;
}

export class AgentStepDispatchError extends Error {
  constructor(
    readonly code:
      | 'INVALID_OPTIONS'
      | 'CAPABILITY_NOT_REGISTERED'
      | 'INVALID_INPUT'
      | 'INPUT_TOO_LARGE'
      | 'TENANT_SCOPE_VIOLATION'
      | 'AUTHORIZATION_DENIED'
      | 'APPROVAL_REQUIRED'
      | 'RUN_SCOPE_CONFLICT'
      | 'IDEMPOTENCY_KEY_CONFLICT',
    message: string
  ) {
    super(message);
    this.name = 'AgentStepDispatchError';
  }
}

export interface DispatcherDeps {
  db: Firestore;
  schedule?: typeof scheduleTaskWithKey;
  nowMs?: () => number;
}

export async function enqueueAsyncCapabilityStep(
  options: EnqueueCapabilityTaskOptions,
  deps: DispatcherDeps
): Promise<{ taskKey: string; payload: AgentStepTaskPayload }> {
  const nowIso = new Date((deps.nowMs ?? Date.now)()).toISOString();

  const payloadCheck = AgentStepTaskPayloadSchema.safeParse({
    runId: options.runId,
    stepNumber: options.stepNumber,
    idempotencyKey: options.idempotencyKey,
  });
  // A queued step never runs interactively, so it always executes under agent rules (approvals,
  // non-delegable, no wildcard) — whatever actorType the caller passed.
  const stepPrincipal: AgentPrincipal = { ...options.principal, actorType: 'agent' };
  const principalCheck = StoredPrincipalSchema.safeParse(stepPrincipal);
  if (!payloadCheck.success || !principalCheck.success) {
    throw new AgentStepDispatchError('INVALID_OPTIONS', 'runId, stepNumber, idempotencyKey or principal is invalid.');
  }
  const payload = payloadCheck.data;
  const storedPrincipal = principalCheck.data;

  // Fail fast at enqueue time; the worker re-checks everything at execution time.
  ensureCapabilitiesRegistered();
  const capability = getCapability(options.capabilityId);
  if (!capability) {
    throw new AgentStepDispatchError('CAPABILITY_NOT_REGISTERED', `Capability '${options.capabilityId}' is not registered.`);
  }
  if (capability.inputSchema && !capability.inputSchema.safeParse(options.input).success) {
    throw new AgentStepDispatchError('INVALID_INPUT', 'Input failed the capability input schema.');
  }
  const inputBytes = jsonByteSize(options.input);
  if (inputBytes > Math.min(MAX_STEP_INPUT_BYTES, capability.execution.maxPayloadSizeBytes)) {
    throw new AgentStepDispatchError('INPUT_TOO_LARGE', `Step input is ${inputBytes} bytes; use a Storage reference instead.`);
  }
  const tenant = { organizationId: storedPrincipal.organizationId, workspaceId: storedPrincipal.workspaceId };
  const tenantMismatch = findTenantMismatch(options.input, tenant);
  if (tenantMismatch) {
    throw new AgentStepDispatchError('TENANT_SCOPE_VIOLATION', tenantMismatch);
  }
  // Approval-requiring agent steps must reference a server-side approval record. It is fully
  // verified (tenant, capability, payload hash) and bound by the worker at execution time.
  const needsApproval = requiresAgentApproval(capability.risk);
  if (needsApproval && !options.approvalId) {
    throw new AgentStepDispatchError('APPROVAL_REQUIRED', `Capability '${capability.id}' requires a human approval id for agent execution.`);
  }
  const authority = evaluatePrincipalAuthority(stepPrincipal, capability, tenant);
  const blocking = authority.violationCodes.filter((code) => !(needsApproval && code === 'APPROVAL_REQUIRED'));
  if (blocking.length > 0) {
    throw new AgentStepDispatchError('AUTHORIZATION_DENIED', authority.reason ?? 'Principal is not authorized.');
  }

  // Record run + step atomically before the task exists (blueprint §5.2 step 2).
  const { runRef, stepRef } = agentStepRefs(deps.db, payload);
  await deps.db.runTransaction(async (tx) => {
    const [runSnap, stepSnap] = await tx.getAll(runRef, stepRef);

    if (runSnap.exists) {
      const existingRun = AgentRunRecordSchema.safeParse(runSnap.data());
      if (
        !existingRun.success ||
        existingRun.data.organizationId !== tenant.organizationId ||
        existingRun.data.workspaceId !== tenant.workspaceId
      ) {
        throw new AgentStepDispatchError('RUN_SCOPE_CONFLICT', 'Run already exists under a different tenant or is corrupt.');
      }
    } else {
      const run: AgentRunRecord = {
        runId: payload.runId,
        ...tenant,
        principal: storedPrincipal,
        status: 'queued',
        correlationId: options.correlationId ?? randomUUID(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      tx.set(runRef, run);
    }

    if (stepSnap.exists) {
      const existingStep = AgentStepRecordSchema.safeParse(stepSnap.data());
      if (!existingStep.success || existingStep.data.idempotencyKey !== payload.idempotencyKey) {
        throw new AgentStepDispatchError('IDEMPOTENCY_KEY_CONFLICT', 'Step already exists with a different idempotency key.');
      }
      return; // Same step re-enqueued: keep the record; Cloud Tasks dedupes the task name.
    }

    const step: AgentStepRecord = {
      runId: payload.runId,
      stepNumber: payload.stepNumber,
      capabilityId: capability.id,
      capabilityVersion: capability.version,
      input: options.input,
      idempotencyKey: payload.idempotencyKey,
      ...(options.approvalId ? { approvalId: options.approvalId } : {}),
      status: 'queued',
      attempts: 0,
      leaseExpiresAt: null,
      error: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    tx.set(stepRef, step);
  });

  const taskKey = `agent-step-${payload.runId}-${payload.stepNumber}-${payload.idempotencyKey}`;
  await (deps.schedule ?? scheduleTaskWithKey)(taskKey, AGENT_WORKER_QUEUE, AGENT_STEP_ENDPOINT, payload, options.delaySeconds ?? 0);

  return { taskKey, payload };
}
