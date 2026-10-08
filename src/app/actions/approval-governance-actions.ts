'use server';

/**
 * @fileOverview Canonical Approval Governance Server Actions (Phase 8 Milestone 3)
 *
 * Implements:
 * - Rule 4: Zero `any` / zero `any[]` typing policy with Zod v4 schemas.
 * - Rule 8 & 47: Strict Anti-IDOR Multi-Tenant Isolation.
 * - Rule 10: Complete inline architectural documentation and type safety.
 * - Rule 12: Canonical Risk Taxonomy (L0_READ to L4_PRIVILEGED_DESTRUCTIVE).
 * - Rule 13: Model Distrust & Anti-Self-Approval Enforcement.
 * - Rule 18: Live TOCTOU Authority Check.
 * - Rule 21: Two-Phase Action Model for High-Risk Operations.
 * - Rule 22: Cryptographic SHA-256 Payload Hash Binding (Tamper Prevention).
 * - Rule 27: Formal Saga Compensation Trigger on Rejection.
 * - Rule 40: Tamper-Evident Domain Event Publication.
 * - Rule 51: Server Action Authentication via Session Cookie (`requireAuth()`).
 * - Rule 60: Emergency Dead-Man Switch Gate.
 * - Rule 69: Strangler Fig Pattern SSOT.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { adminDb } from '@/lib/firebase-admin';
import { ACTION_PROPOSAL_STATUSES } from '@/platform/policy/approval-proposal-types';
import { readStoredApproval } from '@/platform/policy/approval-record';
import { toApprovalView, type ApprovalView } from '@/platform/policy/approval-view';
import { canDecideApprovals, DECISION_MESSAGES, type DecisionActor } from '@/platform/policy/approver-policy';
import { decideApproval, getApproval, hashProposalPayload } from '@/platform/policy/unified-approval-store';
import { flattenPermissionsSchema } from '@/lib/permissions-engine';
import {
  checkGovernanceDeadManSwitch,
  updateEmergencyPauseStatus,
} from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { getAgentRunStore } from '@/platform/runtime/agent-run-store';
import { getSagaCompensationEngine } from '@/platform/runtime/governance/saga-compensation';
import { getWorkflowDispatcher } from '@/platform/workflows/dispatcher/workflow-dispatcher';
import { z } from 'zod/v4';

// ============================================================================
// 1. RESULT CONTRACTS & ERROR CODES (Rule 4, 10, 48)
// ============================================================================

export interface ApprovalGovernanceActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ApprovalGovernanceMetrics {
  pendingCount: number;
  approvedCount24h: number;
  rejectedCount24h: number;
  criticalPendingCount: number;
  isEmergencyPaused: boolean;
}

const PROPOSAL_CATEGORIES = [
  'all',
  'campaigns',
  'financial',
  'messaging',
  'bulk_updates',
  'privileged',
] as const;

export type ProposalCategory = (typeof PROPOSAL_CATEGORIES)[number];

// ============================================================================
// 2. INPUT SCHEMAS (Rule 4 & 10)
// ============================================================================

const ListProposalsInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().optional(),
  status: z.enum([...ACTION_PROPOSAL_STATUSES, 'all']).default('pending').optional(),
  category: z.enum(PROPOSAL_CATEGORIES).default('all').optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50).optional(),
  cursor: z.string().optional(),
});

export type ListProposalsInput = z.infer<typeof ListProposalsInputSchema>;

const GetProposalDetailsInputSchema = z.object({
  organizationId: z.string().min(1),
  proposalId: z.string().min(1),
});

export type GetProposalDetailsInput = z.infer<typeof GetProposalDetailsInputSchema>;

const ApproveProposalInputSchema = z.object({
  organizationId: z.string().min(1),
  proposalId: z.string().min(1),
  executionPayload: z.record(z.string(), z.unknown()).optional(),
  decisionNotes: z.string().max(2000).optional(),
  /** The record version the person saw (Rule 18): a concurrent decision is refused, not overwritten. */
  expectedVersion: z.number().int().min(0).optional(),
});

export type ApproveProposalInput = z.infer<typeof ApproveProposalInputSchema>;

const RejectProposalInputSchema = z.object({
  organizationId: z.string().min(1),
  proposalId: z.string().min(1),
  decisionNotes: z.string().min(5, 'Mandatory explanation note required (minimum 5 characters)').max(2000),
  expectedVersion: z.number().int().min(0).optional(),
});

export type RejectProposalInput = z.infer<typeof RejectProposalInputSchema>;

const GetApprovalMetricsInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().optional(),
});

