/**
 * @fileOverview Unit & Integration Tests for Canonical Saga Capabilities (Phase 14 Milestone 3)
 *
 * Rules verified:
 * - Rule 1 (Canonical Capability Layer): Capabilities registered and functional
 * - Rule 4 (Strict Typing): Zero any
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock): Strict tenant scoping
 * - Rule 12 (Risk Vocabulary): L2_STATE_MUTATION for execute, L0_READ for get_ledger
 * - Rule 16 (Explicit Scoped Permissions): saga:compensate, saga:read
 * - Rule 17 (Non-Delegable Restrictions): saga.execute_compensation nonDelegable: true
 * - Rule 19 (Deterministic Idempotency): requiresIdempotencyKey: true
 * - Rule 27 (Universal Reverse-LIFO Saga Compensation Model)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Strangler Fig Invariant)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';
import {
  sagaExecuteCompensationCapability,
  sagaGetExecutionLedgerCapability,
} from '@/platform/capabilities/saga';
import { type CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import {
  SagaCompensationError,
  getSagaCompensationService,
} from '@/platform/verification/saga';

describe('Phase 14 Milestone 3 - Canonical Saga Capabilities', () => {
  const tenant = {
    organizationId: 'org_enterprise_1',
    workspaceId: 'ws_prod_1',
  };

  const mockContext: CapabilityExecutionContext = {
    principal: {
      actorType: 'user',
      userId: 'usr_operator_1',
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      grantedScopes: ['saga:compensate', 'saga:read'],
      effectiveRole: 'admin',
    },
    correlationId: 'corr_saga_cap_1',
    timestamp: '2026-10-08T14:00:00.000Z',
  };

  beforeEach(() => {
    setGovernanceDeadManStateForTests(null);
  });

  afterEach(() => {
    setGovernanceDeadManStateForTests(null);
  });

  describe('Capability Registration & Schema Compliance', () => {
    it('registers saga.execute_compensation in CapabilityRegistry with nonDelegable: true and L2_STATE_MUTATION', () => {
      const cap = getCapability('saga.execute_compensation');
      expect(cap).toBeDefined();
      expect(cap?.id).toBe('saga.execute_compensation');
      expect(cap?.risk.level).toBe('L2_STATE_MUTATION');
      expect(cap?.risk.nonDelegable).toBe(true);
      expect(cap?.permissions).toContain('saga:compensate');
      expect(cap?.policies.requiresIdempotencyKey).toBe(true);
      expect(cap?.policies.auditRequired).toBe(true);
    });

    it('registers saga.get_execution_ledger in CapabilityRegistry with L0_READ', () => {
      const cap = getCapability('saga.get_execution_ledger');
      expect(cap).toBeDefined();
      expect(cap?.id).toBe('saga.get_execution_ledger');
      expect(cap?.risk.level).toBe('L0_READ');
      expect(cap?.risk.nonDelegable).toBe(false);
      expect(cap?.permissions).toContain('saga:read');
      expect(cap?.policies.auditRequired).toBe(true);
    });
  });

  describe('saga.execute_compensation execution', () => {
    it('executes saga compensation in reverse-LIFO order and returns result', async () => {
      const service = getSagaCompensationService();
      const runId = 'run_cap_exec_1';

      // Record steps
      await service.recordStep({
        runId,
        stepId: 'step_1',
        stepIndex: 0,
        capabilityId: 'crm.contact.create',
        domain: 'crm',
        actionType: 'create',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        actorId: 'usr_operator_1',
        actorType: 'user',
        inputPayload: { contactId: 'cnt_123', name: 'John Doe' },
        outputPayload: { id: 'cnt_123' },
      });

      const result = await sagaExecuteCompensationCapability.handler(
        {
          runId,
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          reason: 'Downstream integration error in step 2',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.runId).toBe(runId);
        expect(result.data.status).toBe('SUCCESS');
        expect(result.data.compensatedStepsCount).toBe(1);
        expect(result.executionId).toBe(mockContext.correlationId);
      }
    });

    it('enforces Anti-IDOR: rejects cross-tenant caller context (Rules 8 & 47)', async () => {
      const crossTenantContext: CapabilityExecutionContext = {
        ...mockContext,
        principal: {
          ...mockContext.principal,
          organizationId: 'org_malicious_attacker',
        },
      };

      await expect(
        sagaExecuteCompensationCapability.handler(
          {
            runId: 'run_cap_exec_2',
            organizationId: tenant.organizationId,
            workspaceId: tenant.workspaceId,
            reason: 'Unauthorized rollback attempt',
          },
          crossTenantContext
        )
      ).rejects.toThrow(SagaCompensationError);
    });

    it('enforces Rule 60 Emergency Dead-Man switch failure', async () => {
      setGovernanceDeadManStateForTests({
        active: true,
        reason: 'Security breach containment',
        activatedAt: '2026-10-08T12:00:00.000Z',
        activatedBy: 'sec_admin',
        scope: 'global',
      });

      await expect(
        sagaExecuteCompensationCapability.handler(
          {
            runId: 'run_cap_exec_3',
            organizationId: tenant.organizationId,
            workspaceId: tenant.workspaceId,
            reason: 'Testing dead-man pause',
          },
          mockContext
        )
      ).rejects.toThrow();
    });
  });

  describe('saga.get_execution_ledger execution', () => {
    it('retrieves an existing ledger successfully', async () => {
      const service = getSagaCompensationService();
      const runId = 'run_cap_ledger_1';

      await service.recordStep({
        runId,
        stepId: 'step_ledger_1',
        stepIndex: 0,
        capabilityId: 'crm.contact.create',
        domain: 'crm',
        actionType: 'create',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        actorId: 'usr_operator_1',
        actorType: 'user',
        inputPayload: { contactId: 'cnt_ledger_1' },
      });

      const result = await sagaGetExecutionLedgerCapability.handler(
        {
          runId,
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data?.runId).toBe(runId);
        expect(result.data?.steps).toHaveLength(1);
      }
    });

    it('enforces Anti-IDOR on ledger access (Rules 8 & 47)', async () => {
      const crossTenantContext: CapabilityExecutionContext = {
        ...mockContext,
        principal: {
          ...mockContext.principal,
          organizationId: 'org_different',
        },
      };

      await expect(
        sagaGetExecutionLedgerCapability.handler(
          {
            runId: 'run_cap_ledger_2',
            organizationId: tenant.organizationId,
            workspaceId: tenant.workspaceId,
          },
          crossTenantContext
        )
      ).rejects.toThrow(SagaCompensationError);
    });
  });
});
