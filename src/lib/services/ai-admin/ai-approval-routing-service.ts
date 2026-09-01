/**
 * @fileOverview AI Administrative Approval Routing Service (Phase 9)
 *
 * Enforces explicit human-in-the-loop authorization gates and policy pre-flight checks
 * before triggering execution pipelines.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - AI cannot execute without explicit administrator approval.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `ai-admin-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  AiAdminActionProposal,
  AiAdminExecutionAudit,
} from '@/lib/types';
import { AiExecutionEngine } from './ai-execution-engine';

export class AiApprovalRoutingService {
  private static collectionName = 'ai_action_proposals';

  /**
   * Approves an action proposal and dispatches execution.
   */
  static async approveProposal(
    organizationId: string,
    proposalId: string,
    adminUid: string
  ): Promise<{ proposal: AiAdminActionProposal; audit: AiAdminExecutionAudit }> {
    const docRef = adminDb.collection(this.collectionName).doc(proposalId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error(`Proposal ${proposalId} not found.`);
    }

    const proposal = snap.data() as AiAdminActionProposal;
    if (proposal.status !== 'pending_approval' && proposal.status !== 'proposed') {
      throw new Error(`Cannot approve proposal in status: ${proposal.status}.`);
    }

    const now = new Date().toISOString();
    const updated: AiAdminActionProposal = {
      ...proposal,
      status: 'approved',
      approvedBy: adminUid,
      approvedAt: now,
    };

    await docRef.set(updated, { merge: true });

    // Execute immediately upon approval
    const audit = await AiExecutionEngine.executeProposal(organizationId, proposalId, adminUid);

    return { proposal: updated, audit };
  }

  /**
   * Rejects an action proposal.
   */
  static async rejectProposal(
    organizationId: string,
    proposalId: string,
    adminUid: string,
    reason?: string
  ): Promise<AiAdminActionProposal> {
    const docRef = adminDb.collection(this.collectionName).doc(proposalId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error(`Proposal ${proposalId} not found.`);
    }

    const proposal = snap.data() as AiAdminActionProposal;
    const now = new Date().toISOString();

    const updated: AiAdminActionProposal = {
      ...proposal,
      status: 'rejected',
      rejectedBy: adminUid,
      rejectedAt: now,
      executionError: reason,
    };

    await docRef.set(updated, { merge: true });
    return updated;
  }
}