export type GetApprovalMetricsInput = z.infer<typeof GetApprovalMetricsInputSchema>;

const SetEmergencyPauseInputSchema = z.object({
  paused: z.boolean(),
  reason: z.string().max(500).optional(),
});

export type SetEmergencyPauseInput = z.infer<typeof SetEmergencyPauseInputSchema>;

// ============================================================================
// 3. HELPER: Anti-IDOR Enforcement (Rule 8 & 47)
// ============================================================================

function assertTenantContext(auth: AuthContext, requestedOrgId: string): void {
  const sessionOrgId = auth.profile?.organizationId;
  if (!auth.isSystemAdmin && sessionOrgId !== requestedOrgId) {
    throw new Error(
      `IDOR_VIOLATION: Authenticated principal from tenant '${sessionOrgId}' cannot access tenant '${requestedOrgId}'.`
    );
  }
}

/** The person deciding, with their effective flat permissions (profile list ∪ flattened schema). */
function decisionActorFrom(auth: AuthContext): DecisionActor {
  const schemaPerms = auth.profile.permissionsSchema ? flattenPermissionsSchema(auth.profile.permissionsSchema) : [];
  return {
    uid: auth.uid,
    isSystemAdmin: auth.isSystemAdmin,
    workspaceIds: auth.profile.workspaceIds ?? [],
    permissions: [...(auth.profile.permissions ?? []), ...schemaPerms],
  };
}

const canDecideFor = (actor: DecisionActor) => (r: { workspaceId: string; requestedByUserId: string }) =>
  canDecideApprovals(actor, r.workspaceId).ok && r.requestedByUserId !== actor.uid;

/** Security feed (Rule 62): refused decisions are recorded, without payload content. */
function publishSecurityEvent(
  type: 'approval.self_decision_blocked' | 'approval.permission_denied' | 'approval.binding_mismatch',
  params: { organizationId: string; workspaceId?: string; approvalId: string; uid: string; code: string }
): void {
  void defaultEventBus.publish(createDomainEvent({
    type,
    organizationId: params.organizationId,
    ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
    actor: { type: 'user', id: params.uid },
    entity: { type: 'approval_proposal', id: params.approvalId },
    payload: { approvalId: params.approvalId, code: params.code },
    correlationId: `appr-sec-${params.approvalId}`,
    source: 'unified_approval_center',
  }));
}

const REFUSAL_MESSAGES: Readonly<Record<string, string>> = {
  ...DECISION_MESSAGES,
  NOT_FOUND: 'This request no longer exists.',
  NEEDS_REPROPOSAL: 'This request was made before approvals were updated. Ask for it again.',
};

// ============================================================================
// 4. HELPER: Proposal Categorizer (Rule 41)
// ============================================================================

function classifyProposalCategory(proposal: Pick<ApprovalView, 'capabilityId' | 'blastRadius'>): ProposalCategory {
  const capId = proposal.capabilityId.toLowerCase();
  const risk = proposal.blastRadius?.riskLevel;
  const count = proposal.blastRadius?.entityCount ?? 0;

  if (risk === 'L4_PRIVILEGED_DESTRUCTIVE' || capId.startsWith('system.') || capId.startsWith('iam.')) {
    return 'privileged';
  }
  if (capId.startsWith('campaign.') || capId.startsWith('campaigns.') || capId.startsWith('marketing.')) {
    return 'campaigns';
  }
  if (
    capId.startsWith('messaging.') ||
    capId.startsWith('email.') ||
    capId.startsWith('sms.') ||
    capId.startsWith('whatsapp.')
  ) {
    return 'messaging';
  }
  if (
    risk === 'L3_EXTERNAL_COMMUNICATION_FINANCE' ||
    capId.startsWith('finance.') ||
    capId.startsWith('billing.') ||
    capId.startsWith('stripe.') ||
    (proposal.blastRadius?.estimatedCostUsd ?? 0) > 0
  ) {
    return 'financial';
  }
  if (count > 1 || capId.startsWith('bulk.')) {
    return 'bulk_updates';
  }

  return 'all';
}

// ============================================================================
// 5. SERVER ACTIONS (Rule 51)
// ============================================================================

/**
 * List action proposals for the unified approval mission control desk.
 */
