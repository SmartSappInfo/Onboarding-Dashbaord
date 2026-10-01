// @vitest-environment node
/**
 * @fileOverview Agent-step worker tests (round-2 blocker R1)
 *
 * Exercises the real executor + real Firestore store + real dispatcher against an in-memory
 * Firestore fake. The core guarantee under test: a step is only ever marked `completed` when
 * its capability actually ran and returned valid output.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod/v4';
import type {
  AgentPrincipal,
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../capabilities/contracts/capability-definition';
import {
  registerCapability,
  getCapability,
  resetCapabilityRegistryForTests,
} from '../capabilities/registry/capability-registry';
import { decideStepClaim, type AgentRunRecord, type AgentStepRecord } from '../tasks/agent-step-contract';
import { processAgentStep } from '../tasks/agent-step-executor';
import { createFirestoreAgentStepStore } from '../tasks/firestore-agent-step-store';
import { AgentStepDispatchError, enqueueAsyncCapabilityStep } from '../tasks/cloud-tasks-dispatcher';
import { FakeFirestore } from './helpers/fake-firestore';

const RUN_ID = 'run-001';
const KEY = 'idem-key-0001';
const RUN_PATH = `agent_runs/${RUN_ID}`;
const STEP_PATH = `agent_runs/${RUN_ID}/steps/0`;

const principal: AgentPrincipal & { actorType: 'agent' } = {
  actorType: 'agent',
  userId: 'user-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  agentId: 'crm-agent',
  grantedScopes: ['tasks.create'],
  effectiveRole: 'agent',
};

type TaskInput = { title: string; workspaceId?: string };
type TaskOutput = { taskId: string };

function buildCapability(
  handler: (input: TaskInput, ctx: CapabilityExecutionContext) => Promise<CapabilityExecutionResult<TaskOutput>>,
  overrides: Partial<CapabilityDefinition<TaskInput, TaskOutput>> = {}
): CapabilityDefinition<TaskInput, TaskOutput> {
  return {
    id: 'crm.task.create',
    version: '1.0.0',
    name: 'Create task',
    description: 'Creates a task',
    domain: 'tasks_productivity',
    operation: 'create',
    // `.trim()` proves the handler receives PARSED data, not raw stored input.
    inputSchema: z.object({ title: z.string().trim().min(1), workspaceId: z.string().optional() }),
    outputSchema: z.object({ taskId: z.string() }),
    permissions: ['tasks.create'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L2_STATE_MUTATION',
      destructive: false,
      idempotent: true,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 2_000,
      supportsDryRun: false,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 64 * 1024,
    },
    // Agent steps refuse audit-required capabilities until the execution audit exists (PR-6).
    policies: { requiresIdempotencyKey: true, requiresExpectedVersion: false, auditRequired: false },
    handler,
    ...overrides,
  };
}

const ok = (taskId = 'task-1'): CapabilityExecutionResult<TaskOutput> => ({
  success: true,
  data: { taskId },
  executionId: 'exec-1',
  emittedEvents: [],
  durationMs: 1,
});

function seedRunAndStep(db: FakeFirestore, step: Partial<AgentStepRecord> = {}, run: Partial<AgentRunRecord> = {}): void {
  const now = '2026-09-27T10:00:00.000Z';
  db.write(RUN_PATH, {
    runId: RUN_ID,
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    principal,
    status: 'queued',
    correlationId: 'corr-1',
    createdAt: now,
    updatedAt: now,
    ...run,
  });
  db.write(STEP_PATH, {
    runId: RUN_ID,
    stepNumber: 0,
    capabilityId: 'crm.task.create',
    capabilityVersion: '1.0.0',
    input: { title: '  Follow up  ' },
    idempotencyKey: KEY,
    status: 'queued',
    attempts: 0,
    leaseExpiresAt: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    ...step,
  });
}

const payload = { runId: RUN_ID, stepNumber: 0, idempotencyKey: KEY };

describe('agent-step worker', () => {
  let db: FakeFirestore;
  // The live principal check (PR-2): allowed unless a case revokes it.
  let liveResult: { ok: true } | { ok: false; reason: string } = { ok: true };
  const run = (raw: unknown = payload) =>
    processAgentStep(raw, {
      store: createFirestoreAgentStepStore(db.asFirestore()),
      resolveCapability: getCapability,
      principals: { check: async () => liveResult },
    });

  beforeEach(() => {
    db = new FakeFirestore();
    resetCapabilityRegistryForTests();
    liveResult = { ok: true };
  });

  it('executes the capability with parsed input and only then marks the step completed', async () => {
    const handler = vi.fn(async (input: TaskInput, ctx: CapabilityExecutionContext) => {
      expect(input.title).toBe('Follow up'); // trimmed by the schema
      expect(ctx.idempotencyKey).toBe(KEY);
      expect(ctx.principal.runId).toBe(RUN_ID);
      expect(ctx.correlationId).toBe('corr-1');
      return ok('task-42');
    });
    registerCapability(buildCapability(handler));
    seedRunAndStep(db);

    const outcome = await run();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ httpStatus: 200, body: { status: 'completed' } });
    expect(db.read(STEP_PATH)).toMatchObject({
      status: 'completed',
      attempts: 1,
      leaseExpiresAt: null,
      result: { truncated: false, data: { taskId: 'task-42' } },
    });
    expect(db.read(RUN_PATH)).toMatchObject({ status: 'running', lastCompletedStep: 0 });
  });

  it('fails (never completes) a step whose capability is not registered', async () => {
    seedRunAndStep(db);
    const outcome = await run();
    expect(outcome.body).toMatchObject({ status: 'failed', code: 'CAPABILITY_NOT_REGISTERED' });
    expect(db.read(STEP_PATH)).toMatchObject({ status: 'failed' });
    expect(db.read(RUN_PATH)).toMatchObject({ status: 'failed', failedStep: 0 });
  });

  it('refuses to run a step against a different capability version than it was queued for', async () => {
    const handler = vi.fn(async () => ok());
    registerCapability(buildCapability(handler, { version: '2.0.0' }));
    seedRunAndStep(db);
    const outcome = await run();
    expect(handler).not.toHaveBeenCalled();
    expect(outcome.body).toMatchObject({ status: 'failed', code: 'CAPABILITY_VERSION_MISMATCH' });
  });

  it('rejects malformed payloads with 400 and touches nothing', async () => {
    seedRunAndStep(db);
    const outcome = await run({ runId: '../etc', stepNumber: 'zero' });
    expect(outcome.httpStatus).toBe(400);
    expect(db.read(STEP_PATH)).toMatchObject({ status: 'queued', attempts: 0 });
  });

  it('is idempotent: a completed step is not re-executed', async () => {
    const handler = vi.fn(async () => ok());
    registerCapability(buildCapability(handler));
    seedRunAndStep(db, { status: 'completed', attempts: 1 });
    const outcome = await run();
    expect(handler).not.toHaveBeenCalled();
    expect(outcome.body.status).toBe('already_completed');
  });

  it('rejects a delivery whose idempotency key does not match the recorded step', async () => {
    const handler = vi.fn(async () => ok());
    registerCapability(buildCapability(handler));
    seedRunAndStep(db);
    const outcome = await run({ ...payload, idempotencyKey: 'other-key-999' });
    expect(handler).not.toHaveBeenCalled();
    expect(outcome.body).toMatchObject({ status: 'rejected', code: 'IDEMPOTENCY_KEY_MISMATCH' });
  });

  it('lets only one of two concurrent deliveries execute (transactional claim)', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const handler = vi.fn(async () => {
      await gate;
      return ok();
    });
    registerCapability(buildCapability(handler));
    seedRunAndStep(db);

    const first = run();
    const second = await run(); // first holds the lease while its handler is blocked
    release();
    const firstOutcome = await first;

    expect(handler).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ httpStatus: 409, body: { status: 'in_progress' } });
    expect(firstOutcome.body.status).toBe('completed');
  });

  it('reclaims a step whose lease expired (crashed attempt)', async () => {
    const handler = vi.fn(async () => ok());
    registerCapability(buildCapability(handler));
    seedRunAndStep(db, { status: 'running', attempts: 1, leaseExpiresAt: '2000-01-01T00:00:00.000Z' });
    const outcome = await run();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(outcome.body.status).toBe('completed');
    expect(db.read(STEP_PATH)).toMatchObject({ attempts: 2 });
  });

  it('re-authorizes at execution time and fails when scopes were revoked', async () => {
    const handler = vi.fn(async () => ok());
    registerCapability(buildCapability(handler));
    seedRunAndStep(db, {}, { principal: { ...principal, grantedScopes: [] } });
    const outcome = await run();
    expect(handler).not.toHaveBeenCalled();
    expect(outcome.body).toMatchObject({ status: 'failed', code: 'AUTHORIZATION_DENIED' });
  });

  it('refuses input that targets another workspace than the run', async () => {
    const handler = vi.fn(async () => ok());
    registerCapability(buildCapability(handler));
    seedRunAndStep(db, { input: { title: 'x', workspaceId: 'ws-OTHER' } });
    const outcome = await run();
    expect(handler).not.toHaveBeenCalled();
    expect(outcome.body).toMatchObject({ status: 'failed', code: 'TENANT_SCOPE_VIOLATION' });
  });

  it('returns 503 and releases the lease on a retryable capability failure', async () => {
    registerCapability(
      buildCapability(async () => ({
        success: false,
        error: { code: 'PROVIDER_429', message: 'rate limited', retryable: true },
        executionId: 'e',
      }))
    );
    seedRunAndStep(db);
    const outcome = await run();
    expect(outcome).toMatchObject({ httpStatus: 503, body: { status: 'retry_pending', code: 'PROVIDER_429' } });
    expect(db.read(STEP_PATH)).toMatchObject({ status: 'retry_pending', leaseExpiresAt: null });
  });

  it('fails permanently on a non-retryable capability failure', async () => {
    registerCapability(
      buildCapability(async () => ({
        success: false,
        error: { code: 'NOT_FOUND', message: 'no such contact', retryable: false },
        executionId: 'e',
      }))
    );
    seedRunAndStep(db);
    const outcome = await run();
    expect(outcome).toMatchObject({ httpStatus: 200, body: { status: 'failed', code: 'NOT_FOUND' } });
  });

  it('keeps the lease on timeout because the handler may still be running', async () => {
    registerCapability(
      buildCapability(() => new Promise<never>(() => undefined), {
        execution: {
          synchronous: true,
          maxDurationMs: 20,
          supportsDryRun: false,
          supportsCancellation: false,
          supportsCompensation: false,
          maxPayloadSizeBytes: 1024,
        },
      })
    );
    seedRunAndStep(db);
    const outcome = await run();
    expect(outcome).toMatchObject({ httpStatus: 503, body: { code: 'TIMEOUT' } });
    const step = db.read(STEP_PATH);
    expect(step).toMatchObject({ status: 'running' });
    expect(typeof step?.leaseExpiresAt).toBe('string');
  });

  it('returns 503 without leaking detail when the handler throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    registerCapability(
      buildCapability(async () => {
        throw new Error('secret connection string');
      })
    );
    seedRunAndStep(db);
    const outcome = await run();
    expect(outcome).toMatchObject({ httpStatus: 503, body: { code: 'HANDLER_EXCEPTION' } });
    expect(JSON.stringify(db.read(STEP_PATH))).not.toContain('secret connection string');
    spy.mockRestore();
  });

  it('fails a step whose output violates the output schema', async () => {
    registerCapability(
      buildCapability(async () => ({
        success: true,
        data: { taskId: 123 as unknown as string },
        executionId: 'e',
        emittedEvents: [],
        durationMs: 1,
      }))
    );
    seedRunAndStep(db);
    const outcome = await run();
    expect(outcome.body).toMatchObject({ status: 'failed', code: 'INVALID_OUTPUT' });
    expect(db.read(STEP_PATH)).not.toMatchObject({ status: 'completed' });
  });

  it('dead-letters a step that exhausted its attempts', async () => {
    const handler = vi.fn(async () => ok());
    registerCapability(buildCapability(handler));
    seedRunAndStep(db, { status: 'retry_pending', attempts: 5 });
    const outcome = await run();
    expect(handler).not.toHaveBeenCalled();
    expect(outcome.body).toMatchObject({ status: 'rejected', code: 'MAX_ATTEMPTS_EXCEEDED' });
    expect(db.read(STEP_PATH)).toMatchObject({ status: 'failed' });
  });

  it('does not execute steps of a cancelled run', async () => {
    const handler = vi.fn(async () => ok());
    registerCapability(buildCapability(handler));
    seedRunAndStep(db, {}, { status: 'cancelled' });
    const outcome = await run();
    expect(handler).not.toHaveBeenCalled();
    expect(outcome.body).toMatchObject({ status: 'rejected', code: 'RUN_NOT_ACTIVE' });
  });

  it('rejects corrupt stored records instead of executing them', async () => {
    const handler = vi.fn(async () => ok());
    registerCapability(buildCapability(handler));
    seedRunAndStep(db);
    db.write(RUN_PATH, { runId: RUN_ID, principal: 'not-an-object' });
    const outcome = await run();
    expect(handler).not.toHaveBeenCalled();
    expect(outcome.body).toMatchObject({ status: 'rejected', code: 'RECORD_CORRUPT' });
  });
});

describe('decideStepClaim', () => {
  const baseRun = {
    runId: RUN_ID,
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    principal,
    status: 'running' as const,
    correlationId: 'c',
    createdAt: '',
    updatedAt: '',
  };
  const baseStep: AgentStepRecord = {
    runId: RUN_ID,
    stepNumber: 0,
    capabilityId: 'x',
    capabilityVersion: '1.0.0',
    input: {},
    idempotencyKey: KEY,
    status: 'queued',
    attempts: 0,
    createdAt: '',
    updatedAt: '',
  };

  it('treats a missing run or step as a rejection, not a claim', () => {
    expect(decideStepClaim({ run: null, step: baseStep, idempotencyKey: KEY, nowMs: 0 })).toMatchObject({ code: 'RUN_NOT_FOUND' });
    expect(decideStepClaim({ run: baseRun, step: null, idempotencyKey: KEY, nowMs: 0 })).toMatchObject({ code: 'STEP_NOT_FOUND' });
  });

  it('honours an active lease and reclaims an expired one', () => {
    const leased = { ...baseStep, status: 'running' as const, attempts: 1, leaseExpiresAt: new Date(10_000).toISOString() };
    expect(decideStepClaim({ run: baseRun, step: leased, idempotencyKey: KEY, nowMs: 5_000 }).kind).toBe('in_progress');
    expect(decideStepClaim({ run: baseRun, step: leased, idempotencyKey: KEY, nowMs: 20_000 })).toEqual({ kind: 'claim', attempt: 2 });
  });
});

describe('enqueueAsyncCapabilityStep', () => {
  let db: FakeFirestore;
  const schedule = vi.fn(async () => 'task-name');
  const enqueue = (overrides: Partial<Parameters<typeof enqueueAsyncCapabilityStep>[0]> = {}) =>
    enqueueAsyncCapabilityStep(
      { runId: RUN_ID, stepNumber: 0, capabilityId: 'crm.task.create', input: { title: 'Call back' }, idempotencyKey: KEY, principal, ...overrides },
      { db: db.asFirestore(), schedule }
    );

  beforeEach(() => {
    db = new FakeFirestore();
    schedule.mockClear();
    resetCapabilityRegistryForTests();
    registerCapability(buildCapability(async () => ok()));
  });

  it('records run + step server-side and enqueues only ids', async () => {
    await enqueue();
    expect(db.read(RUN_PATH)).toMatchObject({ organizationId: 'org-1', workspaceId: 'ws-1', status: 'queued', principal: { userId: 'user-1' } });
    expect(db.read(STEP_PATH)).toMatchObject({ capabilityId: 'crm.task.create', capabilityVersion: '1.0.0', input: { title: 'Call back' }, status: 'queued', attempts: 0 });
    expect(schedule).toHaveBeenCalledWith(
      `agent-step-${RUN_ID}-0-${KEY}`,
      'agent-worker-queue',
      '/api/tasks/agent-step',
      { runId: RUN_ID, stepNumber: 0, idempotencyKey: KEY },
      0
    );
  });

  it('is idempotent for the same key and rejects a different key', async () => {
    await enqueue();
    await enqueue();
    expect(schedule).toHaveBeenCalledTimes(2); // Cloud Tasks dedupes by task name
    await expect(enqueue({ idempotencyKey: 'another-key-1' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
  });

  it('refuses to move a run to another tenant', async () => {
    await enqueue();
    await expect(
      enqueue({ stepNumber: 1, idempotencyKey: 'idem-key-0002', principal: { ...principal, workspaceId: 'ws-2' } })
    ).rejects.toMatchObject({ code: 'RUN_SCOPE_CONFLICT' });
  });

  it('fails fast on unregistered capabilities, denied authority and cross-tenant input', async () => {
    await expect(enqueue({ capabilityId: 'nope' })).rejects.toBeInstanceOf(AgentStepDispatchError);
    await expect(enqueue({ principal: { ...principal, grantedScopes: [] } })).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });
    await expect(enqueue({ input: { title: 'x', workspaceId: 'ws-9' } })).rejects.toMatchObject({ code: 'TENANT_SCOPE_VIOLATION' });
    expect(schedule).not.toHaveBeenCalled();
    expect(db.read(STEP_PATH)).toBeUndefined();
  });
});

describe('ensureCapabilitiesRegistered', () => {
  it('runs each registrar so a fresh worker process can resolve capabilities', async () => {
    const { ensureCapabilitiesRegistered } = await import('../capabilities/registry/register-capabilities');
    resetCapabilityRegistryForTests();
    const capability = buildCapability(async () => ok());
    ensureCapabilitiesRegistered([() => registerCapability(capability)]);
    expect(getCapability('crm.task.create')).toBe(capability);
    // Registrars must be idempotent: re-running with the same definition is a no-op.
    expect(() => ensureCapabilitiesRegistered([() => registerCapability(capability)])).not.toThrow();
  });
});
