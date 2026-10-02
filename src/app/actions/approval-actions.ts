'use server';

/**
 * @fileOverview Secure Agent Approval Server Actions (Phase 3 Milestone 3 & 4)
 *
 * Implements Rule 4 (Zero any & Anti-IDOR), Rule 8 (Fail-Closed Architecture),
 * Rule 13 (Model Distrust & Anti-Self-Approval), Rule 47 (Multi-Tenant Isolation),
 * Rule 51 (Server Action Authentication via Session Cookie), and Rule 60 (Emergency Pause).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth } from '@/lib/auth/require-auth';
import { adminDb } from '@/lib/firebase-admin';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';
import { ActionProposalSchema } from '@/platform/policy/approval-proposal-types';
import {
  checkGovernanceDeadManSwitch,
  updateEmergencyPauseStatus,
} from '@/platform/policy/governance-dead-man';
import { globalEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

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
}): Promise<ApprovalActionResult<ActionProposal[]>> {
  try {
    const auth = await requireAuth();
    const orgId = auth.isSystemAdmin && options?.organizationId
      ? options.organizationId
      : auth.profile.organizationId;
    if (!orgId) {
      return { success: false, error: 'Missing organization context', code: 'TENANT_REQUIRED' };
    }

    let queryRef = adminDb.collection('capability_approvals').where('organizationId', '==', orgId);

    if (options?.workspaceId) {
      queryRef = queryRef.where('workspaceId', '==', options.workspaceId);
    }

    const snap = await queryRef.where('status', '==', 'pending').limit(100).get();

    const proposals: ActionProposal[] = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      const parsed = ActionProposalSchema.safeParse({
        ...data,
        proposalId: doc.id,
      });
      if (parsed.success) {
        proposals.push(parsed.data);
      }
    }

    return { success: true, data: proposals };
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
): Promise<ApprovalActionResult<ActionProposal>> {
  try {
    const auth = await requireAuth();
    if (!approvalId) {
      return { success: false, error: 'Approval ID required', code: 'INVALID_ARGUMENT' };
    }

    const doc = await adminDb.collection('capability_approvals').doc(approvalId).get();
    if (!doc.exists) {
      return { success: false, error: 'Proposal not found', code: 'PROPOSAL_NOT_FOUND' };
    }

    const data = doc.data();
    if (!data) {
      return { success: false, error: 'Proposal empty', code: 'PROPOSAL_CORRUPT' };
    }

    // Tenant isolation verification (Rule 47)
    if (!auth.isSystemAdmin && data.organizationId !== auth.profile.organizationId) {
      return { success: false, error: 'Access denied: Tenant mismatch', code: 'TENANT_MISMATCH' };
    }

    const parsed = ActionProposalSchema.safeParse({
      ...data,
      proposalId: doc.id,
    });

    if (!parsed.success) {
      return { success: false, error: 'Invalid proposal record structure', code: 'PROPOSAL_CORRUPT' };
    }

    return { success: true, data: parsed.data };
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
}): Promise<ApprovalActionResult<{ status: string }>> {
  try {
    // 1. Check emergency dead-man pause (Rule 60)
    await checkGovernanceDeadManSwitch();

    // 2. Authenticate human operator (Rule 51)
    const auth = await requireAuth();

    if (!input.approvalId) {
      return { success: false, error: 'Missing approval ID', code: 'INVALID_ARGUMENT' };
    }

    const docRef = adminDb.collection('capability_approvals').doc(input.approvalId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Proposal not found', code: 'PROPOSAL_NOT_FOUND' };
    }

    const data = snap.data();
    if (!data) {
      return { success: false, error: 'Corrupt proposal record', code: 'PROPOSAL_CORRUPT' };
    }

    // 3. Multi-tenant boundary check (Rule 47)
    if (!auth.isSystemAdmin && data.organizationId !== auth.profile.organizationId) {
      return { success: false, error: 'Tenant isolation violation', code: 'TENANT_MISMATCH' };
    }

    // 4. Anti-Self-Approval Enforcement (Rule 13)
    const isProposer =
      (data.who && typeof data.who === 'object' && (data.who as Record<string, unknown>).id === auth.uid) ||
      data.authorizingUserId === auth.uid ||
      (data.requestedBy && data.requestedBy === auth.uid);

    // Proposing operators cannot self-approve critical/L4 privileged actions (dual-authorization required)
    if (
      isProposer &&
      (data.blastRadius?.riskLevel === 'L4_PRIVILEGED_DESTRUCTIVE' || data.blastRadius === 'critical')
    ) {
      return {
        success: false,
        error: 'Dual-authorization required: Proposing operator cannot self-approve critical/L4 privileged actions (Rule 13).',
        code: 'SELF_APPROVAL_FORBIDDEN',
      };
    }

    if (data.status !== 'pending') {
      return {
        success: false,
        error: `Proposal is already ${data.status}`,
        code: 'PROPOSAL_ALREADY_DECIDED',
      };
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      status: input.decision,
      updatedAt: now,
      decisionNotes: input.notes ?? null,
    };

    if (input.decision === 'approved') {
      updateData.approvedBy = auth.uid;
      updateData.approvedAt = now;
    } else {
      updateData.rejectedBy = auth.uid;
      updateData.rejectedAt = now;
    }

    await docRef.update(updateData);

    // 5. Emit domain event via Platform Event Bus (Rule 40)
    const eventType = input.decision === 'approved' ? 'policy.approval.granted' : 'policy.approval.rejected';
    const domainEvent = createDomainEvent({
      type: eventType,
      organizationId: data.organizationId,
      workspaceId: data.workspaceId,
      actor: { type: 'user', id: auth.uid },
      entity: { type: 'approval_proposal', id: input.approvalId },
      payload: {
        proposalId: input.approvalId,
        decision: input.decision,
        capabilityId: data.capabilityId,
        notes: input.notes ?? null,
        decidedBy: auth.uid,
      },
      correlationId: `appr-decide-${input.approvalId}`,
      source: 'operator_approval_center',
    });

    void globalEventBus.publish(domainEvent);

    return { success: true, data: { status: input.decision } };
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
    const auth = await requireAuth();
    if (!auth.isSystemAdmin) {
      return { success: false, error: 'Only system administrators can toggle emergency pause.', code: 'FORBIDDEN' };
    }

    await updateEmergencyPauseStatus(paused, reason, auth.uid);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update emergency pause status';
    return { success: false, error: message };
  }
}
