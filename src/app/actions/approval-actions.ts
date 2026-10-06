'use server';

/**
 * @fileOverview Secure Agent Approval Server Actions (Strangler Fig Bridge - Rule 69)
 *
 * Implements Rule 4 (Zero any & Anti-IDOR), Rule 8 (Fail-Closed Architecture),
 * Rule 13 (Model Distrust & Anti-Self-Approval), Rule 47 (Multi-Tenant Isolation),
 * Rule 51 (Server Action Authentication via Session Cookie), and Rule 60 (Emergency Pause).
 *
 * This file acts as a backward-compatible shim delegating to the canonical implementation
 * in `approval-governance-actions.ts` while preserving exact legacy signatures.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth } from '@/lib/auth/require-auth';
import type { ApprovalView } from '@/platform/policy/approval-view';
import {
  listActionProposalsAction,
  getActionProposalDetailsAction,
  approveActionProposalAction,
  rejectActionProposalAction,
  setEmergencyPauseAction as setEmergencyPauseGovernanceAction,
} from './approval-governance-actions';

export interface ApprovalActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * List pending action proposals for a workspace.
 */
export async function listPendingApprovalsAction(options?: {
  workspaceId?: string;
  organizationId?: string;
}): Promise<ApprovalActionResult<ApprovalView[]>> {
  try {
    const auth = await requireAuth();
    const orgId = auth.isSystemAdmin && options?.organizationId
      ? options.organizationId
      : auth.profile?.organizationId;

    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    const res = await listActionProposalsAction({
      organizationId: orgId,
      workspaceId: options?.workspaceId,
      status: 'pending',
    });

    if (!res.success) {
      return {
        success: false,
        error: res.error?.message ?? 'Failed to list pending proposals',
        code: res.error?.code,
      };
    }

    return { success: true, data: res.data ?? [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list pending proposals';
    return { success: false, error: message };
  }
}

/**
 * Retrieve details for a specific action proposal.
 */
export async function getApprovalDetailsAction(
  approvalId: string
): Promise<ApprovalActionResult<ApprovalView>> {
  try {
    const auth = await requireAuth();
    const orgId = auth.profile?.organizationId;
    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    const res = await getActionProposalDetailsAction({
      organizationId: orgId,
      proposalId: approvalId,
    });

    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error?.message ?? 'Failed to retrieve proposal details',
        code: res.error?.code,
      };
    }

    return { success: true, data: res.data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve proposal details';
    return { success: false, error: message };
  }
}

/**
 * Approve or reject an action proposal.
 * Strictly verifies authenticated human operator and enforces anti-self-approval (Rule 13).
 */
export async function decideApprovalAction(input: {
  approvalId: string;
  decision: 'approved' | 'rejected';
  notes?: string;
  /** The version the person saw (Rule 18). */
  expectedVersion?: number;
}): Promise<ApprovalActionResult<{ status: string; approvalsCount: number; requiredApprovals: number }>> {
  try {
    const auth = await requireAuth();
    const orgId = auth.profile?.organizationId;
    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    if (input.decision === 'approved') {
      const res = await approveActionProposalAction({
        organizationId: orgId,
        proposalId: input.approvalId,
        decisionNotes: input.notes,
        ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
      });

      if (!res.success) {
        return {
          success: false,
          error: res.error?.message ?? 'Failed to approve proposal',
          code: res.error?.code,
        };
      }

      // L4: the first of two approvals leaves the request pending (status reported as stored).
      return { success: true, data: { status: res.data?.status ?? 'approved', approvalsCount: res.data?.approvalsCount ?? 1, requiredApprovals: res.data?.requiredApprovals ?? 1 } };
    } else {
      const res = await rejectActionProposalAction({
        organizationId: orgId,
        proposalId: input.approvalId,
        decisionNotes: input.notes || 'Proposal rejected by operator',
        ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
      });

      if (!res.success) {
        return {
          success: false,
          error: res.error?.message ?? 'Failed to reject proposal',
          code: res.error?.code,
        };
      }

      return { success: true, data: { status: res.data?.status ?? 'rejected', approvalsCount: res.data?.approvalsCount ?? 0, requiredApprovals: res.data?.requiredApprovals ?? 1 } };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to decide proposal';
    return { success: false, error: message };
  }
}

/**
 * Toggle emergency governance dead-man pause platform-wide (Rule 60).
 */
export async function setEmergencyPauseAction(
  paused: boolean,
  reason?: string
): Promise<ApprovalActionResult> {
  try {
    await requireAuth();
    const res = await setEmergencyPauseGovernanceAction({
      paused,
      reason,
    });

    if (!res.success) {
      return {
        success: false,
        error: res.error?.message ?? 'Failed to update emergency pause status',
        code: res.error?.code,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update emergency pause status';
    return { success: false, error: message };
  }
}
