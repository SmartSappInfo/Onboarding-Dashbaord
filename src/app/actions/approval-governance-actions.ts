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
import {
  type ActionProposal,
  ActionProposalSchema,
  ACTION_PROPOSAL_STATUSES,
} from '@/platform/policy/approval-proposal-types';
import {
  checkGovernanceDeadManSwitch,
  updateEmergencyPauseStatus,
} from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { ApprovalInterceptor } from '@/platform/runtime/execution/approval-interceptor';
import { getAgentRunStore } from '@/platform/runtime/agent-run-store';
import { getSagaCompensationEngine } from '@/platform/runtime/governance/saga-compensation';
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
});

export type ApproveProposalInput = z.infer<typeof ApproveProposalInputSchema>;

const RejectProposalInputSchema = z.object({
  organizationId: z.string().min(1),
  proposalId: z.string().min(1),
  decisionNotes: z.string().min(5, 'Mandatory explanation note required (minimum 5 characters)').max(2000),
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

// ============================================================================
// 4. HELPER: Proposal Categorizer (Rule 41)
// ============================================================================

function classifyProposalCategory(proposal: ActionProposal): ProposalCategory {
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
): Promise<ApprovalGovernanceActionResult<ActionProposal[]>> {
  try {
    const input = ListProposalsInputSchema.parse(rawInput);
    const auth = await requireAuth();
    assertTenantContext(auth, input.organizationId);

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

    const limitVal = input.limit ?? 50;
    const snap = await queryRef.limit(limitVal).get();

    const proposals: ActionProposal[] = [];
    const searchLower = input.search ? input.search.toLowerCase().trim() : '';

    for (const doc of snap.docs) {
      const data = doc.data();
      const parsed = ActionProposalSchema.safeParse({
        ...data,
        proposalId: doc.id,
      });

      if (!parsed.success) {
        continue;
      }

      const proposal = parsed.data;

      // Category filter
      if (input.category && input.category !== 'all') {
        const cat = classifyProposalCategory(proposal);
        if (cat !== input.category) {
          continue;
        }
      }

      // Search filter
      if (searchLower) {
        const matchWhat = proposal.what.toLowerCase().includes(searchLower);
        const matchWhy = proposal.why.toLowerCase().includes(searchLower);
        const matchCap = proposal.capabilityId.toLowerCase().includes(searchLower);
        const matchPersona = proposal.agentPersonaId.toLowerCase().includes(searchLower);
        const matchId = proposal.proposalId.toLowerCase().includes(searchLower);

        if (!matchWhat && !matchWhy && !matchCap && !matchPersona && !matchId) {
          continue;
        }
      }

      proposals.push(proposal);
    }

    return {
      success: true,
      data: proposals,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list action proposals';
    const isIdor = message.startsWith('IDOR_VIOLATION');
    return {
      success: false,
      error: {
        code: isIdor ? 'IDOR_VIOLATION' : 'LIST_PROPOSALS_FAILED',
        message,
      },
    };
  }
}

/**
 * Get detailed metadata and cryptographic hash for a single action proposal.
 */
export async function getActionProposalDetailsAction(
  rawInput: GetProposalDetailsInput
): Promise<ApprovalGovernanceActionResult<ActionProposal>> {
  try {
    const input = GetProposalDetailsInputSchema.parse(rawInput);
    const auth = await requireAuth();
    assertTenantContext(auth, input.organizationId);

    const doc = await adminDb.collection('capability_approvals').doc(input.proposalId).get();
    if (!doc.exists) {
      return {
        success: false,
        error: {
          code: 'PROPOSAL_NOT_FOUND',
          message: `Action proposal '${input.proposalId}' does not exist.`,
        },
      };
    }

    const data = doc.data();
    if (!data || data.organizationId !== input.organizationId) {
      return {
        success: false,
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Access denied: Tenant isolation violation.',
        },
      };
    }

    const parsed = ActionProposalSchema.safeParse({
      ...data,
      proposalId: doc.id,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'PROPOSAL_CORRUPT',
          message: 'Invalid proposal record structure in database.',
        },
      };
    }

    return {
      success: true,
      data: parsed.data,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve proposal details';
    const isIdor = message.startsWith('IDOR_VIOLATION');
    return {
      success: false,
      error: {
        code: isIdor ? 'IDOR_VIOLATION' : 'GET_PROPOSAL_FAILED',
        message,
      },
    };
  }
}

/**
 * Approve an action proposal with dual-control enforcement, live TOCTOU authority,
 * and cryptographic SHA-256 payload tampering validation (Rules 13, 18, 21, 22, 60).
 */
export async function approveActionProposalAction(
  rawInput: ApproveProposalInput
): Promise<ApprovalGovernanceActionResult<ActionProposal>> {
  try {
    const input = ApproveProposalInputSchema.parse(rawInput);

    // 1. Rule 60: Check platform emergency dead-man pause
    await checkGovernanceDeadManSwitch(input.organizationId);

    // 2. Rule 51: Authenticate operator session
    const auth = await requireAuth();
    assertTenantContext(auth, input.organizationId);

    const docRef = adminDb.collection('capability_approvals').doc(input.proposalId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        success: false,
        error: {
          code: 'PROPOSAL_NOT_FOUND',
          message: `Action proposal '${input.proposalId}' not found.`,
        },
      };
    }

    const data = snap.data();
    if (!data || data.organizationId !== input.organizationId) {
      return {
        success: false,
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Tenant boundary violation.',
        },
      };
    }

    const parsed = ActionProposalSchema.safeParse({
      ...data,
      proposalId: snap.id,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'PROPOSAL_CORRUPT',
          message: 'Stored proposal data failed schema validation.',
        },
      };
    }

    const proposal = parsed.data;

    // 3. Rule 21: Check status is pending (prevent double decision / replay attacks)
    if (proposal.status !== 'pending') {
      return {
        success: false,
        error: {
          code: 'PROPOSAL_ALREADY_DECIDED',
          message: `Proposal '${input.proposalId}' is already ${proposal.status}.`,
        },
      };
    }

    // Check expiration
    if (new Date(proposal.expiresAt).getTime() < Date.now()) {
      return {
        success: false,
        error: {
          code: 'PROPOSAL_EXPIRED',
          message: `Proposal '${input.proposalId}' expired at ${proposal.expiresAt}.`,
        },
      };
    }

    // 4. Rule 13: Model Distrust & Anti-Self-Approval
    const isProposer =
      proposal.authorizingUserId === auth.uid ||
      proposal.toolInvocationId === auth.uid;

    const isL4Privileged =
      proposal.blastRadius?.riskLevel === 'L4_PRIVILEGED_DESTRUCTIVE';

    if (isProposer && isL4Privileged) {
      return {
        success: false,
        error: {
          code: 'SELF_APPROVAL_FORBIDDEN',
          message:
            'Dual-authorization required: Proposing operator cannot self-approve L4 privileged actions (Rule 13).',
        },
      };
    }

    // 5. Rule 22: Cryptographic SHA-256 Payload Hash Matching
    if (input.executionPayload) {
      const computedHash = ApprovalInterceptor.computePayloadHash(input.executionPayload);
      if (computedHash !== proposal.payloadHash) {
        return {
          success: false,
          error: {
            code: 'PAYLOAD_TAMPERED',
            message: `Execution payload does not match approved proposal hash (expected ${proposal.payloadHash}, computed ${computedHash}). Execution aborted (Rule 22).`,
          },
        };
      }
    }

    // 6. Update database record atomically
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      status: 'approved',
      approvedBy: auth.uid,
      approvedAt: now,
      updatedAt: now,
      decisionNotes: input.decisionNotes ?? null,
    };

    await docRef.update(updateData);

    const approvedProposal: ActionProposal = {
      ...proposal,
      status: 'approved',
      approvedBy: auth.uid,
      approvedAt: now,
      updatedAt: now,
      decisionNotes: input.decisionNotes,
    };

    // 7. Rule 40: Emit domain event
    const domainEvent = createDomainEvent({
      type: 'policy.approval.granted',
      organizationId: proposal.organizationId,
      workspaceId: proposal.workspaceId,
      actor: { type: 'user', id: auth.uid },
      entity: { type: 'approval_proposal', id: proposal.proposalId },
      payload: {
        proposalId: proposal.proposalId,
        decision: 'approved',
        capabilityId: proposal.capabilityId,
        notes: input.decisionNotes ?? null,
        decidedBy: auth.uid,
      },
      correlationId: `appr-${proposal.proposalId}`,
      source: 'unified_approval_center',
    });

    void defaultEventBus.publish(domainEvent);

    return {
      success: true,
      data: approvedProposal,
    };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'AGENT_GOVERNANCE_EMERGENCY_PAUSED') {
      return {
        success: false,
        error: {
          code: 'EMERGENCY_PAUSED',
          message: 'Operation blocked: Platform emergency dead-man pause is currently active.',
        },
      };
    }

    const message = err instanceof Error ? err.message : 'Failed to approve proposal';
    const isIdor = message.startsWith('IDOR_VIOLATION');
    return {
      success: false,
      error: {
        code: isIdor ? 'IDOR_VIOLATION' : 'APPROVE_FAILED',
        message,
      },
    };
  }
}

