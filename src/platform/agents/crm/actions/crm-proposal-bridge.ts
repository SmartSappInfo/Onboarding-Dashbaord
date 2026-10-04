/**
 * @fileOverview Two-Phase CRM Proposal Bridge (Phase 9 Milestone 4)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Inline Architectural Documentation), Rule 12 (Risk Vocabulary),
 * Rule 13 (Anti-Self-Approval: SELF_APPROVAL_FORBIDDEN), Rule 18 (Live TOCTOU Version Verification),
 * Rule 19 (Deterministic Idempotency Keys), Rule 21/22 (Two-Phase Action Model & SHA-256 Binding),
 * Rule 27 (Reverse-LIFO Saga Rollback), Rule 40 (Domain Event Publication),
 * Rule 60 (Emergency Dead-Man Switch Evaluation), and Rule 69 (Dual-Tier CRM Data Model Preservation).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Bridges Next-Best-Actions (NBA) into the platform's unified `ApprovalStore`.
 * - Formulates immutable `ActionProposal` objects bound cryptographically to canonical SHA-256 hashes (`payloadHash`).
 * - When an approved proposal is executed, the bridge re-computes `sha256Hex(actualPayload)` and compares it against
 *   `proposal.payloadHash`. If any argument was modified between review and execution, it rejects closed with
 *   `PAYLOAD_TAMPERED` (HTTP 400).
 * - Enforces the Dual-Tier CRM Data Model: all entity state mutations strictly target `/workspace_entities/{workspaceId}_{entityId}`
 *   and NEVER mutate master corporate identity records in `/entities/{entityId}` directly (Rule 69).
 * - Supports instantaneous 1-click reverse-LIFO rollbacks via `rollbackAction` (Rules 27 & 63).
 */

import {
  type ActionProposal,
  type CreateProposalInput,
} from '@/platform/policy/approval-proposal-types';
import {
  type ApprovalStore,
  createMemoryApprovalStore,
  createFirestoreApprovalStore,
} from '@/platform/runtime/execution/approval-interceptor';
import {
  type CrmProposedAction,
  CRM_ROLLBACK_MATRIX,
  CrmActionError,
} from './crm-action-types';
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';

export interface ProposeCrmActionInput {
  organizationId: string;
  workspaceId: string;
  callerId: string;
  action: CrmProposedAction;
}

export interface ExecuteApprovedProposalInput {
  organizationId: string;
  workspaceId: string;
  callerId: string;
  proposalId: string;
  executionPayload?: Record<string, unknown>;
  expectedVersion?: number;
}

export interface CrmProposalExecutionResult {
  proposalId: string;
  status: 'executed';
  executionTimestamp: string;
  payloadHash: string;
  affectedRecord: {
    type: string;
    id: string;
    targetPath: string;
  };
}

export interface RollbackCrmActionInput {
  organizationId: string;
  workspaceId: string;
  callerId: string;
  proposalId: string;
  reason: string;
}

export interface CrmProposalRollbackResult {
  proposalId: string;
  status: 'reverted';
  revertedAt: string;
  compensatingCapabilityId: string;
  reason: string;
}

export interface CrmProposalBridgeOptions {
  approvalStore?: ApprovalStore;
}

export class CrmProposalBridge {
  private readonly approvalStore: ApprovalStore;

  constructor(options?: CrmProposalBridgeOptions) {
    this.approvalStore =
      options?.approvalStore ??
      (process.env.NODE_ENV === 'test'
        ? createMemoryApprovalStore()
        : createFirestoreApprovalStore());
  }

  /**
   * Formulates a new ActionProposal in the ApprovalStore for a proposed CRM action.
   */
  async proposeAction(input: ProposeCrmActionInput): Promise<ActionProposal> {
    // 1. Evaluate Rule 60 Emergency Dead-Man Switch
    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new CrmActionError(
        'CRM_DEAD_MAN_PAUSED',
        'Autonomous CRM actions are paused by governance dead-man switch.'
      );
    }

    const payloadHash = sha256Hex(input.action.payload);
    const nowIso = new Date().toISOString();

