/**
 * @fileOverview Unit & Security Tests for Saga Server Actions (Phase 14 Milestone 3)
 *
 * Implements Rules 4, 8, 10, 12, 17, 19, 25, 27, 47, 48, 51, 60, and 69.
 * Verifies:
 * - Session authentication guarding (requireAuth)
 * - Anti-IDOR multi-tenant boundary checks (assertTenantAccess)
 * - Emergency dead-man switch fail-closed semantics (SAGA_DEAD_MAN_PAUSED)
 * - Reverse-LIFO Saga compensation execution
 * - Ledger retrieval and step recording
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeSagaCompensationAction,
  getSagaExecutionLedgerAction,
  recordSagaStepAction,
} from '@/app/actions/saga-compensation-actions';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { getSagaCompensationService } from '@/platform/verification/saga';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(),
}));

describe('Phase 14 Milestone 3 - Saga Compensation Server Actions', () => {
  const validOrgId = 'org_enterprise';
  const validWsId = 'ws_sales';
  const callerUid = 'usr_operator_1';

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.mocked(requireAuth).mockResolvedValue({
      uid: callerUid,
      claims: { sub: callerUid },
      profile: {
        id: callerUid,
        email: 'operator@enterprise.com',
        role: 'admin',
        organizationId: validOrgId,
        lastActiveWorkspaceId: validWsId,
      },
      isSystemAdmin: false,
    } as unknown as Awaited<ReturnType<typeof requireAuth>>);

    vi.mocked(checkGovernanceDeadManSwitch).mockResolvedValue(undefined);
  });

  describe('executeSagaCompensationAction', () => {
    it('executes saga compensation and returns structured SagaActionResult', async () => {
      const service = getSagaCompensationService();
      const runId = 'run_action_test_1';

      await service.recordStep({
        runId,
        stepId: 'step_1',
        stepIndex: 0,
        capabilityId: 'crm.contact.create',
        domain: 'crm',
        actionType: 'create',
        organizationId: validOrgId,
        workspaceId: validWsId,
        actorId: callerUid,
        actorType: 'user',
        inputPayload: { contactId: 'cnt_action_1' },
      });

      const result = await executeSagaCompensationAction({
        runId,
        organizationId: validOrgId,
        workspaceId: validWsId,
        reason: 'Integration test compensation trigger',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.runId).toBe(runId);
      expect(result.data?.status).toBe('SUCCESS');
      expect(result.data?.compensatedStepsCount).toBe(1);
    });

    it('rejects unauthenticated caller with UNAUTHENTICATED', async () => {
      vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Auth failed'));

      const result = await executeSagaCompensationAction({
        runId: 'run_action_test_2',
        organizationId: validOrgId,
        workspaceId: validWsId,
        reason: 'Unauthenticated test',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHENTICATED');
    });

    it('enforces Anti-IDOR: rejects cross-tenant caller with IDOR_VIOLATION (Rules 8 & 47)', async () => {
      const result = await executeSagaCompensationAction({
        runId: 'run_action_test_3',
        organizationId: 'org_attacker_target',
        workspaceId: validWsId,
        reason: 'Cross tenant attack attempt',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDOR_VIOLATION');
    });

    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      vi.mocked(checkGovernanceDeadManSwitch).mockRejectedValueOnce(
        new Error('Platform dead-man pause active')
      );

      const result = await executeSagaCompensationAction({
        runId: 'run_action_test_4',
        organizationId: validOrgId,
        workspaceId: validWsId,
        reason: 'Dead-man active test',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SAGA_DEAD_MAN_PAUSED');
    });
  });

  describe('getSagaExecutionLedgerAction', () => {
    it('retrieves ledger for authenticated tenant', async () => {
      const service = getSagaCompensationService();
      const runId = 'run_action_ledger_1';

      await service.recordStep({
        runId,
        stepId: 'step_ledger_1',
        stepIndex: 0,
        capabilityId: 'crm.contact.create',
        domain: 'crm',
        actionType: 'create',
        organizationId: validOrgId,
        workspaceId: validWsId,
        actorId: callerUid,
        actorType: 'user',
        inputPayload: { contactId: 'cnt_action_2' },
      });

      const result = await getSagaExecutionLedgerAction({
        runId,
        organizationId: validOrgId,
        workspaceId: validWsId,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.runId).toBe(runId);
      expect(result.data?.steps).toHaveLength(1);
    });

    it('enforces Anti-IDOR on ledger access', async () => {
      const result = await getSagaExecutionLedgerAction({
        runId: 'run_action_ledger_2',
        organizationId: 'org_mismatched',
        workspaceId: validWsId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDOR_VIOLATION');
    });
  });

  describe('recordSagaStepAction', () => {
    it('records a step in the ledger', async () => {
      const runId = 'run_action_record_1';

      const result = await recordSagaStepAction({
        runId,
        stepIndex: 0,
        capabilityId: 'crm.contact.create',
        domain: 'crm',
        actionType: 'create',
        organizationId: validOrgId,
        workspaceId: validWsId,
        inputPayload: { contactId: 'cnt_action_3' },
      });

      expect(result.success).toBe(true);
      expect(result.data?.recorded).toBe(true);
      expect(result.data?.stepId).toBeDefined();

      const ledgerResult = await getSagaExecutionLedgerAction({
        runId,
        organizationId: validOrgId,
        workspaceId: validWsId,
      });
      expect(ledgerResult.data?.steps).toHaveLength(1);
    });
  });
});
