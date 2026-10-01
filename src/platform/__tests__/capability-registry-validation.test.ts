// @vitest-environment node
/**
 * @fileOverview Unit tests for Capability Registry & Risk Invariants (PR-2)
 *
 * Validates SemVer conformance, non-empty permission requirements, high-risk
 * human approval invariants, and canonical non-delegable coordinate checks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import type { CapabilityDefinition } from '../capabilities/contracts/capability-definition';
import {
  registerCapability,
  getCapability,
  resetCapabilityRegistryForTests,
  DuplicateCapabilityError,
  InvalidCapabilityError,
} from '../capabilities/registry/capability-registry';
import {
  NON_DELEGABLE_ACTIONS,
  isNonDelegableAction,
} from '../capabilities/contracts/risk-levels';

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
    permissions: ['app:test_permission'],
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
      auditRequired: true,
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
    it('rejects capabilities with empty permissions array', () => {
      const cap = createValidCapability({ permissions: [] });
      expect(() => registerCapability(cap)).toThrow(InvalidCapabilityError);
    });

    it('rejects capabilities with blank or whitespace-only permission strings', () => {
      const cap = createValidCapability({ permissions: ['   '] });
      expect(() => registerCapability(cap)).toThrow(InvalidCapabilityError);
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
      expect(() => registerCapability(cap)).toThrow(/requiresHumanApproval/);
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

  describe('Non-delegable actions & canonical coordinates (Rule 17 / D6)', () => {
    it('contains canonical coordinates in NON_DELEGABLE_ACTIONS', () => {
      const expectedCoordinates = [
        'app:system_admin',
        'app:contracts_delete',
        'rbac:management.users.edit',
        'rbac:management.users.delete',
        'rbac:finance.agreements.delete',
        'admin.grant_permission',
        'organization.delete',
        'workspace.delete',
      ];
      for (const coord of expectedCoordinates) {
        expect(NON_DELEGABLE_ACTIONS).toContain(coord);
        expect(isNonDelegableAction(coord)).toBe(true);
      }
    });

    it('identifies non-delegable actions with trailing qualifiers or exact match', () => {
      expect(isNonDelegableAction('app:system_admin')).toBe(true);
      expect(isNonDelegableAction('rbac:management.users.delete')).toBe(true);
      expect(isNonDelegableAction('organization.delete')).toBe(true);
      expect(isNonDelegableAction('admin.grant_permission:subscope')).toBe(true);
    });

    it('returns false for ordinary delegable actions', () => {
      expect(isNonDelegableAction('crm.contact.create')).toBe(false);
      expect(isNonDelegableAction('app:leads_view')).toBe(false);
      expect(isNonDelegableAction('rbac:crm.contacts.read')).toBe(false);
    });
  });
});