export async function listActionProposalsAction(
  rawInput: ListProposalsInput
): Promise<ApprovalGovernanceActionResult<ApprovalView[]>> {
  try {
    const input = ListProposalsInputSchema.parse(rawInput);
    const auth = await requireAuth();
    assertTenantContext(auth, input.organizationId);
    const actor = decisionActorFrom(auth);

    let queryRef = adminDb
      .collection('capability_approvals')
      .where('organizationId', '==', input.organizationId);
    if (input.workspaceId) {
      queryRef = queryRef.where('workspaceId', '==', input.workspaceId);
    }
    const targetStatus = input.status ?? 'pending';
    if (targetStatus !== 'all') {
      queryRef = queryRef.where('status', '==', targetStatus);
    }
    const snap = await queryRef.limit(input.limit ?? 50).get();
    const searchLower = input.search ? input.search.toLowerCase().trim() : '';
    const proposals: ApprovalView[] = [];

    for (const doc of snap.docs) {
      const view = toApprovalView(readStoredApproval(doc.id, doc.data()), canDecideFor(actor));
      if (!view || view.organizationId !== input.organizationId) continue;
      // Only workspaces the person belongs to (system admins see all).
      if (!actor.isSystemAdmin && !actor.workspaceIds.includes(view.workspaceId)) continue;
      if (input.category && input.category !== 'all' && classifyProposalCategory(view) !== input.category) continue;
      if (searchLower) {
        const haystack = [view.what, view.why, view.capabilityId, view.agentPersonaId ?? '', view.proposalId].join(' ').toLowerCase();
        if (!haystack.includes(searchLower)) continue;
      }
      proposals.push(view);
    }

    return { success: true, data: proposals };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list action proposals';
    const isIdor = message.startsWith('IDOR_VIOLATION');
    return { success: false, error: { code: isIdor ? 'IDOR_VIOLATION' : 'LIST_PROPOSALS_FAILED', message } };
  }
}

/**
 * Get detailed metadata and cryptographic hash for a single action proposal.
 */
export async function getActionProposalDetailsAction(
  rawInput: GetProposalDetailsInput
): Promise<ApprovalGovernanceActionResult<ApprovalView>> {
  try {
    const input = GetProposalDetailsInputSchema.parse(rawInput);
    const auth = await requireAuth();
    assertTenantContext(auth, input.organizationId);
    const actor = decisionActorFrom(auth);
    const stored = await getApproval(adminDb, input.proposalId, input.organizationId);
    const view = stored ? toApprovalView(stored, canDecideFor(actor)) : null;
    if (!view || (!actor.isSystemAdmin && !actor.workspaceIds.includes(view.workspaceId))) {
      return { success: false, error: { code: 'PROPOSAL_NOT_FOUND', message: REFUSAL_MESSAGES.NOT_FOUND } };
    }
    return { success: true, data: view };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve proposal details';
    const isIdor = message.startsWith('IDOR_VIOLATION');
    return { success: false, error: { code: isIdor ? 'IDOR_VIOLATION' : 'GET_PROPOSAL_FAILED', message } };
  }
}

/**
 * Shared decision path (Phase 11 M0 · T2.5): approver policy in a transaction (membership +
 * `agent_approvals_decide`, never the proposer, L4 dual, expected version), security-feed events on
 * refusals (Rule 62), the decision event only when the decision is complete (Rule 40).
 */
