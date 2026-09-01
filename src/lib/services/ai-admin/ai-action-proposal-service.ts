/**
 * @fileOverview AI Administrative Action Proposal Engine (Phase 9)
 *
 * Converts natural language administrative commands into structured, type-safe
 * action proposals with pre-computed impact simulations.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs strict action schema validation.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `ai-admin-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  AiAdminActionType,
  AiAdminActionProposal,
  AiProposalStatus,
} from '@/lib/types';
import { AiImpactSimulationService } from './ai-impact-simulation-service';

export class AiActionProposalService {
  private static collectionName = 'ai_action_proposals';

  /**
   * Generates a structured action proposal with simulated impact analysis.
   */
  static async createProposal(
    organizationId: string,
    payload: {
      prompt: string;
      actionType?: AiAdminActionType;
      proposedBy: string;
    }
  ): Promise<AiAdminActionProposal> {
    const promptLower = payload.prompt.toLowerCase();
    let actionType: AiAdminActionType = 'create_access_review_campaign';
    let title = 'Workforce Administrative Review';
    let explanation = 'Generated administrative workflow proposal based on prompt analysis.';

    if (promptLower.includes('finance') || promptLower.includes('inactive admin') || promptLower.includes('dormant')) {
      actionType = 'prune_dormant_administrators';
      title = 'Review and Prune Inactive Administrators';
      explanation = 'Automated proposal to identify dormant administrative accounts (>90d inactive), trim over-privileged roles, and revoke stale auth sessions.';
    } else if (promptLower.includes('duplicate') || promptLower.includes('merge role')) {
      actionType = 'merge_duplicate_roles';
      title = 'Merge Redundant Role Definitions';
      explanation = 'Automated proposal to detect overlapping permission sets across roles, merge duplicate roles, and migrate assignees safely.';
    } else if (promptLower.includes('sales') || promptLower.includes('crm') || promptLower.includes('rebalance')) {
      actionType = 'rebalance_inactive_crm_portfolios';
      title = 'Rebalance Inactive Sales Rep Portfolios';
      explanation = 'Automated proposal to reassign active customer accounts and pipeline deals from inactive representatives to active squad leads.';
    } else if (promptLower.includes('access review') || promptLower.includes('campaign')) {
      actionType = 'create_access_review_campaign';
      title = 'Launch Departmental Access Certification Campaign';
      explanation = 'Automated proposal to initiate a scheduled access review campaign for department heads to certify member role entitlements.';
    }

    // Override if actionType explicitly passed
    if (payload.actionType) {
      actionType = payload.actionType;
    }

    const impactPreview = await AiImpactSimulationService.simulateImpact(organizationId, actionType, {
      prompt: payload.prompt,
    });

    const docRef = adminDb.collection(this.collectionName).doc();
    const proposal: AiAdminActionProposal = {
      id: docRef.id,
      organizationId,
      naturalLanguagePrompt: payload.prompt,
      actionType,
      title,
      explanation,
      impactPreview,
      payload: {
        prompt: payload.prompt,
        inferredType: actionType,
      },
      status: 'pending_approval',
      requiresDualApproval: impactPreview.blastRadius === 'critical',
      proposedBy: payload.proposedBy,
      createdAt: new Date().toISOString(),
    };

    await docRef.set(proposal);
    return proposal;
  }

  /**
   * Lists administrative action proposals for an organization.
   */
  static async listProposals(
    organizationId: string,
    status?: AiProposalStatus
  ): Promise<AiAdminActionProposal[]> {
    let query = adminDb
      .collection(this.collectionName)
      .where('organizationId', '==', organizationId);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.get();
    const proposals = snap.docs.map((d) => d.data() as AiAdminActionProposal);
    return proposals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