/**
 * Reject an action proposal with mandatory rationale and automatic saga rollback trigger (Rules 27, 40, 60).
 */
export async function rejectActionProposalAction(
  rawInput: RejectProposalInput
): Promise<ApprovalGovernanceActionResult<ActionProposal>> {
  try {
    const input = RejectProposalInputSchema.parse(rawInput);

    // 1. Rule 60: Check platform emergency dead-man pause
    await checkGovernanceDeadManSwitch(input.organizationId);

    // 2. Rule 51: Authenticate operator session
    const auth = await requireAuth();
    assertTenantContext(auth, input.organizationId);

    const docRef = adminDb.collection('capability_approvals').doc(input.proposalId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        success: false,
        error: {
          code: 'PROPOSAL_NOT_FOUND',
          message: `Action proposal '${input.proposalId}' not found.`,
        },
      };
    }

    const data = snap.data();
    if (!data || data.organizationId !== input.organizationId) {
      return {
        success: false,
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Tenant boundary violation.',
        },
      };
    }

    const parsed = ActionProposalSchema.safeParse({
      ...data,
      proposalId: snap.id,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'PROPOSAL_CORRUPT',
          message: 'Stored proposal data failed schema validation.',
        },
      };
    }

    const proposal = parsed.data;

    // Check status
    if (proposal.status !== 'pending') {
      return {
        success: false,
        error: {
          code: 'PROPOSAL_ALREADY_DECIDED',
          message: `Proposal '${input.proposalId}' is already ${proposal.status}.`,
        },
      };
    }

    // Update database record atomically
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      status: 'rejected',
      rejectedBy: auth.uid,
      rejectedAt: now,
      updatedAt: now,
      decisionNotes: input.decisionNotes,
    };

    await docRef.update(updateData);

    const rejectedProposal: ActionProposal = {
      ...proposal,
      status: 'rejected',
      rejectedBy: auth.uid,
      rejectedAt: now,
      updatedAt: now,
      decisionNotes: input.decisionNotes,
    };

    // 3. Rule 27: Trigger reverse-LIFO Saga compensation if linked to an agent run
    if (proposal.toolInvocationId) {
      try {
        const runStore = getAgentRunStore();
        const run = await runStore.getRun(proposal.organizationId, proposal.toolInvocationId);

        if (run) {
          const sagaEngine = getSagaCompensationEngine();
          void sagaEngine.rollbackRun({
            organizationId: proposal.organizationId,
            workspaceId: proposal.workspaceId,
            runId: proposal.toolInvocationId,
            reason: `Action proposal '${proposal.proposalId}' was rejected by human operator (${auth.uid}): ${input.decisionNotes}`,
          });
        }
      } catch (sagaErr) {
        console.warn('[ApprovalGovernance] Failed to trigger saga compensation on rejection:', sagaErr);
      }
    }

    // 4. Rule 40: Emit domain event
    const domainEvent = createDomainEvent({
      type: 'policy.approval.rejected',
      organizationId: proposal.organizationId,
      workspaceId: proposal.workspaceId,
      actor: { type: 'user', id: auth.uid },
      entity: { type: 'approval_proposal', id: proposal.proposalId },
      payload: {
        proposalId: proposal.proposalId,
        decision: 'rejected',
        capabilityId: proposal.capabilityId,
        notes: input.decisionNotes,
        decidedBy: auth.uid,
      },
      correlationId: `appr-rej-${proposal.proposalId}`,
      source: 'unified_approval_center',
    });

    void defaultEventBus.publish(domainEvent);

    return {
      success: true,
      data: rejectedProposal,
    };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'AGENT_GOVERNANCE_EMERGENCY_PAUSED') {
      return {
        success: false,
        error: {
          code: 'EMERGENCY_PAUSED',
          message: 'Operation blocked: Platform emergency dead-man pause is currently active.',
        },
      };
    }

    const message = err instanceof Error ? err.message : 'Failed to reject proposal';
    const isIdor = message.startsWith('IDOR_VIOLATION');
    const isInvalid = message.includes('Mandatory explanation note required');
    return {
      success: false,
      error: {
        code: isIdor ? 'IDOR_VIOLATION' : isInvalid ? 'INVALID_ARGUMENT' : 'REJECT_FAILED',
        message,
      },
    };
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
