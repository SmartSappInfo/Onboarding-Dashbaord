// @vitest-environment node
/**
 * @fileOverview invokeGoverned (Phase 11 M0 · T3): classification and pinned-definition semantics.
 * A pinned definition changes only WHICH definition the gateway uses; every check still runs.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { classifyRefusal, invokeGoverned } from '../../capabilities/execution/invoke-governed';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';

let calls = 0;
const cap: AnyCapabilityDefinition = {
  id: 'test.pinned_write', version: '1.0.0', name: 'Pinned', description: 'Test', domain: 'tasks_productivity', operation: 'create',
  inputSchema: z.object({ workspaceId: z.string() }), outputSchema: z.object({ ok: z.boolean() }),
  permissions: ['rbac:operations.tasks.create'], workspaceScoped: true, tenantScoped: true,
  risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: true, maxDurationMs: 1000, supportsDryRun: true, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 1000 },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
  handler: async () => { calls += 1; return { success: true, data: { ok: true }, executionId: 'e', emittedEvents: [], durationMs: 1 }; },
};
const agent: AgentPrincipal = { actorType: 'agent', agentId: 'meeting_analyst', userId: 'u', organizationId: 'o', workspaceId: 'ws-a', grantedScopes: ['rbac:operations.tasks.create'], effectiveRole: 'member' };
const deps = { flagChecker: { checkFlag: async () => ({ enabled: true }) }, auditSink: () => undefined, outboxSink: () => undefined };
const run = (over: Partial<Parameters<typeof invokeGoverned>[0]> = {}, d: Record<string, unknown> = deps) =>
  invokeGoverned({ capability: cap, capabilityId: cap.id, surface: 'task_worker', input: { workspaceId: 'ws-a' }, principal: agent, correlationId: 'c', ...over }, d);

describe('invokeGoverned', () => {
  it('classifies refusals: authority and invalid are never retried', () => {
    expect(classifyRefusal('AUTHORIZATION_DENIED', false)).toBe('authority');
    expect(classifyRefusal('NOT_FOUND', false)).toBe('authority');
    expect(classifyRefusal('INVALID_INPUT', false)).toBe('invalid');
    expect(classifyRefusal('PROVIDER_ERROR', true)).toBe('retryable');
    expect(classifyRefusal('HANDLER_EXCEPTION', false)).toBe('retryable');
  });

  it('runs the pinned definition through the gateway', async () => {
    calls = 0;
    expect((await run()).success).toBe(true);
    expect(calls).toBe(1);
  });

  it('still refuses a wrong tenant, a missing scope and a disabled flag', async () => {
    calls = 0;
    expect((await run({ input: { workspaceId: 'ws-b' } })).success).toBe(false);
    expect((await run({ principal: { ...agent, grantedScopes: [] } })).success).toBe(false);
    expect((await run({}, { ...deps, flagChecker: { checkFlag: async () => ({ enabled: false, reason: 'off' }) } })).success).toBe(false);
    expect(calls).toBe(0);
  });

  it('a pinned definition is used only for its own id', async () => {
    const res = await run({ capabilityId: 'test.other' });
    expect(!res.success && res.error.code).toBe('CAPABILITY_NOT_REGISTERED');
  });
});
