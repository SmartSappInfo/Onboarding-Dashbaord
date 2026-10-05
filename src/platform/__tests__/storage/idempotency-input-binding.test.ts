// @vitest-environment node
/**
 * @fileOverview An idempotency key is bound to the input it was first used with
 * (Phase 11 M2 review R5; Rules 19, 20).
 *
 * Before: a completed record was replayed by key alone, so reusing a key with DIFFERENT input
 * silently returned another request's result (reachable since workflow steps use deterministic
 * keys `wf_{workflowId}_{stepId}`). Now the lease stores the input hash and a mismatch is refused
 * with IDEMPOTENCY_KEY_REUSED (409, not retryable) without running or replaying anything.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { buildExecutionKey, createInMemoryIdempotencyStore, type ExtendedIdempotencyStore } from '../../capabilities/storage/execution-store';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import { classifyRefusal } from '../../capabilities/execution/invoke-governed';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';

const principal: AgentPrincipal = {
  actorType: 'user', userId: 'u-1', organizationId: 'org-1', workspaceId: 'ws-1',
  grantedScopes: ['rbac:operations.tasks.create'], effectiveRole: 'member',
};

let calls: string[];
const cap: AnyCapabilityDefinition = {
  id: 'task.test_create', version: '1.0.0', name: 'Create', description: 'Creates a task', domain: 'tasks_productivity', operation: 'create',
  inputSchema: z.object({ title: z.string() }), outputSchema: z.object({ taskId: z.string() }),
  permissions: ['rbac:operations.tasks.create'], workspaceScoped: true, tenantScoped: true,
  risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: true, maxDurationMs: 2000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 10_000 },
  policies: { requiresIdempotencyKey: true, requiresExpectedVersion: false, auditRequired: false },
  handler: async (input) => {
    const title = z.object({ title: z.string() }).parse(input).title;
    calls.push(title);
    return { success: true, data: { taskId: `t-${title}` }, executionId: 'e', emittedEvents: [], durationMs: 1 };
  },
};

let store: ExtendedIdempotencyStore;
const run = (title: string, key = 'wf_1_step_a') =>
  executeCapability(
    { capabilityId: cap.id, surface: 'ui', input: { title }, principal, correlationId: 'c', idempotencyKey: key },
    { registryLookup: () => cap, idempotencyStore: store, auditSink: () => undefined, outboxSink: () => undefined }
  );

beforeEach(() => {
  calls = [];
  store = createInMemoryIdempotencyStore();
});

describe('idempotency keys are bound to their input (review R5)', () => {
  it('same key + same input replays the stored result without running again', async () => {
    await run('Call Ama');
    const again = await run('Call Ama');
    expect(again.success && again.data).toEqual({ taskId: 't-Call Ama' });
    expect(calls).toEqual(['Call Ama']);
  });

  it('same key + different input is refused, never replayed and never run', async () => {
    await run('Call Ama');
    const other = await run('Email Kofi');
    expect(other.success).toBe(false);
    if (other.success) return;
    expect(other.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(other.error.httpStatus).toBe(409);
    expect(other.error.retryable).toBe(false);
    expect(other.error.stateChanged).toBe('no');
    expect(calls).toEqual(['Call Ama']);
  });

  it('a different input while the first is still running is refused as key reuse, not "in progress"', async () => {
    const key = buildExecutionKey('org-1', 'ws-1', cap.id, 'wf_1_step_b');
    await store.claim(key, { leaseMs: 60_000, nowMs: Date.now(), inputHash: 'hash-of-something-else' });
    const res = await run('Call Ama', 'wf_1_step_b');
    expect(!res.success && res.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(calls).toEqual([]);
  });

  it('after a failed attempt the key may be re-used with corrected input', async () => {
    const key = buildExecutionKey('org-1', 'ws-1', cap.id, 'wf_1_step_c');
    await store.claim(key, { leaseMs: 60_000, nowMs: Date.now(), inputHash: 'old-hash' });
    await store.fail(key);
    const res = await run('Call Ama', 'wf_1_step_c');
    expect(res.success).toBe(true);
    expect((await store.get(key))?.inputHash).toBeDefined();
    expect((await store.get(key))?.inputHash).not.toBe('old-hash');
  });

  it('records written before this change (no hash) still replay', async () => {
    const key = buildExecutionKey('org-1', 'ws-1', cap.id, 'wf_legacy');
    await store.claim(key, { leaseMs: 60_000, nowMs: Date.now() });
    await store.complete(key, { taskId: 't-legacy' });
    const res = await run('anything', 'wf_legacy');
    expect(res.success && res.data).toEqual({ taskId: 't-legacy' });
    expect(calls).toEqual([]);
  });

  it('internal callers never retry a key-reuse refusal', () => {
    expect(classifyRefusal('IDEMPOTENCY_KEY_REUSED', false)).toBe('invalid');
  });
});