async function decide(
  auth: AuthContext,
  params: {
    organizationId: string;
    proposalId: string;
    decision: 'approved' | 'rejected';
    notes?: string;
    expectedVersion?: number;
    executionPayload?: Record<string, unknown>;
  }
): Promise<ApprovalGovernanceActionResult<ApprovalView>> {
  const actor = decisionActorFrom(auth);

  // Rule 22: when the UI sends the payload it showed, it must hash to what was proposed.
  if (params.executionPayload) {
    const stored = await getApproval(adminDb, params.proposalId, params.organizationId);
    if (stored?.kind === 'v2' && hashProposalPayload(stored.record, params.executionPayload) !== stored.record.payloadHash) {
      publishSecurityEvent('approval.binding_mismatch', { organizationId: params.organizationId, workspaceId: stored.record.workspaceId, approvalId: params.proposalId, uid: auth.uid, code: 'PAYLOAD_TAMPERED' });
      return { success: false, error: { code: 'PAYLOAD_TAMPERED', message: 'The change shown differs from the one proposed. Reload and review it again.' } };
    }
  }

  const result = await decideApproval(adminDb, {
    approvalId: params.proposalId,
    organizationId: params.organizationId,
    actor,
    decision: params.decision,
    ...(params.notes ? { notes: params.notes } : {}),
    ...(params.expectedVersion !== undefined ? { expectedVersion: params.expectedVersion } : {}),
    nowMs: Date.now(),
  });

  if (!result.ok) {
    if (result.code === 'SELF_DECISION') {
      publishSecurityEvent('approval.self_decision_blocked', { organizationId: params.organizationId, approvalId: params.proposalId, uid: auth.uid, code: result.code });
    } else if (result.code === 'NOT_PERMITTED' || result.code === 'NOT_MEMBER') {
      publishSecurityEvent('approval.permission_denied', { organizationId: params.organizationId, approvalId: params.proposalId, uid: auth.uid, code: result.code });
    }
    return { success: false, error: { code: result.code, message: REFUSAL_MESSAGES[result.code] ?? 'This request could not be decided.' } };
  }

  const record = result.record;
  if (result.complete) {
    void defaultEventBus.publish(createDomainEvent({
      type: params.decision === 'approved' ? 'policy.approval.granted' : 'policy.approval.rejected',
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      actor: { type: 'user', id: auth.uid },
      entity: { type: 'approval_proposal', id: record.approvalId },
      payload: {
        proposalId: record.approvalId,
        decision: params.decision,
        capabilityId: record.capabilityId,
        notes: params.notes ?? null,
        decidedBy: auth.uid,
        ...(record.workflowRef ? { workflowRef: record.workflowRef } : {}),
      },
      correlationId: `appr-${params.decision === 'approved' ? '' : 'rej-'}${record.approvalId}`,
      source: 'unified_approval_center',
    }));

    // T5.3: a workflow step waiting on this approval runs again; the runner reads the decision
    // (approved → executes with this approvalId, rejected → the step fails). One task per approval.
    if (record.workflowRef) {
      try {
        await getWorkflowDispatcher().enqueueWorkflowStep({
          workflowId: record.workflowRef.workflowId,
          stepId: record.workflowRef.stepId,
          tenant: { organizationId: record.organizationId, workspaceId: record.workspaceId },
          idempotencyKey: `wf_resume_${record.approvalId}`,
          correlationId: `appr-${record.approvalId}`,
        });
      } catch (resumeErr) {
        console.warn('[ApprovalGovernance] Failed to resume the waiting workflow step:', resumeErr);
      }
    }
  }

  // Rule 27: a rejected step of an agent run triggers saga compensation for that run.
  const runId = typeof record.evidence?.runId === 'string' ? record.evidence.runId : undefined;
  if (params.decision === 'rejected' && runId) {
    try {
      const run = await getAgentRunStore().getRun(record.organizationId, runId);
      if (run) {
        void getSagaCompensationEngine().rollbackRun({
          organizationId: record.organizationId,
          workspaceId: record.workspaceId,
          runId,
          reason: `Approval '${record.approvalId}' was rejected (${auth.uid}): ${params.notes ?? ''}`,
        });
      }
    } catch (sagaErr) {
      console.warn('[ApprovalGovernance] Failed to trigger saga compensation on rejection:', sagaErr);
    }
  }

  const view = toApprovalView({ kind: 'v2', record }, canDecideFor(actor));
  return view ? { success: true, data: view } : { success: false, error: { code: 'DECIDE_FAILED', message: 'Decision saved, but it could not be displayed.' } };
}

function mapDecisionError(err: unknown, fallback: string): ApprovalGovernanceActionResult<ApprovalView> {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
  if (code === 'AGENT_GOVERNANCE_EMERGENCY_PAUSED') {
    return { success: false, error: { code: 'EMERGENCY_PAUSED', message: 'Operation blocked: Platform emergency dead-man pause is currently active.' } };
  }
  const message = err instanceof Error ? err.message : fallback;
  const isIdor = message.startsWith('IDOR_VIOLATION');
  const isInvalid = message.includes('Mandatory explanation note required');
  return { success: false, error: { code: isIdor ? 'IDOR_VIOLATION' : isInvalid ? 'INVALID_ARGUMENT' : 'DECIDE_FAILED', message } };
}

/**
 * Approve an action proposal (Rules 13, 17, 18, 21, 22, 60): approver policy, payload binding,
 * L4 dual approval, expected version.
 */
export async function approveActionProposalAction(
  rawInput: ApproveProposalInput
): Promise<ApprovalGovernanceActionResult<ApprovalView>> {
  try {
    const input = ApproveProposalInputSchema.parse(rawInput);
    await checkGovernanceDeadManSwitch(input.organizationId);
    const auth = await requireAuth();
    assertTenantContext(auth, input.organizationId);
    return await decide(auth, {
      organizationId: input.organizationId,
      proposalId: input.proposalId,
      decision: 'approved',
      ...(input.decisionNotes ? { notes: input.decisionNotes } : {}),
      ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
      ...(input.executionPayload ? { executionPayload: input.executionPayload } : {}),
    });
  } catch (err: unknown) {
    return mapDecisionError(err, 'Failed to approve proposal');
  }
}

