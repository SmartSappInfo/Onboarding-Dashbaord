/**
 * @fileOverview Unit Tests: Two-Phase CRM Proposal Bridge (Phase 9 Milestone 4)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 13 (Anti-Self-Approval: SELF_APPROVAL_FORBIDDEN), Rule 18 (Live TOCTOU Version Verification),
 * Rule 21/22 (Two-Phase Action Model & SHA-256 Cryptographic Tamper Detection),
 * Rule 27 (Reverse-LIFO Saga Rollback), Rule 40 (Domain Event Publication),
 * Rule 60 (Emergency Dead-Man Switch Evaluation), and Rule 69 (Dual-Tier CRM Data Model Preservation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CrmProposalBridge,
  getCrmProposalBridge,
} from '@/platform/agents/crm/actions/crm-proposal-bridge';
import {
  CrmProposedActionSchema,
  computeCrmActionIdempotencyKey,
  type CrmProposedAction,
} from '@/platform/agents/crm/actions/crm-action-types';
import { createMemoryApprovalStore } from '@/platform/runtime/execution/approval-interceptor';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';

describe('CrmProposalBridge', () => {
  const orgId = 'org_enterprise_1';
  const workspaceId = 'ws_sales_alpha';
  const entityId = 'ent_acme_corp';
  const requesterId = 'usr_agent_system';
  const approverId = 'usr_manager_alice';

  let approvalStore: ReturnType<typeof createMemoryApprovalStore>;
  let bridge: CrmProposalBridge;

  const createSampleAction = (overrides?: Partial<CrmProposedAction>): CrmProposedAction => {
    const payload = {
      dealId: 'deal_101',
      currentStage: 'proposal',
      targetStage: 'negotiation',
    };
    return CrmProposedActionSchema.parse({
      id: 'act_update_stage_deal_101',
      entityId,
      workspaceId,
      actionType: 'UPDATE_STAGE',
      priority: 'HIGH',
      riskLevel: 'L2_STATE_MUTATION',
      explainability: {
        what: 'Advance deal to negotiation',
        why: 'Terms aligned in recent executive checkpoint',
        impact: 'Maintains deal momentum towards Q3 close',
        blastRadius: {
          affectedRecordsCount: 1,
          financialExposureUsd: 120000,
          isReversible: true,
        },
      },
      idempotencyKey: computeCrmActionIdempotencyKey(entityId, 'UPDATE_STAGE', payload),
      targetCapabilityId: 'crm.deal.update_stage',
      compensatingCapabilityId: 'crm.deal.revert_stage',
      payload,
      requiresApproval: true,
      createdAt: new Date().toISOString(),
      ...overrides,
    });
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockResolvedValue(undefined);
    approvalStore = createMemoryApprovalStore();
    bridge = new CrmProposalBridge({ approvalStore });
  });

  it('creates an ActionProposal with SHA-256 payloadHash and pending status (Rules 21 & 22)', async () => {
    const action = createSampleAction();
    const publishSpy = vi.spyOn(defaultEventBus, 'publish');

    const proposal = await bridge.proposeAction({
      organizationId: orgId,
      workspaceId,
      callerId: requesterId,
      action,
    });

    expect(proposal.proposalId).toBeDefined();
    expect(proposal.organizationId).toBe(orgId);
    expect(proposal.workspaceId).toBe(workspaceId);
    expect(proposal.status).toBe('pending');
    expect(proposal.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(proposal.capabilityId).toBe('crm.deal.update_stage');
    expect(proposal.what).toBe(action.explainability.what);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'crm.action.proposed',
        organizationId: orgId,
      })
    );
  });

  it('fails closed when emergency dead-man pause switch is active (Rule 60)', async () => {
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValue(new Error('GOVERNANCE_EMERGENCY_PAUSED'));

    const action = createSampleAction();

    await expect(
      bridge.proposeAction({
        organizationId: orgId,
        workspaceId,
        callerId: requesterId,
        action,
      })
    ).rejects.toThrowError(/CRM_DEAD_MAN_PAUSED/);
  });

  it('rejects execution if proposal has not been approved', async () => {
    const action = createSampleAction();
    const proposal = await bridge.proposeAction({
      organizationId: orgId,
      workspaceId,
      callerId: requesterId,
      action,
    });

    await expect(
      bridge.executeApprovedProposal({
        organizationId: orgId,
        workspaceId,
        callerId: approverId,
        proposalId: proposal.proposalId,
      })
    ).rejects.toThrowError(/PROPOSAL_NOT_APPROVED/);
  });

  it('enforces Anti-Self-Approval: requester cannot approve/execute own proposal (Rule 13)', async () => {
    const action = createSampleAction();
    const proposal = await bridge.proposeAction({
      organizationId: orgId,
      workspaceId,
      callerId: requesterId,
      action,
    });

    // Mark approved in store
    await approvalStore.updateProposalStatus({
      organizationId: orgId,
      proposalId: proposal.proposalId,
      status: 'approved',
      decidedBy: requesterId,
    });

    // Caller is the requester -> Must reject with SELF_APPROVAL_FORBIDDEN
    await expect(
      bridge.executeApprovedProposal({
        organizationId: orgId,
        workspaceId,
        callerId: requesterId,
        proposalId: proposal.proposalId,
      })
    ).rejects.toThrowError(/SELF_APPROVAL_FORBIDDEN/);
  });

  it('detects and rejects cryptographic payload tampering (Rule 22)', async () => {
    const action = createSampleAction();
    const proposal = await bridge.proposeAction({
      organizationId: orgId,
      workspaceId,
      callerId: requesterId,
      action,
    });

    await approvalStore.updateProposalStatus({
      organizationId: orgId,
      proposalId: proposal.proposalId,
      status: 'approved',
      decidedBy: approverId,
    });

    // Tampered payload with different stage
    const tamperedPayload = {
      dealId: 'deal_101',
      currentStage: 'proposal',
      targetStage: 'closed_won', // Altered stage!
    };

    await expect(
      bridge.executeApprovedProposal({
        organizationId: orgId,
        workspaceId,
        callerId: approverId,
        proposalId: proposal.proposalId,
        executionPayload: tamperedPayload,
      })
    ).rejects.toThrowError(/PAYLOAD_TAMPERED/);
  });

  it('preserves Dual-Tier CRM Data Model targeting /workspace_entities (Rule 69)', async () => {
    const action = createSampleAction({
      actionType: 'ASSIGN_OWNER',
      targetCapabilityId: 'crm.workspace_entity.assign_owner',
      compensatingCapabilityId: 'crm.workspace_entity.revert_owner',
      payload: {
        entityId,
        workspaceId,
        assignedToUserId: 'usr_new_rep_99',
      },
    });

    const proposal = await bridge.proposeAction({
      organizationId: orgId,
      workspaceId,
      callerId: requesterId,
      action,
    });

    await approvalStore.updateProposalStatus({
      organizationId: orgId,
      proposalId: proposal.proposalId,
      status: 'approved',
      decidedBy: approverId,
    });

    const executionResult = await bridge.executeApprovedProposal({
      organizationId: orgId,
      workspaceId,
      callerId: approverId,
      proposalId: proposal.proposalId,
    });

    expect(executionResult.status).toBe('executed');
    expect(executionResult.affectedRecord.targetPath).toBe(`/workspace_entities/${workspaceId}_${entityId}`);
    expect(executionResult.affectedRecord.targetPath).not.toBe(`/entities/${entityId}`);
  });

  it('executes reverse-LIFO rollback for executed proposals (Rules 27 & 63)', async () => {
    const action = createSampleAction();
    const proposal = await bridge.proposeAction({
      organizationId: orgId,
      workspaceId,
      callerId: requesterId,
      action,
    });

    await approvalStore.updateProposalStatus({
      organizationId: orgId,
      proposalId: proposal.proposalId,
      status: 'approved',
      decidedBy: approverId,
    });

    await bridge.executeApprovedProposal({
      organizationId: orgId,
      workspaceId,
      callerId: approverId,
      proposalId: proposal.proposalId,
    });

    const publishSpy = vi.spyOn(defaultEventBus, 'publish');

    const rollbackResult = await bridge.rollbackAction({
      organizationId: orgId,
      workspaceId,
      callerId: approverId,
      proposalId: proposal.proposalId,
      reason: 'Deal review revealed pending legal blocker.',
    });

    expect(rollbackResult.status).toBe('reverted');
    expect(rollbackResult.compensatingCapabilityId).toBe('crm.deal.revert_stage');
    expect(rollbackResult.reason).toContain('legal blocker');

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'crm.action.reverted',
        organizationId: orgId,
      })
    );
  });
});
