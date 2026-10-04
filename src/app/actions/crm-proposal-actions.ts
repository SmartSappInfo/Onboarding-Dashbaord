'use server';

/**
 * @fileOverview Secure Server Actions: CRM Action Proposals, Risk Evaluation & Rollbacks (Phase 9 Milestone 4)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Inline Architectural Documentation), Rule 13 (Anti-Self-Approval),
 * Rule 21/22 (Two-Phase Action Model & SHA-256 Cryptographic Tamper Defense),
 * Rule 27 (Reverse-LIFO Saga Rollbacks), Rule 40 (Domain Event Publishing),
 * Rule 51 (Next.js 15 Server Actions Conventions), Rule 60 (Emergency Dead-Man Switch Evaluation),
 * and Rule 69 (Dual-Tier CRM Data Model Preservation).
 *
 * Provides operator action endpoints for:
 * 1. `evaluateAccountRisksAction`: Hybrid risk assessment across stalled deals, dark accounts, overdue tasks.
 * 2. `generateNextBestActionsAction`: Prioritized next-best-actions with Rule 41 explainability grids.
 * 3. `proposeCrmActionAction`: Submits mutating recommendations to the unified ApprovalStore.
 * 4. `executeApprovedCrmProposalAction`: Executes approved proposals with SHA-256 tamper verification.
 * 5. `rollbackCrmActionAction`: 1-click reverse-LIFO Saga compensation for executed CRM actions.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { getAccountContextAssembler } from '@/platform/agents/crm/context/account-context-assembler';
import {
  CrmProposedActionSchema,
  type CrmRiskAssessment,
  type CrmProposedAction,
  CrmActionError,
} from '@/platform/agents/crm/actions/crm-action-types';
import { getCrmRiskDetector } from '@/platform/agents/crm/actions/crm-risk-detector';
import { getCrmNextBestActionEngine } from '@/platform/agents/crm/actions/crm-next-best-action-engine';
import {
  getCrmProposalBridge,
  type CrmProposalExecutionResult,
  type CrmProposalRollbackResult,
} from '@/platform/agents/crm/actions/crm-proposal-bridge';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';

export interface CrmProposalActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validates tenant boundaries and enforces Anti-IDOR security (Rule 8 & 47).
 */
function assertTenantAccess(auth: AuthContext, requestedWorkspaceId: string): string {
  const sessionOrgId = auth.profile?.organizationId;
  if (!sessionOrgId) {
    throw new CrmActionError('IDOR_VIOLATION', 'Missing authenticated organization context.');
  }

  const sessionWsId = auth.profile?.lastActiveWorkspaceId;
  if (!auth.isSystemAdmin && sessionWsId && sessionWsId !== requestedWorkspaceId) {
    throw new CrmActionError(
      'IDOR_VIOLATION',
      `Authenticated principal in workspace '${sessionWsId}' cannot access requested workspace '${requestedWorkspaceId}'.`
    );
  }

  return sessionOrgId;
}

/**
 * Sanitizes errors and returns standard CrmProposalActionResult (Rule 48).
 */