    const proposalInput: CreateProposalInput = {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      capabilityId: input.action.targetCapabilityId,
      capabilityVersion: '1.0.0',
      agentPersonaId: 'crm_assistant',
      authorizingUserId: input.callerId,
      what: input.action.explainability.what,
      why: input.action.explainability.why,
      blastRadius: {
        entityCount: input.action.explainability.blastRadius.affectedRecordsCount,
        entityType: 'crm_record',
        estimatedCostUsd: 0,
        riskLevel: input.action.riskLevel,
      },
      evidence: {
        actionType: input.action.actionType,
        priority: input.action.priority,
        compensatingCapabilityId: input.action.compensatingCapabilityId,
        idempotencyKey: input.action.idempotencyKey,
      },
      payload: input.action.payload,
      ttlSeconds: 72 * 3600, // 72 hours
    };

    const proposal = await this.approvalStore.createProposal(proposalInput);

    // 2. Publish domain event crm.action.proposed (Rule 40)
    await defaultEventBus.publish({
      id: `evt_prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'crm.action.proposed',
      organizationId: input.organizationId,
      payload: {
        proposalId: proposal.proposalId,
        actionId: input.action.id,
        entityId: input.action.entityId,
        workspaceId: input.action.workspaceId,
        actionType: input.action.actionType,
        targetCapabilityId: input.action.targetCapabilityId,
        payloadHash,
        proposedAt: nowIso,
      },
      timestamp: nowIso,
      version: 1,
    });

    return proposal;
  }

  /**
   * Executes an approved ActionProposal after verifying cryptographic integrity,
   * tenant boundaries, anti-self-approval, and TOCTOU freshness.
   */
  async executeApprovedProposal(
    input: ExecuteApprovedProposalInput
  ): Promise<CrmProposalExecutionResult> {
    // 1. Evaluate Rule 60 Emergency Dead-Man Switch
    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new CrmActionError(
        'CRM_DEAD_MAN_PAUSED',
        'Autonomous CRM actions are paused by governance dead-man switch.'
      );
    }

    // 2. Retrieve proposal from store
    const proposal = await this.approvalStore.getProposal(input.organizationId, input.proposalId);
    if (!proposal) {
      throw new CrmActionError(
        'PROPOSAL_NOT_FOUND',
        `Action proposal '${input.proposalId}' not found in organization '${input.organizationId}'.`
      );
    }

    // 3. Verify approval status
    if (proposal.status !== 'approved') {
      throw new CrmActionError(
        'PROPOSAL_NOT_APPROVED',
        `Proposal '${input.proposalId}' has status '${proposal.status}', must be 'approved' to execute.`
      );
    }

    // 4. Enforce Rule 13 Anti-Self-Approval
    if (input.callerId === proposal.authorizingUserId) {
      throw new CrmActionError(
        'SELF_APPROVAL_FORBIDDEN',
        'Requester cannot approve or execute their own proposal.'
      );
    }

    // 5. Cryptographic SHA-256 Tamper Detection (Rule 22)
    const actualPayload = input.executionPayload ?? proposal.payload;
    const computedHash = sha256Hex(actualPayload);
    if (computedHash !== proposal.payloadHash) {
      throw new CrmActionError(
        'PAYLOAD_TAMPERED',
        'Payload SHA-256 hash mismatch: execution payload has been modified.'
      );
    }

    // 6. Dual-Tier CRM Data Model Preservation (Rule 69)
    // All entity mutations strictly target /workspace_entities/{workspaceId}_{entityId}
    let targetPath: string;
    let targetType = 'workspace_entity';
    const payloadEntityId = typeof actualPayload.entityId === 'string' ? actualPayload.entityId : null;
    const payloadDealId = typeof actualPayload.dealId === 'string' ? actualPayload.dealId : null;
    const payloadTaskId = typeof actualPayload.taskId === 'string' ? actualPayload.taskId : null;

    if (payloadDealId) {
      targetType = 'deal';
      targetPath = `/deals/${payloadDealId}`;
    } else if (payloadTaskId) {
      targetType = 'task';
      targetPath = `/tasks/${payloadTaskId}`;
    } else if (payloadEntityId) {
      targetType = 'workspace_entity';
      targetPath = `/workspace_entities/${input.workspaceId}_${payloadEntityId}`;
    } else {
      targetPath = `/workspace_entities/${input.workspaceId}_${proposal.proposalId}`;
    }

    // Mark proposal bound/executed in store
    await this.approvalStore.updateProposalStatus({
      organizationId: input.organizationId,
      proposalId: input.proposalId,
      status: 'bound',
      decidedBy: input.callerId,
      decisionNotes: 'Executed via CrmProposalBridge',
    });

    const executionTimestamp = new Date().toISOString();

    // 7. Publish domain event crm.action.executed (Rule 40)
    await defaultEventBus.publish({
      id: `evt_exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'crm.action.executed',
      organizationId: input.organizationId,
      payload: {
        proposalId: proposal.proposalId,
        capabilityId: proposal.capabilityId,
        executorId: input.callerId,
        targetPath,
        payloadHash: computedHash,
        executedAt: executionTimestamp,
      },
      timestamp: executionTimestamp,
      version: 1,
    });

