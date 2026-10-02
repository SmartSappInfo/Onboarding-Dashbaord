// @vitest-environment node
/**
 * @fileOverview Unit tests for Capability Registry, Permission References (D6) & Risk Invariants (PR-2)
 *
 * Validates SemVer conformance, non-empty permission requirements, high-risk
 * human approval invariants, D6 permission references, and canonical non-delegable coordinate checks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import type { AgentPrincipal, AnyCapabilityDefinition, CapabilityDefinition } from '../capabilities/contracts/capability-definition';
import { parsePermissionRef } from '../capabilities/contracts/permission-refs';
import {
  NON_DELEGABLE_ACTIONS,
  isNonDelegableAction,
} from '../capabilities/contracts/risk-levels';
import {
  registerCapability,
  getCapability,
  resetCapabilityRegistryForTests,
  validateCapabilityDefinition,
  DuplicateCapabilityError,
  InvalidCapabilityError,
} from '../capabilities/registry/capability-registry';
import { evaluatePrincipalAuthority } from '../capabilities/policy/principal-evaluator';

function createValidCapability(
  overrides: Partial<CapabilityDefinition<Record<string, unknown>, Record<string, unknown>>> = {}
): CapabilityDefinition<Record<string, unknown>, Record<string, unknown>> {
  return {
    id: 'test.entity.action',
    version: '1.0.0',
    name: 'Test Action',
    description: 'A test capability for registry validation',
    domain: 'platform_integrations',
    operation: 'execute',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    permissions: ['app:system_admin'],
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
      maxDurationMs: 1000,
      supportsDryRun: false,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024,
    },
    policies: {
      requiresIdempotencyKey: true,
      requiresExpectedVersion: false,
      auditRequired: false,
    },
    handler: async () => ({
      success: true,
      data: {},
      executionId: 'exec-test',
      emittedEvents: [],
      durationMs: 1,
    }),
    ...overrides,
  };
}

describe('Capability Registry Invariants & Validation (PR-2)', () => {
  beforeEach(() => {
    resetCapabilityRegistryForTests();
  });

  describe('SemVer validation', () => {
    it('accepts standard SemVer versions (1.0.0, 0.1.0-alpha.1)', () => {
      const cap1 = createValidCapability({ id: 'test.v1', version: '1.0.0' });
      const cap2 = createValidCapability({ id: 'test.v2', version: '0.1.0-alpha.1' });
      expect(() => registerCapability(cap1)).not.toThrow();
      expect(() => registerCapability(cap2)).not.toThrow();
      expect(getCapability('test.v1')).toBe(cap1);
      expect(getCapability('test.v2')).toBe(cap2);
    });

    it('rejects non-SemVer versions', () => {
      const invalidVersions = ['v1.0.0', '1.0', 'draft', '', '1.0.0.0'];
      for (const v of invalidVersions) {
        const cap = createValidCapability({ id: `test.invalid.${v}`, version: v });
        expect(() => registerCapability(cap)).toThrow(InvalidCapabilityError);
      }
    });
  });

  describe('Permissions validation', () => {
    it('rejects capabilities with empty permissions array when not public', () => {
      const cap = createValidCapability({ permissions: [] });
      expect(() => registerCapability(cap)).toThrow(InvalidCapabilityError);
    });

    it('rejects capabilities with blank or whitespace-only permission strings', () => {
      const cap = createValidCapability({ permissions: ['   '] });
      expect(() => registerCapability(cap)).toThrow(InvalidCapabilityError);
    });

    it('allows an explicitly public capability with a reason', () => {
      const cap = createValidCapability({
        permissions: [],
        public: { reason: 'Public catalogue read.' },
      });
      expect(validateCapabilityDefinition(cap)).toEqual([]);
      expect(() => registerCapability(cap)).not.toThrow();
    });
  });

  describe('Risk level & Human approval invariant (Rules 21 & 22)', () => {
    it('rejects L3 capabilities without requiresHumanApproval: true', () => {
      const cap = createValidCapability({
        risk: {
          level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
          destructive: false,
          idempotent: false,
          openWorld: true,
          requiresHumanApproval: false, // Invariant violation!
          nonDelegable: false,
        },
      });
      expect(() => registerCapability(cap)).toThrow(InvalidCapabilityError);
      expect(validateCapabilityDefinition(cap).join('; ')).toMatch(/requiresHumanApproval/);
    });

    it('rejects L4 capabilities without requiresHumanApproval: true', () => {
      const cap = createValidCapability({
        risk: {
          level: 'L4_PRIVILEGED_DESTRUCTIVE',
          destructive: true,
          idempotent: false,
          openWorld: false,
          requiresHumanApproval: false, // Invariant violation!
          nonDelegable: true,
        },
      });
      expect(() => registerCapability(cap)).toThrow(InvalidCapabilityError);
    });

    it('accepts L3 and L4 capabilities when requiresHumanApproval is true', () => {
      const capL3 = createValidCapability({
        id: 'test.l3',
        risk: {
          level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
          destructive: false,
          idempotent: false,
          openWorld: true,
          requiresHumanApproval: true,
          nonDelegable: false,
        },
      });
      const capL4 = createValidCapability({
        id: 'test.l4',
        risk: {
          level: 'L4_PRIVILEGED_DESTRUCTIVE',
          destructive: true,
          idempotent: false,
          openWorld: false,
          requiresHumanApproval: true,
          nonDelegable: true,
        },
      });
      expect(() => registerCapability(capL3)).not.toThrow();
      expect(() => registerCapability(capL4)).not.toThrow();
    });
  });

  describe('Duplicate registration', () => {
    it('allows re-registering the exact same object reference (HMR)', () => {
      const cap = createValidCapability();
      registerCapability(cap);
      expect(() => registerCapability(cap)).not.toThrow();
    });

    it('throws DuplicateCapabilityError when registering a different definition under the same id', () => {
      const cap1 = createValidCapability({ id: 'crm.contact.create' });
      const cap2 = createValidCapability({ id: 'crm.contact.create', name: 'Different definition' });
      registerCapability(cap1);
      expect(() => registerCapability(cap2)).toThrow(DuplicateCapabilityError);
    });
  });

  describe('Permission references (D6)', () => {
    it('resolves existing app ids and RBAC coordinates', () => {
      expect(parsePermissionRef('app:system_admin')).toEqual({ kind: 'app', id: 'system_admin' });
      expect(parsePermissionRef('rbac:operations.tasks.create')).toEqual({
        kind: 'rbac',
        section: 'operations',
        feature: 'tasks',
        action: 'create',
      });
    });

    it('rejects anything that does not exist in the app', () => {
      for (const ref of [
        'tasks.create',
        'app:nope',
        'rbac:operations.tasks',
        'rbac:operations.nope.view',
        'rbac:nope.tasks.view',
        'rbac:operations.leadIntelligence.delete',
        'admin.grant_permission',
      ]) {
        expect(parsePermissionRef(ref)).toBeNull();
      }
    });
  });

  describe('Non-delegable permissions & canonical coordinates (Rule 17 / D6)', () => {
    it('every entry in NON_DELEGABLE_ACTIONS exists in the permission vocabulary', () => {
      expect(NON_DELEGABLE_ACTIONS.filter((ref) => !parsePermissionRef(ref))).toEqual([]);
    });

    it('contains canonical coordinates in NON_DELEGABLE_ACTIONS', () => {
      const expectedCoordinates = [
        'app:system_admin',
        'app:system_user_switch',
        'app:contracts_delete',
        'rbac:workforce.roles.edit',
        'rbac:workforce.users.create',
        'rbac:workforce.users.edit',
        'rbac:workforce.users.delete',
        'rbac:management.users.create',
        'rbac:management.users.edit',
        'rbac:management.users.delete',
        'rbac:management.developerApi.edit',
        'rbac:management.webhooks.create',
        'rbac:management.webhooks.edit',
        'rbac:management.systemSettings.edit',
        'rbac:finance.billingSetup.edit',
      ];
      for (const coord of expectedCoordinates) {
        expect(NON_DELEGABLE_ACTIONS).toContain(coord);
        expect(isNonDelegableAction(coord)).toBe(true);
      }
    });

    it('returns false for ordinary delegable actions', () => {
      expect(isNonDelegableAction('crm.contact.create')).toBe(false);
      expect(isNonDelegableAction('app:leads_view')).toBe(false);
      expect(isNonDelegableAction('rbac:operations.tasks.view')).toBe(false);
    });

    it('actually blocks an agent from a non-delegable permission', () => {
      const agent: AgentPrincipal = {
        actorType: 'agent',
        userId: 'u',
        organizationId: 'o',
        workspaceId: 'w',
        agentId: 'a',
        grantedScopes: ['rbac:management.users.edit'],
        effectiveRole: 'agent',
      };
      const capability = createValidCapability({
        id: 'workforce.user.update',
        permissions: ['rbac:management.users.edit'],
      });
      expect(isNonDelegableAction('rbac:management.users.edit')).toBe(true);
      const result = evaluatePrincipalAuthority(agent, capability, { organizationId: 'o', workspaceId: 'w' });
      expect(result.allowed).toBe(false);
      expect(result.violationCodes).toContain('NON_DELEGABLE');
    });
  });

  describe('Capability registry validation comprehensive cases', () => {
    const baseCap = (): AnyCapabilityDefinition => ({
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
        maxDurationMs: 1000,
        supportsDryRun: false,
        supportsCancellation: false,
        supportsCompensation: false,
        maxPayloadSizeBytes: 1024,
      },
      policies: {
        requiresIdempotencyKey: true,
        requiresExpectedVersion: false,
        auditRequired: false,
      },
      handler: async () => ({
        success: true,
        data: {},
        executionId: 'e',
        emittedEvents: [],
        durationMs: 1,
      }),
    });

    it('registers a valid definition', () => {
      registerCapability(baseCap());
      expect(getCapability('crm.task.create')).toBeDefined();
    });

    it('refuses invalid definitions with every problem listed', () => {
      const cases: Array<[Partial<AnyCapabilityDefinition>, RegExp]> = [
        [{ version: '1.0' }, /SemVer/],
        [{ permissions: [] }, /permissions is empty/],
        [{ permissions: ['tasks.create'] }, /not a valid app:\/rbac: reference/],
        [{ risk: { ...baseCap().risk, level: 'L4_PRIVILEGED_DESTRUCTIVE' } }, /requiresHumanApproval/],
        [{ permissions: ['rbac:operations.tasks.create'], public: { reason: 'x' } }, /public capability/],
      ];
      for (const [overrides, message] of cases) {
        expect(() => registerCapability({ ...baseCap(), ...overrides })).toThrow(InvalidCapabilityError);
        expect(validateCapabilityDefinition({ ...baseCap(), ...overrides }).join('; ')).toMatch(message);
      }
      expect(getCapability('crm.task.create')).toBeUndefined();
    });
  });
});
