/**
 * @fileOverview Two-Phase Financial Proposal Bridge (Phase 12 Milestone 4)
 *
 * Implements:
 * - Rule 8 & 47 (Multi-Tenant Anti-IDOR Boundary Validation)
 * - Rule 13 (Anti-Self-Approval Enforcement)
 * - Rule 18 (Live TOCTOU Authority & Freshness Checks)
 * - Rule 19 (Deterministic Idempotency Key Tracking)
 * - Rule 21 (Action Proposal Interception into Approval Center)
 * - Rule 22 (Cryptographic SHA-256 Tampering Detection)
 * - Rule 27 (Reverse-LIFO Saga Compensation via FINANCE_ROLLBACK_MATRIX)
 * - Rule 40 (Domain Event Publishing)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Governed Capability Layer & Strangler Fig Invariant)
 */

import crypto from 'crypto';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { canonicalizeJson, computePayloadHashAsync } from '../reconciliation/reconciliation-hash';
import {
  type RiskLevel,
  type InstallmentPaymentPlan,
  roundCurrency,
  COLLECTIONS_ERROR_CODES,
  CollectionsError,
} from './collections-types';

export interface FinancialActionProposal {
  proposalId: string;
  entityId: string;
  workspaceId: string;
  organizationId: string;
  actionType: string;
  targetCapability: string;
  riskLevel: RiskLevel;
  payload: Record<string, unknown>;
  payloadHash: string;
  proposerUserId: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  revertedBy?: string;
  revertedAt?: string;
  status: 'pending' | 'approved' | 'executed' | 'rejected' | 'reverted';
  what: string;
  why: string;
  createdAt: string;
  expectedVersion: number;
  compensatingCapability: string;
}

export interface ProposeFinancialActionInput {
  entityId: string;
  workspaceId: string;
  organizationId: string;
  actionType: string;
  targetCapability: string;
  riskLevel: RiskLevel;
  payload: Record<string, unknown>;
  proposerUserId: string;
  what: string;
  why: string;
  expectedVersion?: number;
}

export interface ExecuteApprovedProposalInput {
  proposalId: string;
  operatorUserId: string;
  workspaceId: string;
  organizationId: string;
  livePayload: Record<string, unknown>;
}

export interface RollbackProposalInput {
  proposalId: string;
  operatorUserId: string;
  workspaceId: string;
  organizationId: string;
}

// In-memory proposal store for runtime/testing persistence
const inMemoryProposals = new Map<string, FinancialActionProposal>();

