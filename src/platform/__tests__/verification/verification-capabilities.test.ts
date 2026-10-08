/**
 * @fileOverview Unit & Integration Tests for Canonical Verification Capabilities (Phase 14 Milestone 1)
 *
 * Implements Rules 1, 4, 8, 12, 16, 40, 47, 60, 67, and 69.
 * Verifies:
 * - Registration of verification.assert_postconditions and verification.get_execution_verification
 * - Input & output schema validation
 * - Anti-IDOR enforcement on principal organization boundary
 * - Capability execution returning typed CapabilityExecutionResult<VerificationResult>
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCapabilityRegistry } from '@/platform/capabilities/registry/capability-registry';
import '@/platform/capabilities/verification'; // Registers verification capabilities
import {
  assertPostconditionsCapability,
  getExecutionVerificationCapability,
} from '@/platform/capabilities/verification';
import type { CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';

describe('Phase 14 Milestone 1 - Canonical Verification Capabilities', () => {
  const registry = getCapabilityRegistry();

  const mockPrincipalContext: CapabilityExecutionContext = {
    principal: {
      userId: 'usr_operator_1',
      actorType: 'user',
      effectiveRole: 'admin',
      organizationId: 'org_enterprise',
      workspaceId: 'ws_sales',
      grantedScopes: ['verification:assert', 'verification:read', 'workspace:read'],
    },
    correlationId: 'exec_test_1',
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Capability Registry Verification', () => {
    it('registers verification.assert_postconditions in the global registry', () => {
      const cap = registry.getCapability('verification.assert_postconditions');
      expect(cap).toBeDefined();
      expect(cap?.id).toBe('verification.assert_postconditions');
      expect(cap?.risk.level).toBe('L0_READ');
      expect(cap?.permissions).toContain('verification:assert');
    });

    it('registers verification.get_execution_verification in the global registry', () => {
      const cap = registry.getCapability('verification.get_execution_verification');
      expect(cap).toBeDefined();
      expect(cap?.id).toBe('verification.get_execution_verification');
      expect(cap?.risk.level).toBe('L0_READ');
      expect(cap?.permissions).toContain('verification:read');
    });
  });

  describe('verification.assert_postconditions execution', () => {
    it('successfully evaluates postconditions through capability handler', async () => {
      const input = {
        organizationId: 'org_enterprise',
        workspaceId: 'ws_sales',
        capabilityId: 'crm.deal.advance_stage',
        preStateSnapshot: { id: 'deal_1', stage: 'QUALIFICATION' },
        postStateSnapshot: { id: 'deal_1', stage: 'PROPOSAL_SUBMITTED' },
        mutationPayload: { dealId: 'deal_1', stage: 'PROPOSAL_SUBMITTED' },
      };

      const result = await assertPostconditionsCapability.handler(input, mockPrincipalContext);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.overallStatus).toBe('PASS');
        expect(result.data.assertionsCount).toBeGreaterThanOrEqual(1);
      }
    });

    it('enforces Anti-IDOR and rejects cross-tenant caller context', async () => {
      const maliciousContext: CapabilityExecutionContext = {
        ...mockPrincipalContext,
        principal: {
          ...mockPrincipalContext.principal,
          organizationId: 'org_attacker',
        },
      };

      const input = {
        organizationId: 'org_enterprise',
        workspaceId: 'ws_sales',
        capabilityId: 'crm.deal.advance_stage',
        preStateSnapshot: {},
        postStateSnapshot: {},
        mutationPayload: {},
      };

      await expect(
        assertPostconditionsCapability.handler(input, maliciousContext)
      ).rejects.toThrowError(/Anti-IDOR Violation/);
    });
  });

  describe('verification.get_execution_verification execution', () => {
    it('retrieves an existing verification result by execution ID', async () => {
      const input = {
        organizationId: 'org_enterprise',
        workspaceId: 'ws_sales',
        capabilityId: 'crm.deal.advance_stage',
        preStateSnapshot: { id: 'deal_1', stage: 'QUALIFICATION' },
        postStateSnapshot: { id: 'deal_1', stage: 'PROPOSAL_SUBMITTED' },
        mutationPayload: { dealId: 'deal_1', stage: 'PROPOSAL_SUBMITTED' },
      };

      const evalResult = await assertPostconditionsCapability.handler(input, mockPrincipalContext);
      expect(evalResult.success).toBe(true);
      if (!evalResult.success) return;
      const executionId = evalResult.data.executionId;

      const fetchResult = await getExecutionVerificationCapability.handler(
        {
          organizationId: 'org_enterprise',
          workspaceId: 'ws_sales',
          executionId,
        },
        mockPrincipalContext
      );

      expect(fetchResult.success).toBe(true);
      if (fetchResult.success) {
        expect(fetchResult.data?.executionId).toBe(executionId);
        expect(fetchResult.data?.overallStatus).toBe('PASS');
      }
    });

    it('returns null data when execution ID is not found', async () => {
      const fetchResult = await getExecutionVerificationCapability.handler(
        {
          organizationId: 'org_enterprise',
          workspaceId: 'ws_sales',
          executionId: 'exec_non_existent',
        },
        mockPrincipalContext
      );

      expect(fetchResult.success).toBe(true);
      if (fetchResult.success) {
        expect(fetchResult.data).toBeNull();
      }
    });
  });
});