function handleActionError<T>(err: unknown): CrmProposalActionResult<T> {
  if (err instanceof CrmActionError) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };
  }

  const message = err instanceof Error ? err.message : 'Internal CRM action failure';
  if (message.includes('authenticated') || message.includes('requireAuth')) {
    return {
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'User must be authenticated to perform this operation.',
      },
    };
  }

  if (
    message.includes('CRM_DEAD_MAN_PAUSED') ||
    message.includes('Emergency') ||
    message.includes('paused') ||
    message.includes('dead-man')
  ) {
    return {
      success: false,
      error: {
        code: 'CRM_DEAD_MAN_PAUSED',
        message: 'Autonomous CRM actions are paused by governance dead-man switch.',
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  };
}

/**
 * Evaluates multi-dimensional account risks from an Account360Context.
 */
export async function evaluateAccountRisksAction(input: {
  workspaceId: string;
  entityId: string;
}): Promise<CrmProposalActionResult<CrmRiskAssessment>> {
  try {
    const auth = await requireAuth();
    const organizationId = assertTenantAccess(auth, input.workspaceId);

    // Rule 60 Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(organizationId);

    const assembler = getAccountContextAssembler();
    const context = await assembler.assembleContext({
      organizationId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
    });

    const riskDetector = getCrmRiskDetector();
    const assessment = await riskDetector.evaluateRisks(context);

    return {
      success: true,
      data: assessment,
    };
  } catch (err: unknown) {
    return handleActionError<CrmRiskAssessment>(err);
  }
}

/**
 * Synthesizes prioritized next-best-actions with Rule 41 explainability grids.
 */
export async function generateNextBestActionsAction(input: {
  workspaceId: string;
  entityId: string;
}): Promise<
  CrmProposalActionResult<{
    actions: CrmProposedAction[];
    assessment: CrmRiskAssessment;
  }>
> {
  try {
    const auth = await requireAuth();
    const organizationId = assertTenantAccess(auth, input.workspaceId);

    // Rule 60 Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(organizationId);

    const assembler = getAccountContextAssembler();
    const context = await assembler.assembleContext({
      organizationId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
    });

    const riskDetector = getCrmRiskDetector();
    const assessment = await riskDetector.evaluateRisks(context);

    const nbaEngine = getCrmNextBestActionEngine();
    const actions = await nbaEngine.generateNextBestActions(context, assessment);

    return {
      success: true,
      data: {
        actions,
        assessment,
      },
    };
  } catch (err: unknown) {
    return handleActionError<{
      actions: CrmProposedAction[];
      assessment: CrmRiskAssessment;
    }>(err);
  }
}

/**
 * Formulates a two-phase action proposal in the ApprovalStore.
 */
export async function proposeCrmActionAction(input: {
  workspaceId: string;
  entityId: string;
  actionData: CrmProposedAction;
}): Promise<CrmProposalActionResult<ActionProposal>> {
  try {
    const auth = await requireAuth();
    const organizationId = assertTenantAccess(auth, input.workspaceId);

    // Rule 60 Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(organizationId);

    const validatedAction = CrmProposedActionSchema.parse(input.actionData);

    const proposalBridge = getCrmProposalBridge();
    const proposal = await proposalBridge.proposeAction({
      organizationId,
      workspaceId: input.workspaceId,
      callerId: auth.uid,
      action: validatedAction,
    });

    return {
      success: true,
      data: proposal,
    };
  } catch (err: unknown) {
    return handleActionError<ActionProposal>(err);
  }
}

/**
 * Executes an approved CRM proposal with SHA-256 cryptographic tamper verification.
 */
export async function executeApprovedCrmProposalAction(input: {
  organizationId: string;
  workspaceId?: string;
  proposalId: string;
  executionPayload?: Record<string, unknown>;
  expectedVersion?: number;
}): Promise<CrmProposalActionResult<CrmProposalExecutionResult>> {
  try {
    const auth = await requireAuth();
    const callerOrgId = auth.profile?.organizationId;

    if (!auth.isSystemAdmin && callerOrgId !== input.organizationId) {
      throw new CrmActionError('IDOR_VIOLATION', 'Tenant IDOR violation: organization mismatch.');
    }

    // Rule 60 Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(input.organizationId);

    const proposalBridge = getCrmProposalBridge();
    const result = await proposalBridge.executeApprovedProposal({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId ?? auth.profile?.lastActiveWorkspaceId ?? '',
      callerId: auth.uid,
      proposalId: input.proposalId,
      executionPayload: input.executionPayload,
      expectedVersion: input.expectedVersion,
    });

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    return handleActionError<CrmProposalExecutionResult>(err);
  }
}

/**
 * Rolls back an executed CRM proposal via reverse-LIFO Saga compensation (Rules 27 & 63).
 */
export async function rollbackCrmActionAction(input: {
  organizationId: string;
  workspaceId?: string;
  proposalId: string;
  reason: string;
}): Promise<CrmProposalActionResult<CrmProposalRollbackResult>> {
  try {
    const auth = await requireAuth();
    const callerOrgId = auth.profile?.organizationId;

    if (!auth.isSystemAdmin && callerOrgId !== input.organizationId) {
      throw new CrmActionError('IDOR_VIOLATION', 'Tenant IDOR violation: organization mismatch.');
    }

    // Rule 60 Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(input.organizationId);

    const proposalBridge = getCrmProposalBridge();
    const result = await proposalBridge.rollbackAction({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId ?? auth.profile?.lastActiveWorkspaceId ?? '',
      callerId: auth.uid,
      proposalId: input.proposalId,
      reason: input.reason,
    });

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    return handleActionError<CrmProposalRollbackResult>(err);
  }
}