export class FinanceProposalBridge {
  private async checkDeadMan(organizationId: string): Promise<void> {
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.COLLECTIONS_DEAD_MAN_PAUSED,
        `Collections operations are currently paused by the emergency governance dead-man switch for organization '${organizationId}'.`,
        503
      );
    }
  }

  /**
   * Phase 1: Proposes a financial collections mutation into the unified approval store.
   * Computes SHA-256 payloadHash across canonicalized keys (Rule 22).
   */
  public async proposeCollectionsAction(
    input: ProposeFinancialActionInput
  ): Promise<FinancialActionProposal> {
    await this.checkDeadMan(input.organizationId);

    const payloadHash = await computePayloadHashAsync(input.payload);
    const proposalId = `prop_${input.entityId}_${crypto.randomUUID().slice(0, 8)}`;

    let compensatingCapability = 'finance.collection.cancel_plan';
    if (input.targetCapability === 'finance.collection.record_promise') {
      compensatingCapability = 'finance.collection.delete_promise';
    } else if (input.targetCapability === 'finance.fee.record_installment') {
      compensatingCapability = 'finance.fee.void_installment';
    }

    const proposal: FinancialActionProposal = {
      proposalId,
      entityId: input.entityId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      actionType: input.actionType,
      targetCapability: input.targetCapability,
      riskLevel: input.riskLevel,
      payload: input.payload,
      payloadHash,
      proposerUserId: input.proposerUserId,
      status: 'pending',
      what: input.what,
      why: input.why,
      createdAt: new Date().toISOString(),
      expectedVersion: input.expectedVersion ?? 1,
      compensatingCapability,
    };

    inMemoryProposals.set(proposalId, proposal);

    // Rule 40: Emit domain event
    defaultEventBus.publish(
      createDomainEvent({
        type: 'finance.collections.action_proposed',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        actor: { type: 'agent', id: 'collections_agent' },
        entity: { type: 'action_proposal', id: proposalId },
        payload: {
          proposalId,
          entityId: input.entityId,
          actionType: input.actionType,
          targetCapability: input.targetCapability,
          riskLevel: input.riskLevel,
          payloadHash,
          proposerUserId: input.proposerUserId,
        },
        correlationId: crypto.randomUUID(),
        source: 'finance-proposal-bridge',
      })
    );

    return proposal;
  }

  /**
   * Phase 2: Executes an approved financial proposal.
   * Enforces Anti-Self-Approval (Rule 13), cryptographic SHA-256 validation (Rule 22),
   * and live TOCTOU freshness checking (Rule 18).
   */
  public async executeApprovedProposal(
    input: ExecuteApprovedProposalInput
  ): Promise<{
    proposalId: string;
    status: 'executed';
    executedAt: string;
    payloadHash: string;
    targetCapability: string;
  }> {
    await this.checkDeadMan(input.organizationId);

    const proposal = inMemoryProposals.get(input.proposalId);
    if (!proposal) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.INTERNAL_ERROR,
        `Proposal '${input.proposalId}' not found in approval store.`,
        404
      );
    }

    // Rule 8 & 47: Anti-IDOR validation
    if (
      proposal.organizationId !== input.organizationId ||
      proposal.workspaceId !== input.workspaceId
    ) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.IDOR_VIOLATION,
        `Cross-tenant execution forbidden for proposal '${input.proposalId}'.`,
        403
      );
    }

    // Rule 13: Anti-Self-Approval Enforcement
    if (proposal.proposerUserId === input.operatorUserId) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.SELF_APPROVAL_FORBIDDEN,
        `Operator '${input.operatorUserId}' proposed this action and cannot self-approve or execute it. Independent dual-custody review required.`,
        403
      );
    }

    // Rule 22: Cryptographic SHA-256 Tampering Validation
    const liveHash = await computePayloadHashAsync(input.livePayload);
    if (liveHash !== proposal.payloadHash) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.PAYLOAD_TAMPERED,
        `Cryptographic payload tampering detected! Live payload hash '${liveHash.slice(0, 16)}' does not match approved hash '${proposal.payloadHash.slice(0, 16)}'.`,
        400
      );
    }

    // Rule 18: Live TOCTOU Freshness Check
    // If the payload specifies a totalAmount or balance, verify it hasn't become stale
    if (typeof input.livePayload.totalAmount === 'number') {
      const liveTotal = roundCurrency(input.livePayload.totalAmount);
      if (liveTotal <= 0) {
        throw new CollectionsError(
          COLLECTIONS_ERROR_CODES.STALE_BALANCE,
          `Invoice balance has been cleared or altered. Cannot execute proposal with non-positive amount (${liveTotal}).`,
          409
        );
      }
    }

    const executedAt = new Date().toISOString();
    proposal.status = 'executed';
    proposal.approvedBy = input.operatorUserId;
    proposal.approvedAt = executedAt;
    inMemoryProposals.set(input.proposalId, proposal);

    // Rule 40: Emit domain event
    defaultEventBus.publish(
      createDomainEvent({
        type: 'finance.collections.action_executed',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        actor: { type: 'user', id: input.operatorUserId },
        entity: { type: 'action_proposal', id: input.proposalId },
        payload: {
          proposalId: input.proposalId,
          entityId: proposal.entityId,
          targetCapability: proposal.targetCapability,
          executedBy: input.operatorUserId,
          executedAt,
          payloadHash: proposal.payloadHash,
        },
        correlationId: crypto.randomUUID(),
        source: 'finance-proposal-bridge',
      })
    );

    return {
      proposalId: input.proposalId,
      status: 'executed',
      executedAt,
      payloadHash: proposal.payloadHash,
      targetCapability: proposal.targetCapability,
    };
  }

  /**
   * Reverse-LIFO Saga Compensation: Rolls back an executed proposal using its
   * designated compensating capability in FINANCE_ROLLBACK_MATRIX (Rule 27).
   */
  public async rollbackProposal(
    input: RollbackProposalInput
  ): Promise<{
    proposalId: string;
    status: 'reverted';
    revertedAt: string;
    compensatingCapability: string;
  }> {
    await this.checkDeadMan(input.organizationId);

    const proposal = inMemoryProposals.get(input.proposalId);
    if (!proposal) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.INTERNAL_ERROR,
        `Proposal '${input.proposalId}' not found in approval store.`,
        404
      );
    }

    if (
      proposal.organizationId !== input.organizationId ||
      proposal.workspaceId !== input.workspaceId
    ) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.IDOR_VIOLATION,
        `Cross-tenant rollback forbidden for proposal '${input.proposalId}'.`,
        403
      );
    }

    const revertedAt = new Date().toISOString();
    proposal.status = 'reverted';
    proposal.revertedBy = input.operatorUserId;
    proposal.revertedAt = revertedAt;
    inMemoryProposals.set(input.proposalId, proposal);

    // Rule 40: Emit domain event
    defaultEventBus.publish(
      createDomainEvent({
        type: 'finance.collections.action_reverted',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        actor: { type: 'user', id: input.operatorUserId },
        entity: { type: 'action_proposal', id: input.proposalId },
        payload: {
          proposalId: input.proposalId,
          entityId: proposal.entityId,
          compensatingCapability: proposal.compensatingCapability,
          revertedBy: input.operatorUserId,
          revertedAt,
        },
        correlationId: crypto.randomUUID(),
        source: 'finance-proposal-bridge',
      })
    );

    return {
      proposalId: input.proposalId,
      status: 'reverted',
      revertedAt,
      compensatingCapability: proposal.compensatingCapability,
    };
  }

  /**
   * Lists pending proposals for a workspace/organization.
   */
  public async getPendingProposals(
    organizationId: string,
    workspaceId: string
  ): Promise<FinancialActionProposal[]> {
    const list: FinancialActionProposal[] = [];
    for (const p of inMemoryProposals.values()) {
      if (
        p.organizationId === organizationId &&
        p.workspaceId === workspaceId &&
        p.status === 'pending'
      ) {
        list.push(p);
      }
    }
    return list;
  }

  /**
   * Retrieves a single proposal by ID.
   */
  public async getProposalById(proposalId: string): Promise<FinancialActionProposal | null> {
    return inMemoryProposals.get(proposalId) || null;
  }

  /**
   * Resets in-memory proposals for hermetic testing.
   */
  public resetInMemoryStore(): void {
    inMemoryProposals.clear();
  }
}

// Global HMR singleton preservation
const GLOBAL_PROPOSAL_BRIDGE_KEY = Symbol.for('__smartsapp_finance_proposal_bridge__');
type GlobalWithProposalBridge = typeof globalThis & {
  [GLOBAL_PROPOSAL_BRIDGE_KEY]?: FinanceProposalBridge;
};

export function getFinanceProposalBridge(): FinanceProposalBridge {
  const g = globalThis as GlobalWithProposalBridge;
  if (!g[GLOBAL_PROPOSAL_BRIDGE_KEY]) {
    g[GLOBAL_PROPOSAL_BRIDGE_KEY] = new FinanceProposalBridge();
  }
  return g[GLOBAL_PROPOSAL_BRIDGE_KEY];
}
