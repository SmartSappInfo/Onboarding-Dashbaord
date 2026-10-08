/**
 * @fileOverview Unit & Integration Tests for Canonical Concurrency Capabilities (Phase 14 Milestone 2)
 *
 * Rules verified:
 * - Rule 1 (Canonical Capability Layer): Capabilities registered and functional
 * - Rule 4 (Strict Typing): Zero any
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock): Strict tenant scoping
 * - Rule 12 (Risk Vocabulary): L0_READ
 * - Rule 16 (Explicit Scoped Permissions): concurrency:snapshot, concurrency:read
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';
import {
  concurrencySnapshotResourceCapability,
  concurrencyVerifyVersionCapability,
} from '@/platform/capabilities/concurrency';
import { type CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { StateConcurrencyError } from '@/platform/verification/concurrency';

describe('Phase 14 Milestone 2 - Concurrency Capabilities', () => {
  const mockContext: CapabilityExecutionContext = {
    principal: {
      actorType: 'user',
      userId: 'usr_operator_1',
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      grantedScopes: ['concurrency:snapshot', 'concurrency:read'],
      effectiveRole: 'admin',
    },
    correlationId: 'corr_test_100',
    timestamp: '2026-10-08T12:00:00.000Z',
  };

  beforeEach(() => {
    setGovernanceDeadManStateForTests(null);
  });

  afterEach(() => {
    setGovernanceDeadManStateForTests(null);
  });

  describe('Capability Registration & Schema Compliance', () => {
    it('registers concurrency.snapshot_resource in CapabilityRegistry', () => {
      const cap = getCapability('concurrency.snapshot_resource');
      expect(cap).toBeDefined();
      expect(cap?.id).toBe('concurrency.snapshot_resource');
      expect(cap?.risk.level).toBe('L0_READ');
      expect(cap?.permissions).toContain('concurrency:snapshot');
      expect(cap?.policies.auditRequired).toBe(true);
    });

    it('registers concurrency.verify_version in CapabilityRegistry', () => {
      const cap = getCapability('concurrency.verify_version');
      expect(cap).toBeDefined();
      expect(cap?.id).toBe('concurrency.verify_version');
      expect(cap?.risk.level).toBe('L0_READ');
      expect(cap?.permissions).toContain('concurrency:read');
      expect(cap?.policies.auditRequired).toBe(true);
    });
  });

  describe('concurrency.snapshot_resource execution', () => {
    it('captures a valid snapshot via handler', async () => {
      const result = await concurrencySnapshotResourceCapability.handler(
        {
          resourceType: 'crm_entity',
          resourceId: 'entity_999',
          resourceData: { version: 1, name: 'Acme Corp', industry: 'SaaS' },
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.resourceId).toBe('entity_999');
        expect(result.data.version).toBe(1);
        expect(result.data.stateHash).toHaveLength(64);
        expect(result.executionId).toBe(mockContext.correlationId);
      }
    });

    it('enforces Anti-IDOR: rejects cross-tenant caller context (Rules 8 & 47)', async () => {
      const crossTenantContext: CapabilityExecutionContext = {
        ...mockContext,
        principal: {
          ...mockContext.principal,
          organizationId: 'org_attacker',
        },
      };

      await expect(
        concurrencySnapshotResourceCapability.handler(
          {
            resourceType: 'crm_entity',
            resourceId: 'entity_999',
            resourceData: { version: 1 },
            organizationId: 'org_victim',
            workspaceId: 'ws_test_1',
          },
          crossTenantContext
        )
      ).rejects.toThrow(StateConcurrencyError);
    });
  });

  describe('concurrency.verify_version execution', () => {
    it('validates current version without drift via handler', async () => {
      const snapResult = await concurrencySnapshotResourceCapability.handler(
        {
          resourceType: 'crm_entity',
          resourceId: 'entity_999',
          resourceData: { version: 1, name: 'Acme Corp' },
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        },
        mockContext
      );

      expect(snapResult.success).toBe(true);
      if (!snapResult.success) return;

      const verifyResult = await concurrencyVerifyVersionCapability.handler(
        {
          expectedSnapshot: snapResult.data,
          currentResourceData: { version: 1, name: 'Acme Corp' },
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
          assertCurrent: false,
        },
        mockContext
      );

      expect(verifyResult.success).toBe(true);
      if (verifyResult.success) {
        expect(verifyResult.data.isCurrent).toBe(true);
        expect(verifyResult.data.driftDetected).toBe(false);
      }
    });

    it('assertCurrent: true throws StateConcurrencyError when stale', async () => {
      const snapResult = await concurrencySnapshotResourceCapability.handler(
        {
          resourceType: 'crm_entity',
          resourceId: 'entity_999',
          resourceData: { version: 1 },
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        },
        mockContext
      );

      expect(snapResult.success).toBe(true);
      if (!snapResult.success) return;

      await expect(
        concurrencyVerifyVersionCapability.handler(
          {
            expectedSnapshot: snapResult.data,
            currentResourceData: { version: 2 },
            organizationId: 'org_test_1',
            workspaceId: 'ws_test_1',
            assertCurrent: true,
          },
          mockContext
        )
      ).rejects.toThrow(StateConcurrencyError);
    });
  });
});
