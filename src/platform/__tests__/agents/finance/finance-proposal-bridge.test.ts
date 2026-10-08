/**
 * @fileOverview Unit tests for Two-Phase Financial Proposal Bridge (Phase 12 Milestone 4)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FinanceProposalBridge,
  getFinanceProposalBridge,
} from '@/platform/agents/finance/collections/finance-proposal-bridge';
import { computePayloadHashAsync } from '@/platform/agents/finance/reconciliation/reconciliation-hash';
import * as deadManModule from '@/platform/policy/governance-dead-man';

describe('FinanceProposalBridge', () => {
  let bridge: FinanceProposalBridge;

  beforeEach(() => {
    vi.restoreAllMocks();
    deadManModule.setGovernanceDeadManStateForTests(false);
    bridge = new FinanceProposalBridge();
    bridge.resetInMemoryStore();
  });

  describe('Propose Phase (Rule 21 & 22)', () => {
    it('creates proposal with canonical SHA-256 payloadHash', async () => {
      const payload = {
        totalAmount: 4500.0,
        currency: 'GHS',
        frequency: 'monthly',
        milestoneCount: 3,
      };

      const expectedHash = await computePayloadHashAsync(payload);

      const proposal = await bridge.proposeCollectionsAction({
        entityId: 'debtor-prop-1',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        targetCapability: 'finance.collection.propose_plan',
        riskLevel: 'L2_STATE_MUTATION',
        payload,
        proposerUserId: 'user-agent-1',
        what: 'Propose 3-part installment recovery agreement.',
        why: 'Account is 45 days overdue.',
      });

      expect(proposal.proposalId).toBeDefined();
      expect(proposal.status).toBe('pending');
      expect(proposal.payloadHash).toBe(expectedHash);
      expect(proposal.compensatingCapability).toBe('finance.collection.cancel_plan');
    });
  });

  describe('Execute Phase & Security Gates (Rules 13, 18, 22, 47)', () => {
    it('rejects self-approval when proposer === operator (Rule 13)', async () => {
      const payload = { totalAmount: 3000.0, currency: 'GHS' };
      const proposal = await bridge.proposeCollectionsAction({
        entityId: 'debtor-self-appr',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        targetCapability: 'finance.collection.propose_plan',
        riskLevel: 'L2_STATE_MUTATION',
        payload,
        proposerUserId: 'operator-alice',
        what: 'Installment proposal.',
        why: 'Overdue.',
      });

      await expect(
        bridge.executeApprovedProposal({
          proposalId: proposal.proposalId,
          operatorUserId: 'operator-alice', // Same user!
          workspaceId: 'ws-1',
          organizationId: 'org-1',
          livePayload: payload,
        })
      ).rejects.toThrow('cannot self-approve');
    });

    it('rejects tampered live payload with PAYLOAD_TAMPERED (Rule 22)', async () => {
      const initialPayload = { totalAmount: 2000.0, currency: 'GHS' };
      const proposal = await bridge.proposeCollectionsAction({
        entityId: 'debtor-tamper',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        targetCapability: 'finance.collection.propose_plan',
        riskLevel: 'L2_STATE_MUTATION',
        payload: initialPayload,
        proposerUserId: 'agent-1',
        what: 'Installment proposal.',
        why: 'Overdue.',
      });

      // Tampered payload with altered amount
      const tamperedPayload = { totalAmount: 500.0, currency: 'GHS' };

      await expect(
        bridge.executeApprovedProposal({
          proposalId: proposal.proposalId,
          operatorUserId: 'operator-bob',
          workspaceId: 'ws-1',
          organizationId: 'org-1',
          livePayload: tamperedPayload,
        })
      ).rejects.toThrow('Cryptographic payload tampering detected');
    });

    it('rejects execution when live balance is cleared (Rule 18 TOCTOU)', async () => {
      const payload = { totalAmount: 0.0, currency: 'GHS' };
      const proposal = await bridge.proposeCollectionsAction({
        entityId: 'debtor-stale',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        targetCapability: 'finance.collection.propose_plan',
        riskLevel: 'L2_STATE_MUTATION',
        payload,
        proposerUserId: 'agent-1',
        what: 'Installment proposal.',
        why: 'Overdue.',
      });

      await expect(
        bridge.executeApprovedProposal({
          proposalId: proposal.proposalId,
          operatorUserId: 'operator-bob',
          workspaceId: 'ws-1',
          organizationId: 'org-1',
          livePayload: payload,
        })
      ).rejects.toThrow('Invoice balance has been cleared or altered');
    });

    it('rejects cross-tenant execution with IDOR_VIOLATION (Rule 8 & 47)', async () => {
      const payload = { totalAmount: 2500.0, currency: 'GHS' };
      const proposal = await bridge.proposeCollectionsAction({
        entityId: 'debtor-idor',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        targetCapability: 'finance.collection.propose_plan',
        riskLevel: 'L2_STATE_MUTATION',
        payload,
        proposerUserId: 'agent-1',
        what: 'Installment proposal.',
        why: 'Overdue.',
      });

      await expect(
        bridge.executeApprovedProposal({
          proposalId: proposal.proposalId,
          operatorUserId: 'operator-bob',
          workspaceId: 'ws-wrong',
          organizationId: 'org-wrong',
          livePayload: payload,
        })
      ).rejects.toThrow('Cross-tenant execution forbidden');
    });

    it('successfully executes approved proposal with dual-custody approval', async () => {
      const payload = { totalAmount: 3500.0, currency: 'GHS', frequency: 'monthly' };
      const proposal = await bridge.proposeCollectionsAction({
        entityId: 'debtor-success',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        targetCapability: 'finance.collection.propose_plan',
        riskLevel: 'L2_STATE_MUTATION',
        payload,
        proposerUserId: 'agent-alice',
        what: 'Installment proposal.',
        why: 'Overdue.',
      });

      const result = await bridge.executeApprovedProposal({
        proposalId: proposal.proposalId,
        operatorUserId: 'operator-bursar-bob',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        livePayload: payload,
      });

      expect(result.status).toBe('executed');
      expect(result.proposalId).toBe(proposal.proposalId);

      const updated = await bridge.getProposalById(proposal.proposalId);
      expect(updated?.status).toBe('executed');
      expect(updated?.approvedBy).toBe('operator-bursar-bob');
    });
  });

  describe('Rollback Phase (Rule 27 Reverse-LIFO Saga Compensation)', () => {
    it('rolls back proposal and records compensating capability', async () => {
      const payload = { totalAmount: 3500.0, currency: 'GHS' };
      const proposal = await bridge.proposeCollectionsAction({
        entityId: 'debtor-rollback',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        actionType: 'PROPOSE_INSTALLMENT_PLAN',
        targetCapability: 'finance.collection.propose_plan',
        riskLevel: 'L2_STATE_MUTATION',
        payload,
        proposerUserId: 'agent-1',
        what: 'Installment proposal.',
        why: 'Overdue.',
      });

      const rollbackResult = await bridge.rollbackProposal({
        proposalId: proposal.proposalId,
        operatorUserId: 'supervisor-eve',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
      });

      expect(rollbackResult.status).toBe('reverted');
      expect(rollbackResult.compensatingCapability).toBe('finance.collection.cancel_plan');

      const updated = await bridge.getProposalById(proposal.proposalId);
      expect(updated?.status).toBe('reverted');
      expect(updated?.revertedBy).toBe('supervisor-eve');
    });
  });

  describe('Governance Dead-Man Switch (Rule 60)', () => {
    it('fails closed when emergency dead-man switch is active', async () => {
      deadManModule.setGovernanceDeadManStateForTests(true);

      await expect(
        bridge.proposeCollectionsAction({
          entityId: 'debtor-locked',
          workspaceId: 'ws-1',
          organizationId: 'org-locked',
          actionType: 'PROPOSE_INSTALLMENT_PLAN',
          targetCapability: 'finance.collection.propose_plan',
          riskLevel: 'L2_STATE_MUTATION',
          payload: { totalAmount: 1000 },
          proposerUserId: 'agent-1',
          what: 'Proposal',
          why: 'Overdue',
        })
      ).rejects.toThrow('emergency governance dead-man switch');
    });
  });

  describe('Singleton Pattern', () => {
    it('preserves singleton instance across calls', () => {
      const inst1 = getFinanceProposalBridge();
      const inst2 = getFinanceProposalBridge();
      expect(inst1).toBe(inst2);
    });
  });
});
