/**
 * Permission references (D6), the non-delegable list and registry validation (agents_mcp PR-2).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { parsePermissionRef } from '../capabilities/contracts/permission-refs';
import { NON_DELEGABLE_ACTIONS, isNonDelegableAction } from '../capabilities/contracts/risk-levels';
import {
  InvalidCapabilityError,
  getCapability,
  registerCapability,
  resetCapabilityRegistryForTests,
  validateCapabilityDefinition,
} from '../capabilities/registry/capability-registry';
import { evaluatePrincipalAuthority } from '../capabilities/policy/principal-evaluator';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../capabilities/contracts/capability-definition';

const base = (overrides: Partial<AnyCapabilityDefinition> = {}): AnyCapabilityDefinition => ({
  id: 'crm.task.create',
  version: '1.0.0',
  name: 'Create task',
  description: 'Creates a task.',
  domain: 'tasks_productivity',
  operation: 'create',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  permissions: ['rbac:operations.tasks.create'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L2_STATE_MUTATION', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: true, maxDurationMs: 1000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 1024 },
  policies: { requiresIdempotencyKey: true, requiresExpectedVersion: false, auditRequired: false },
  handler: async () => ({ success: true, data: {}, executionId: 'e', emittedEvents: [], durationMs: 1 }),
  ...overrides,
});

describe('permission references (D6)', () => {
  it('resolves existing app ids and RBAC coordinates', () => {
    expect(parsePermissionRef('app:system_admin')).toEqual({ kind: 'app', id: 'system_admin' });
    expect(parsePermissionRef('rbac:operations.tasks.create')).toEqual({ kind: 'rbac', section: 'operations', feature: 'tasks', action: 'create' });
  });

  it('rejects anything that does not exist in the app', () => {
    for (const ref of ['tasks.create', 'app:nope', 'rbac:operations.tasks', 'rbac:operations.nope.view', 'rbac:nope.tasks.view', 'rbac:operations.leadIntelligence.delete', 'admin.grant_permission']) {
      expect(parsePermissionRef(ref)).toBeNull();
    }
  });
});

describe('non-delegable permissions', () => {
  it('every entry exists in the permission vocabulary', () => {
    expect(NON_DELEGABLE_ACTIONS.filter((ref) => !parsePermissionRef(ref))).toEqual([]);
  });

  it('actually blocks an agent from a non-delegable permission', () => {
    const agent: AgentPrincipal = {
      actorType: 'agent', userId: 'u', organizationId: 'o', workspaceId: 'w', agentId: 'a',
      grantedScopes: ['rbac:management.users.edit'], effectiveRole: 'agent',
    };
    const capability = base({ id: 'workforce.user.update', permissions: ['rbac:management.users.edit'] });
    expect(isNonDelegableAction('rbac:management.users.edit')).toBe(true);
    const result = evaluatePrincipalAuthority(agent, capability, { organizationId: 'o', workspaceId: 'w' });
    expect(result.allowed).toBe(false);
    expect(result.violationCodes).toContain('NON_DELEGABLE');
  });
});

describe('capability registry validation', () => {
  beforeEach(() => resetCapabilityRegistryForTests());

  it('registers a valid definition', () => {
    registerCapability(base());
    expect(getCapability('crm.task.create')).toBeDefined();
  });

  it('refuses invalid definitions with every problem listed', () => {
    const cases: Array<[Partial<AnyCapabilityDefinition>, RegExp]> = [
      [{ version: '1.0' }, /SemVer/],
      [{ permissions: [] }, /permissions is empty/],
      [{ permissions: ['tasks.create'] }, /not a valid app:\/rbac: reference/],
      [{ risk: { ...base().risk, level: 'L4_PRIVILEGED_DESTRUCTIVE' } }, /requiresHumanApproval/],
      [{ permissions: ['rbac:operations.tasks.create'], public: { reason: 'x' } }, /public capability/],
    ];
    for (const [overrides, message] of cases) {
      expect(() => registerCapability(base(overrides))).toThrow(InvalidCapabilityError);
      expect(validateCapabilityDefinition(base(overrides)).join('; ')).toMatch(message);
    }
    expect(getCapability('crm.task.create')).toBeUndefined();
  });

  it('allows an explicitly public capability with a reason', () => {
    expect(validateCapabilityDefinition(base({ permissions: [], public: { reason: 'Public catalogue read.' } }))).toEqual([]);
  });
});
