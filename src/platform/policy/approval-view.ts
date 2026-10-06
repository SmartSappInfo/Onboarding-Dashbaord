/**
 * @fileOverview One read model for the approvals inbox (Phase 11 M0 · T2.6-2.7).
 *
 * The inbox renders unified records (v2) and legacy proposals through this single shape. It keeps
 * the familiar `ActionProposal` fields (WHAT / WHY / blast radius / evidence, Rule 41) and adds what
 * the approver needs to act safely:
 * - `needsReproposal`: a legacy proposal that can no longer be decided (D7);
 * - `executable`: false for recommendations (target not a registered capability, F7);
 * - `requiredApprovals` / `approvalsCount`: L4 shows "1 of 2 approvals";
 * - `version`: sent back with the decision (Rule 18);
 * - `canDecide`: the current person may approve/reject (buttons are hidden otherwise; the server
 *   enforces it again).
 * `agentPersonaId` is optional because workflow approvals (M0 · T5) have no persona.
 */

import type { ActionProposal } from './approval-proposal-types';
import type { ApprovalRecord, StoredApproval } from './approval-record';

export interface ApprovalView extends Omit<ActionProposal, 'agentPersonaId' | 'authorizingUserId'> {
  agentPersonaId?: ActionProposal['agentPersonaId'];
  /** The person on whose behalf it was requested (the proposer). */
  authorizingUserId: string;
  needsReproposal: boolean;
  executable: boolean;
  requiredApprovals: number;
  approvalsCount: number;
  version: number;
  riskLevel?: ApprovalRecord['riskLevel'];
  workflowRef?: ApprovalRecord['workflowRef'];
  canDecide: boolean;
}

export function toApprovalView(stored: StoredApproval, canDecide: (record: { workspaceId: string; requestedByUserId: string }) => boolean): ApprovalView | null {
  switch (stored.kind) {
    case 'v2': {
      const r = stored.record;
      return {
        proposalId: r.approvalId,
        organizationId: r.organizationId,
        workspaceId: r.workspaceId,
        capabilityId: r.capabilityId,
        capabilityVersion: r.capabilityVersion,
        ...(r.requestedBy.agentPersonaId ? { agentPersonaId: r.requestedBy.agentPersonaId } : {}),
        authorizingUserId: r.requestedBy.userId,
        what: r.what,
        why: r.why,
        ...(r.blastRadius ? { blastRadius: r.blastRadius } : {}),
        ...(r.evidence ? { evidence: r.evidence } : {}),
        payload: r.payload,
        payloadHash: r.payloadHash,
        status: r.status,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        decisionNotes: r.decisionNotes ?? null,
        approvedBy: r.approvedBy,
        approvedAt: r.approvedAt,
        rejectedBy: r.rejectedBy ?? null,
        rejectedAt: r.rejectedAt ?? null,
        boundToolInvocationId: r.boundToolInvocationId ?? null,
        boundAt: r.boundAt ?? null,
        needsReproposal: false,
        executable: r.executable,
        requiredApprovals: r.requiredApprovals,
        approvalsCount: r.approvals.length,
        version: r.version,
        riskLevel: r.riskLevel,
        ...(r.workflowRef ? { workflowRef: r.workflowRef } : {}),
        canDecide: r.status === 'pending' && canDecide({ workspaceId: r.workspaceId, requestedByUserId: r.requestedBy.userId }),
      };
    }
    case 'legacy_proposal': {
      const p = stored.proposal;
      return {
        ...p,
        needsReproposal: true,
        executable: false,
        requiredApprovals: 1,
        approvalsCount: p.approvedBy ? 1 : 0,
        version: 0,
        canDecide: false,
      };
    }
    default:
      return null;
  }
}