/**
 * Reject an action proposal with a mandatory reason (Rules 27, 40, 60); same approver policy.
 */
export async function rejectActionProposalAction(
  rawInput: RejectProposalInput
): Promise<ApprovalGovernanceActionResult<ApprovalView>> {
  try {
    const input = RejectProposalInputSchema.parse(rawInput);
    await checkGovernanceDeadManSwitch(input.organizationId);
    const auth = await requireAuth();
    assertTenantContext(auth, input.organizationId);
    return await decide(auth, {
      organizationId: input.organizationId,
      proposalId: input.proposalId,
      decision: 'rejected',
      notes: input.decisionNotes,
      ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
    });
  } catch (err: unknown) {
    return mapDecisionError(err, 'Failed to reject proposal');
  }
}

/**
 * Retrieve aggregated metrics for the Approval Mission Control KPI cards.
 */
export async function getApprovalGovernanceMetricsAction(
  rawInput: GetApprovalMetricsInput
): Promise<ApprovalGovernanceActionResult<ApprovalGovernanceMetrics>> {
  try {
    const input = GetApprovalMetricsInputSchema.parse(rawInput);
    const auth = await requireAuth();
    assertTenantContext(auth, input.organizationId);

    // 1. Pending count
    const pendingSnap = await adminDb
      .collection('capability_approvals')
      .where('organizationId', '==', input.organizationId)
      .where('status', '==', 'pending')
      .limit(100)
      .get();

    let criticalPending = 0;
    for (const doc of pendingSnap.docs) {
      const data = doc.data();
      if (
        data.riskLevel === 'L4_PRIVILEGED_DESTRUCTIVE' ||
        data.blastRadius?.riskLevel === 'L4_PRIVILEGED_DESTRUCTIVE' ||
        data.blastRadius?.riskLevel === 'critical'
      ) {
        criticalPending++;
      }
    }

    // 2. Approved 24h count
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const approvedSnap = await adminDb
      .collection('capability_approvals')
      .where('organizationId', '==', input.organizationId)
      .where('status', '==', 'approved')
      .limit(100)
      .get();

    let approved24h = 0;
    for (const doc of approvedSnap.docs) {
      const d = doc.data();
      if (d.approvedAt && d.approvedAt >= twentyFourHoursAgo) {
        approved24h++;
      }
    }

    // 3. Rejected 24h count
    const rejectedSnap = await adminDb
      .collection('capability_approvals')
      .where('organizationId', '==', input.organizationId)
      .where('status', '==', 'rejected')
      .limit(100)
      .get();

    let rejected24h = 0;
    for (const doc of rejectedSnap.docs) {
      const d = doc.data();
      if (d.rejectedAt && d.rejectedAt >= twentyFourHoursAgo) {
        rejected24h++;
      }
    }

    // 4. Dead-man switch status
    let isEmergencyPaused = false;
    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      isEmergencyPaused = true;
    }

    return {
      success: true,
      data: {
        pendingCount: pendingSnap.size,
        approvedCount24h: approved24h,
        rejectedCount24h: rejected24h,
        criticalPendingCount: criticalPending,
        isEmergencyPaused,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve approval metrics';
    const isIdor = message.startsWith('IDOR_VIOLATION');
    return {
      success: false,
      error: {
        code: isIdor ? 'IDOR_VIOLATION' : 'METRICS_FAILED',
        message,
      },
    };
  }
}

/**
 * Toggle emergency governance dead-man pause platform-wide (Rule 60).
 */
export async function setEmergencyPauseAction(
  rawInput: SetEmergencyPauseInput
): Promise<ApprovalGovernanceActionResult<{ paused: boolean }>> {
  try {
    const input = SetEmergencyPauseInputSchema.parse(rawInput);
    const auth = await requireAuth();

    if (!auth.isSystemAdmin) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only system administrators can toggle emergency pause.',
        },
      };
    }

    if (input.paused && (!input.reason || input.reason.trim().length < 5)) {
      return {
        success: false,
        error: {
          code: 'INVALID_ARGUMENT',
          message: 'A justification of at least 5 characters is required to engage the emergency dead-man pause (Rule 60 & 61).',
        },
      };
    }

    await updateEmergencyPauseStatus(input.paused, input.reason, auth.uid);

    return {
      success: true,
      data: {
        paused: input.paused,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update emergency pause status';
    return {
      success: false,
      error: {
        code: 'EMERGENCY_PAUSE_UPDATE_FAILED',
        message,
      },
    };
  }
}
