/**
 * @fileOverview Governed gateway defaults (Phase 11 M0 · T1, finding F2).
 *
 * `executeCapability` used to skip idempotency when no store was passed, skip the live standing
 * check when no checker was passed, and had no approval verifier unless one was injected. Callers
 * such as the MCP handler passed none. Production dependencies are now the default. A provided
 * value wins; a missing or `undefined` value gets the default (M0 review R2).
 * Idempotency keys are namespaced by tenant + capability before storage (M0 review R1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod/v4';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import {
  buildProductionGatewayDeps,
  createActorStandingCheck,
  resolveGatewayDeps,
  setGovernedGatewayDepsForTests,
} from '../../capabilities/execution/governed-deps';
import { createInMemoryIdempotencyStore } from '../../capabilities/storage/execution-store';
import { createInMemoryApprovalStore } from '../../capabilities/storage/approval-store';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
} from '../../capabilities/contracts/capability-definition';
import type { CapabilityInvocation } from '../../capabilities/execution/invocation';

const user: AgentPrincipal = {
  actorType: 'user', userId: 'user-1', organizationId: 'org-1', workspaceId: 'ws-1',
  grantedScopes: ['app:tasks_manage'], effectiveRole: 'admin',
};
const agent: AgentPrincipal = { ...user, actorType: 'agent', agentId: 'crm_researcher' };
const service: AgentPrincipal = { ...agent, userId: 'service:automation', agentId: 'service:automation' };
const apiKey: AgentPrincipal = { ...agent, userId: 'api_key:key-1', agentId: 'api_key:key-1' };

describe('createActorStandingCheck', () => {
  const live = (ok: boolean) => ({ check: vi.fn(async () => (ok ? { ok: true as const } : { ok: false as const, reason: 'gone' })) });

  it('does not re-check interactive users (resolved from the session for this request)', async () => {
    const principals = live(false);
    const check = createActorStandingCheck({ livePrincipals: () => principals, lookupApiKey: async () => null });
    expect(await check(user)).toEqual({ active: true });
    expect(principals.check).not.toHaveBeenCalled();
  });

  it('re-checks the user behind an agent live', async () => {
    const check = createActorStandingCheck({ livePrincipals: () => live(false), lookupApiKey: async () => null });
    expect(await check(agent)).toEqual({ active: false, reason: 'gone' });
  });

  it('accepts pinned service principals without a user lookup', async () => {
    const principals = live(false);
    const check = createActorStandingCheck({ livePrincipals: () => principals, lookupApiKey: async () => null });
    expect(await check(service)).toEqual({ active: true });
    expect(principals.check).not.toHaveBeenCalled();
  });

  it('refuses revoked, expired or missing API keys', async () => {
    const at = (key: { revoked: boolean; expiresAt?: string } | null) =>
      createActorStandingCheck({ livePrincipals: () => live(true), lookupApiKey: async () => key, nowMs: () => Date.UTC(2026, 9, 5) });
    expect(await at({ revoked: false })(apiKey)).toEqual({ active: true });
    expect((await at({ revoked: true })(apiKey)).active).toBe(false);
    expect((await at({ revoked: false, expiresAt: '2026-01-01T00:00:00.000Z' })(apiKey)).active).toBe(false);
    expect((await at(null)(apiKey)).active).toBe(false);
  });
});

describe('resolveGatewayDeps', () => {
  // Use the production defaults here (the global test setup installs an empty override).
  afterEach(() => setGovernedGatewayDepsForTests({}));
  const useProductionDefaults = () => setGovernedGatewayDepsForTests(undefined);

  it('production defaults include every governed dependency', () => {
    const deps = buildProductionGatewayDeps();
    expect(deps.idempotencyStore).toBeDefined();
    expect(deps.approvals).toBeDefined();
    expect(deps.verifyActorStanding).toBeDefined();
  });

  it('fills every governed dependency when the caller injects none', () => {
    useProductionDefaults();
    const deps = resolveGatewayDeps(undefined);
    expect(deps.idempotencyStore).toBeDefined();
    expect(deps.approvals).toBeDefined();
    expect(deps.verifyActorStanding).toBeDefined();
  });

  it('fills only the keys the caller did not provide', () => {
    useProductionDefaults();
    const registryLookup = () => undefined;
    const deps = resolveGatewayDeps({ registryLookup });
    expect(deps.registryLookup).toBe(registryLookup);
    expect(deps.idempotencyStore).toBeDefined();
  });

  it('treats an undefined value as "use the default" (forwarded optional deps never disable governance)', () => {
    useProductionDefaults();
    const deps = resolveGatewayDeps({ idempotencyStore: undefined, approvals: undefined, verifyActorStanding: undefined });
    expect(deps.idempotencyStore).toBeDefined();
    expect(deps.approvals).toBeDefined();
    expect(deps.verifyActorStanding).toBeDefined();
  });
});

describe('executeCapability with default deps', () => {
  let calls = 0;
  const capability: AnyCapabilityDefinition = {
    id: 'test.counter',
    version: '1.0.0',
    name: 'Counter',
    description: 'Counts handler calls',
    domain: 'tasks_productivity',
    operation: 'create',
    inputSchema: z.object({ workspaceId: z.string() }),
    outputSchema: z.object({ count: z.number() }),
    permissions: [],
    workspaceScoped: true,
    tenantScoped: true,
    risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: false, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
    execution: { synchronous: true, maxDurationMs: 5_000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 10_000 },
    policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
    handler: async () => {
      calls += 1;
      return { success: true, data: { count: calls }, executionId: `exec-${calls}`, emittedEvents: [], durationMs: 1 };
    },
  };

  const invocation = (overrides: Partial<CapabilityInvocation> = {}): CapabilityInvocation => ({
    capabilityId: capability.id,
    surface: 'ui',
    input: { workspaceId: 'ws-1' },
    correlationId: 'corr-1',
    principal: user,
    ...overrides,
  });

  it('replays a repeated idempotency key instead of running the handler twice', async () => {
    calls = 0;
    const idempotencyStore = createInMemoryIdempotencyStore();
    const deps = { registryLookup: () => capability, idempotencyStore, flagChecker: { checkFlag: () => ({ enabled: true }) }, auditSink: () => undefined };
    const first = await executeCapability(invocation({ idempotencyKey: 'key-1' }), deps);
    const second = await executeCapability(invocation({ idempotencyKey: 'key-1' }), deps);
    expect(first.success && second.success).toBe(true);
    expect(calls).toBe(1);
  });

  it('never replays one workspace\'s result to another workspace using the same raw key', async () => {
    calls = 0;
    const idempotencyStore = createInMemoryIdempotencyStore();
    const deps = { registryLookup: () => capability, idempotencyStore, flagChecker: { checkFlag: () => ({ enabled: true }) }, auditSink: () => undefined };
    const otherWorkspace: AgentPrincipal = { ...user, workspaceId: 'ws-2' };
    const first = await executeCapability(invocation({ idempotencyKey: 'mtg_task_m1_a1' }), deps);
    const second = await executeCapability(
      invocation({ idempotencyKey: 'mtg_task_m1_a1', principal: otherWorkspace, input: { workspaceId: 'ws-2' } }),
      deps
    );
    expect(first.success && second.success).toBe(true);
    expect(calls).toBe(2);
    expect(await idempotencyStore.get('mtg_task_m1_a1')).toBeNull();
  });

  it('a duplicate refused while the first call runs does not fail the first call\'s lease', async () => {
    calls = 0;
    const idempotencyStore = createInMemoryIdempotencyStore();
    let release: () => void = () => undefined;
    let started = false;
    const slow: AnyCapabilityDefinition = {
      ...capability,
      handler: async () => {
        await new Promise<void>((resolve) => { release = resolve; started = true; });
        calls += 1;
        return { success: true, data: { count: calls }, executionId: 'exec-slow', emittedEvents: [], durationMs: 1 };
      },
    };
    const deps = { registryLookup: () => slow, idempotencyStore, flagChecker: { checkFlag: () => ({ enabled: true }) }, auditSink: () => undefined };
    const firstPromise = executeCapability(invocation({ idempotencyKey: 'key-dup' }), deps);
    // The handler is running, so the first call holds the lease.
    await vi.waitFor(() => expect(started).toBe(true));
    const duplicate = await executeCapability(invocation({ idempotencyKey: 'key-dup' }), deps);
    expect(duplicate.success).toBe(false);
    release();
    const first = await firstPromise;
    expect(first.success).toBe(true);
    const third = await executeCapability(invocation({ idempotencyKey: 'key-dup' }), deps);
    expect(third.success).toBe(true);
    expect(calls).toBe(1);
  });

  it('refuses an agent whose user lost standing (standing check from governed-deps)', async () => {
    const readCapability: AnyCapabilityDefinition = {
      ...capability,
      id: 'test.read',
      domain: 'crm_contacts',
      operation: 'read',
      risk: { ...capability.risk, level: 'L0_READ', idempotent: true },
    };
    const deps = {
      registryLookup: () => readCapability,
      flagChecker: { checkFlag: () => ({ enabled: true }) },
      auditSink: () => undefined,
      verifyActorStanding: createActorStandingCheck({
        livePrincipals: () => ({ check: async () => ({ ok: false as const, reason: 'The user is no longer approved.' }) }),
        lookupApiKey: async () => null,
      }),
      approvals: createInMemoryApprovalStore(),
    };
    const outcome = await executeCapability(
      invocation({ capabilityId: readCapability.id, principal: agent, surface: 'agent' }),
      deps
    );
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.error.code).toBe('ACTOR_REVOKED');
      expect(outcome.error.stateChanged).toBe('no');
    }
  });
});
