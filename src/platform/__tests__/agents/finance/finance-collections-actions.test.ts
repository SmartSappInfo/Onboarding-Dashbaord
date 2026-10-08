/**
 * @fileOverview Unit tests for Collections Server Actions (Phase 12 Milestone 4)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDebtorAccountsAction,
  evaluateDebtorNextActionAction,
  createInstallmentPlanAction,
  proposeCollectionsActionAction,
  executeApprovedCollectionsProposalAction,
  rollbackCollectionsProposalAction,
  recordPromiseToPayAction,
  getCollectionsMetricsAction,
} from '@/app/actions/finance-collections-actions';
import * as authModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import { getCollectionsEngine } from '@/platform/agents/finance/collections/collections-engine';
import { getFinanceProposalBridge } from '@/platform/agents/finance/collections/finance-proposal-bridge';

describe('Finance Collections Server Actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    deadManModule.setGovernanceDeadManStateForTests(false);
    getCollectionsEngine().resetInMemoryStore();
    getFinanceProposalBridge().resetInMemoryStore();

    // Default authenticated session
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({
      uid: 'user-bursar-1',
      orgId: 'org-demo-1',
      isSystemAdmin: false,
      profile: {
        id: 'user-bursar-1',
        organizationId: 'org-demo-1',
        lastActiveWorkspaceId: 'ws-demo-1',
      } as unknown as authModule.AuthContext['profile'],
    } as authModule.AuthContext);
  });

  describe('Authentication & Anti-IDOR (Rules 8, 47, 51)', () => {
    it('returns error when requireAuth throws', async () => {
      vi.spyOn(authModule, 'requireAuth').mockRejectedValue(
        new Error('Unauthorized request.')
      );

      const result = await getDebtorAccountsAction({
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unauthorized request.');
    });

    it('rejects cross-tenant query with IDOR_VIOLATION', async () => {
      const result = await getDebtorAccountsAction({
        workspaceId: 'ws-demo-1',
        organizationId: 'org-attacker-999', // Mismatched org!
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDOR_VIOLATION');
    });
  });

  describe('Debtor Evaluation & Installment Actions', () => {
    it('retrieves debtor accounts successfully', async () => {
      const result = await getDebtorAccountsAction({
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
    });

    it('returns DEBTOR_NOT_FOUND when evaluating non-existent entity', async () => {
      const result = await evaluateDebtorNextActionAction(
        'non-existent-entity',
        'ws-demo-1',
        'org-demo-1'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DEBTOR_NOT_FOUND');
    });

    it('evaluates existing debtor and returns next best action', async () => {
      const result = await evaluateDebtorNextActionAction(
        'debtor-gis-001',
        'ws-demo-1',
        'org-demo-1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.actionType).toBe('PROPOSE_INSTALLMENT_PLAN');
      expect(result.data?.priority).toBe('HIGH');
    });

    it('creates dynamic installment payment plan', async () => {
      const result = await createInstallmentPlanAction({
        entityId: 'debtor-gis-001',
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
        totalAmount: 12000.0,
        currency: 'GHS',
        frequency: 'monthly',
        milestoneCount: 4,
        startDate: '2026-11-01',
      });

      expect(result.success).toBe(true);
      expect(result.data?.milestones.length).toBe(4);
      expect(result.data?.totalAmount).toBe(12000.0);
    });
  });

  describe('Two-Phase Proposal Flow (Rules 13, 21, 22, 27)', () => {
    it('stages a collections proposal in approval store', async () => {
      const result = await proposeCollectionsActionAction({
        entityId: 'debtor-gis-001',
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        riskLevel: 'L2_STATE_MUTATION',
        payload: { totalAmount: 5000.0, frequency: 'monthly' },
        rationale: 'Overdue recovery plan',
        idempotencyKey: 'col_prop_test_1',
      });

      expect(result.success).toBe(true);
      expect(result.data?.proposalId).toBeDefined();
      expect(result.data?.payloadHash).toBeDefined();
    });

    it('rejects self-approval when proposer executes action', async () => {
      const stageRes = await proposeCollectionsActionAction({
        entityId: 'debtor-gis-001',
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        riskLevel: 'L2_STATE_MUTATION',
        payload: { totalAmount: 5000.0, frequency: 'monthly' },
        rationale: 'Overdue recovery plan',
        idempotencyKey: 'col_prop_test_2',
      });

      const proposalId = stageRes.data!.proposalId;

      // Executing as user-bursar-1 (who proposed it)
      const execRes = await executeApprovedCollectionsProposalAction({
        proposalId,
        livePayload: { totalAmount: 5000.0, frequency: 'monthly' },
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
      });

      expect(execRes.success).toBe(false);
      expect(execRes.error?.code).toBe('SELF_APPROVAL_FORBIDDEN');
    });

    it('rejects tampered payload on execution (Rule 22)', async () => {
      const stageRes = await proposeCollectionsActionAction({
        entityId: 'debtor-gis-001',
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        riskLevel: 'L2_STATE_MUTATION',
        payload: { totalAmount: 5000.0, frequency: 'monthly' },
        rationale: 'Overdue recovery plan',
        idempotencyKey: 'col_prop_test_3',
      });

      const proposalId = stageRes.data!.proposalId;

      // Switch auth to independent operator
      vi.spyOn(authModule, 'requireAuth').mockResolvedValue({
        uid: 'user-supervisor-2',
        orgId: 'org-demo-1',
        isSystemAdmin: false,
        profile: {
          id: 'user-supervisor-2',
          organizationId: 'org-demo-1',
          lastActiveWorkspaceId: 'ws-demo-1',
        } as unknown as authModule.AuthContext['profile'],
      } as authModule.AuthContext);

      // Execute with modified payload
      const execRes = await executeApprovedCollectionsProposalAction({
        proposalId,
        livePayload: { totalAmount: 100.0, frequency: 'monthly' }, // Tampered amount!
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
      });

      expect(execRes.success).toBe(false);
      expect(execRes.error?.code).toBe('PAYLOAD_TAMPERED');
    });

    it('rolls back proposal via Saga compensation (Rule 27)', async () => {
      const stageRes = await proposeCollectionsActionAction({
        entityId: 'debtor-gis-001',
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        riskLevel: 'L2_STATE_MUTATION',
        payload: { totalAmount: 5000.0, frequency: 'monthly' },
        rationale: 'Overdue recovery plan',
        idempotencyKey: 'col_prop_test_4',
      });

      const proposalId = stageRes.data!.proposalId;

      const rollbackRes = await rollbackCollectionsProposalAction({
        proposalId,
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
      });

      expect(rollbackRes.success).toBe(true);
      expect(rollbackRes.data?.status).toBe('reverted');
    });
  });

  describe('Promise to Pay & Metrics', () => {
    it('records promise to pay successfully', async () => {
      const result = await recordPromiseToPayAction({
        entityId: 'debtor-gis-001',
        workspaceId: 'ws-demo-1',
        organizationId: 'org-demo-1',
        promiseDate: '2026-10-30',
        amount: 6000.0,
        notes: 'Promised by Dr. Mensah after PTA meeting.',
      });

      expect(result.success).toBe(true);
      expect(result.data?.promiseToPayAmount).toBe(6000.0);
    });

    it('aggregates collections metrics for Zone 1 cards', async () => {
      const result = await getCollectionsMetricsAction(
        'ws-demo-1',
        'org-demo-1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.totalReceivablesOverdue).toBeGreaterThan(0);
      expect(result.data?.debtorAccountsCount).toBeGreaterThan(0);
    });
  });
});
