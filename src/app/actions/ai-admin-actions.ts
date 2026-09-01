'use server';

/**
 * @fileOverview Secure Server Actions for AI Command Center & Administration (Phase 9)
 *
 * Provides cryptographically verified server endpoints for natural language action proposal generation,
 * human-in-the-loop approval routing, and controlled batch execution.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - All actions perform `adminAuth.verifyIdToken()`.
 * - Multi-tenant scoping enforced on every query and mutation.
 * - Zero `any` or `any[]` typing.
 */

import { adminAuth } from '@/lib/firebase-admin';
import { AiActionProposalService } from '@/lib/services/ai-admin/ai-action-proposal-service';
import { AiApprovalRoutingService } from '@/lib/services/ai-admin/ai-approval-routing-service';
import { AiExecutionEngine } from '@/lib/services/ai-admin/ai-execution-engine';
import type {
  AiAdminActionType,
  AiAdminActionProposal,
  AiProposalStatus,
  AiAdminExecutionAudit,
} from '@/lib/types';

// Helper to verify caller token
async function verifyCaller(idToken: string) {
  if (!idToken) throw new Error('Missing authentication token');
  return await adminAuth.verifyIdToken(idToken);
}

// ----------------------------------------------------
// 1. PROPOSAL ACTIONS
// ----------------------------------------------------

export async function createAiActionProposalAction(params: {
  idToken: string;
  organizationId: string;
  prompt: string;
  actionType?: AiAdminActionType;
}): Promise<{ success: boolean; proposal?: AiAdminActionProposal; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const proposal = await AiActionProposalService.createProposal(params.organizationId, {
      prompt: params.prompt,
      actionType: params.actionType,
      proposedBy: decoded.uid,
    });
    return { success: true, proposal };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create action proposal';
    return { success: false, error: msg };
  }
}

export async function listAiActionProposalsAction(params: {
  idToken: string;
  organizationId: string;
  status?: AiProposalStatus;
}): Promise<{ success: boolean; proposals: AiAdminActionProposal[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const proposals = await AiActionProposalService.listProposals(
      params.organizationId,
      params.status
    );
    return { success: true, proposals };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list action proposals';
    return { success: false, proposals: [], error: msg };
  }
}

// ----------------------------------------------------
// 2. APPROVAL & EXECUTION ACTIONS
// ----------------------------------------------------

export async function approveAiProposalAction(params: {
  idToken: string;
  organizationId: string;
  proposalId: string;
}): Promise<{
  success: boolean;
  proposal?: AiAdminActionProposal;
  audit?: AiAdminExecutionAudit;
  error?: string;
}> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const result = await AiApprovalRoutingService.approveProposal(
      params.organizationId,
      params.proposalId,
      decoded.uid
    );
    return { success: true, proposal: result.proposal, audit: result.audit };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to approve proposal';
    return { success: false, error: msg };
  }
}

export async function rejectAiProposalAction(params: {
  idToken: string;
  organizationId: string;
  proposalId: string;
  reason?: string;
}): Promise<{ success: boolean; proposal?: AiAdminActionProposal; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const proposal = await AiApprovalRoutingService.rejectProposal(
      params.organizationId,
      params.proposalId,
      decoded.uid,
      params.reason
    );
    return { success: true, proposal };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reject proposal';
    return { success: false, error: msg };
  }
}

// ----------------------------------------------------
// 3. EXECUTION AUDIT ACTIONS
// ----------------------------------------------------

export async function listAiExecutionAuditsAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{ success: boolean; audits: AiAdminExecutionAudit[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const audits = await AiExecutionEngine.listExecutionAudits(params.organizationId);
    return { success: true, audits };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list execution audits';
    return { success: false, audits: [], error: msg };
  }
}