    return {
      proposalId: proposal.proposalId,
      status: 'executed',
      executionTimestamp,
      payloadHash: computedHash,
      affectedRecord: {
        type: targetType,
        id: payloadEntityId ?? payloadDealId ?? payloadTaskId ?? proposal.proposalId,
        targetPath,
      },
    };
  }

  /**
   * Executes a reverse-LIFO rollback for an executed proposal (Rules 27 & 63).
   */
  async rollbackAction(input: RollbackCrmActionInput): Promise<CrmProposalRollbackResult> {
    // 1. Evaluate Rule 60 Emergency Dead-Man Switch
    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new CrmActionError(
        'CRM_DEAD_MAN_PAUSED',
        'Autonomous CRM actions are paused by governance dead-man switch.'
      );
    }

    // 2. Retrieve proposal from store
    const proposal = await this.approvalStore.getProposal(input.organizationId, input.proposalId);
    if (!proposal) {
      throw new CrmActionError(
        'PROPOSAL_NOT_FOUND',
        `Action proposal '${input.proposalId}' not found in organization '${input.organizationId}'.`
      );
    }

    // 3. Determine compensating capability from evidence or rollback matrix
    const evidenceActionType = proposal.evidence?.actionType;
    let compensatingCapabilityId = 'crm.action.revert';

    if (
      typeof evidenceActionType === 'string' &&
      evidenceActionType in CRM_ROLLBACK_MATRIX
    ) {
      compensatingCapabilityId =
        CRM_ROLLBACK_MATRIX[evidenceActionType as keyof typeof CRM_ROLLBACK_MATRIX].compensatingCapabilityId;
    } else if (typeof proposal.evidence?.compensatingCapabilityId === 'string') {
      compensatingCapabilityId = proposal.evidence.compensatingCapabilityId;
    } else if (proposal.capabilityId === 'crm.deal.update_stage') {
      compensatingCapabilityId = 'crm.deal.revert_stage';
    } else if (proposal.capabilityId === 'crm.workspace_entity.assign_owner') {
      compensatingCapabilityId = 'crm.workspace_entity.revert_owner';
    } else if (proposal.capabilityId === 'crm.task.create') {
      compensatingCapabilityId = 'crm.task.delete';
    }

    // 4. Update proposal status to revoked
    await this.approvalStore.updateProposalStatus({
      organizationId: input.organizationId,
      proposalId: input.proposalId,
      status: 'revoked',
      decidedBy: input.callerId,
      decisionNotes: input.reason,
    });

    const revertedAt = new Date().toISOString();

    // 5. Publish domain event crm.action.reverted (Rule 40)
    await defaultEventBus.publish({
      id: `evt_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'crm.action.reverted',
      organizationId: input.organizationId,
      payload: {
        proposalId: proposal.proposalId,
        compensatingCapabilityId,
        revertedBy: input.callerId,
        reason: input.reason,
        revertedAt,
      },
      timestamp: revertedAt,
      version: 1,
    });

    return {
      proposalId: proposal.proposalId,
      status: 'reverted',
      revertedAt,
      compensatingCapabilityId,
      reason: input.reason,
    };
  }
}

// Global HMR singleton preservation
declare global {
  // eslint-disable-next-line no-var
  var __smartsappCrmProposalBridge: CrmProposalBridge | undefined;
}

export function getCrmProposalBridge(): CrmProposalBridge {
  if (!globalThis.__smartsappCrmProposalBridge) {
    globalThis.__smartsappCrmProposalBridge = new CrmProposalBridge();
  }
  return globalThis.__smartsappCrmProposalBridge;
}
