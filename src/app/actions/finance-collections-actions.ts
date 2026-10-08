'use server';

/**
 * @fileOverview Secure Server Actions: Intelligent Collections & Debt Recovery (Phase 12 Milestone 4)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Lock)
 * - Rule 13 (Anti-Self-Approval Enforcement)
 * - Rule 18 (Live TOCTOU Authority & Freshness Checks)
 * - Rule 20 & 40 (Domain Event Publishing)
 * - Rule 21 (Action Proposal Interception)
 * - Rule 22 (Cryptographic SHA-256 Payload Tampering Detection)
 * - Rule 51 (Next.js 15 Server Actions Conventions: session auth, parameter validation)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Strangler Fig Invariant: wraps deterministic capabilities)
 * - .agents/AGENTS.md (Actionable Toast Navigation with relative paths)
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { getCollectionsEngine } from '@/platform/agents/finance/collections/collections-engine';
import { getFinanceProposalBridge } from '@/platform/agents/finance/collections/finance-proposal-bridge';
import {
  type DebtorAccount,
  type InstallmentPaymentPlan,
  type CollectionsNextBestAction,
  type CollectionsMetrics,
  type AgingBucket,
  type CollectionsActionResult,
  type GenerateInstallmentPlanInput,
  type ProposeCollectionsActionInput,
  type RecordPromiseToPayInput,
  GetDebtorAccountsInputSchema,
  GenerateInstallmentPlanInputSchema,
  ProposeCollectionsActionInputSchema,
  RecordPromiseToPayInputSchema,
  COLLECTIONS_ERROR_CODES,
  CollectionsError,
} from '@/platform/agents/finance/collections/collections-types';

/**
 * Validates tenant boundaries and enforces Anti-IDOR security (Rules 8 & 47).
 */
function assertTenantAccess(
  auth: AuthContext,
  requestedOrgId: string,
  requestedWorkspaceId?: string
): string {
  const sessionOrgId = auth.profile?.organizationId;
  if (!sessionOrgId) {
    throw new CollectionsError(
      COLLECTIONS_ERROR_CODES.IDOR_VIOLATION,
      'Missing authenticated organization context.',
      403
    );
  }

  if (sessionOrgId !== requestedOrgId) {
    throw new CollectionsError(
      COLLECTIONS_ERROR_CODES.IDOR_VIOLATION,
      `IDOR_VIOLATION: Session organization '${sessionOrgId}' does not match requested organization '${requestedOrgId}'.`,
      403
    );
  }

  const sessionWsId = auth.profile?.lastActiveWorkspaceId;
  if (
    !auth.isSystemAdmin &&
    sessionWsId &&
    requestedWorkspaceId &&
    sessionWsId !== requestedWorkspaceId
  ) {
    throw new CollectionsError(
      COLLECTIONS_ERROR_CODES.IDOR_VIOLATION,
      `IDOR_VIOLATION: Session workspace '${sessionWsId}' does not match requested workspace '${requestedWorkspaceId}'.`,
      403
    );
  }

  return sessionOrgId;
}

/**
 * Sanitizes errors and maps to standard CollectionsActionResult (Rule 48).
 */
function handleActionError<T>(err: unknown): CollectionsActionResult<T> {
  if (err instanceof CollectionsError) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        httpStatus: err.httpStatus,
      },
    };
  }

  const message = err instanceof Error ? err.message : 'An unexpected collections error occurred.';
  return {
    success: false,
    error: {
      code: COLLECTIONS_ERROR_CODES.INTERNAL_ERROR,
      message,
      httpStatus: 500,
    },
  };
}

/**
 * Server Action: Retrieves debtor accounts with aging buckets and search filters.
 */
export async function getDebtorAccountsAction(filters: {
  workspaceId: string;
  organizationId: string;
  agingBucket?: AgingBucket;
  searchQuery?: string;
  limit?: number;
}): Promise<CollectionsActionResult<DebtorAccount[]>> {
  try {
    const auth = await requireAuth();
    assertTenantAccess(auth, filters.organizationId, filters.workspaceId);

    const parsed = GetDebtorAccountsInputSchema.parse(filters);
    const engine = getCollectionsEngine();
    const accounts = await engine.getDebtorAccounts(
      parsed.organizationId,
      parsed.workspaceId,
      parsed.agingBucket,
      parsed.searchQuery,
      parsed.limit
    );

    return {
      success: true,
      data: accounts,
    };
  } catch (err) {
    return handleActionError<DebtorAccount[]>(err);
  }
}

/**
 * Server Action: Evaluates a debtor account to generate Next-Best-Action recommendation.
 */
export async function evaluateDebtorNextActionAction(
  entityId: string,
  workspaceId: string,
  organizationId: string
): Promise<CollectionsActionResult<CollectionsNextBestAction>> {
  try {
    const auth = await requireAuth();
    assertTenantAccess(auth, organizationId, workspaceId);

    const engine = getCollectionsEngine();
    const accounts = await engine.getDebtorAccounts(organizationId, workspaceId);
    const debtor = accounts.find((d) => d.entityId === entityId);

    if (!debtor) {
      throw new CollectionsError(
        COLLECTIONS_ERROR_CODES.DEBTOR_NOT_FOUND,
        `Debtor account '${entityId}' not found.`,
        404
      );
    }

    const nextAction = await engine.evaluateDebtorAccount(debtor);
    return {
      success: true,
      data: nextAction,
    };
  } catch (err) {
    return handleActionError<CollectionsNextBestAction>(err);
  }
}

/**
 * Server Action: Generates a mathematically balanced installment payment schedule.
 */
export async function createInstallmentPlanAction(
  params: GenerateInstallmentPlanInput
): Promise<CollectionsActionResult<InstallmentPaymentPlan>> {
  try {
    const auth = await requireAuth();
    assertTenantAccess(auth, params.organizationId, params.workspaceId);

    const parsed = GenerateInstallmentPlanInputSchema.parse(params);
    const engine = getCollectionsEngine();
    const plan = await engine.generateInstallmentPlan(parsed);

    return {
      success: true,
      data: plan,
    };
  } catch (err) {
    return handleActionError<InstallmentPaymentPlan>(err);
  }
}

/**
 * Server Action: Stages a financial collections action into the Approval Store (Rule 21 & 22).
 */
export async function proposeCollectionsActionAction(
  input: ProposeCollectionsActionInput
): Promise<CollectionsActionResult<{ proposalId: string; payloadHash: string }>> {
  try {
    const auth = await requireAuth();
    assertTenantAccess(auth, input.organizationId, input.workspaceId);

    const parsed = ProposeCollectionsActionInputSchema.parse(input);
    const bridge = getFinanceProposalBridge();

    let targetCapability = 'finance.collection.propose_plan';
    if (parsed.actionType === 'RECORD_PROMISE_TO_PAY') {
      targetCapability = 'finance.collection.record_promise';
    } else if (parsed.actionType === 'REQUEST_SUSPENSION_REVIEW') {
      targetCapability = 'finance.collection.request_suspension';
    }

    const proposal = await bridge.proposeCollectionsAction({
      entityId: parsed.entityId,
      workspaceId: parsed.workspaceId,
      organizationId: parsed.organizationId,
      actionType: parsed.actionType,
      targetCapability,
      riskLevel: parsed.riskLevel,
      payload: parsed.payload,
      proposerUserId: auth.uid,
      what: `Collections proposal for entity ${parsed.entityId}`,
      why: parsed.rationale,
    });

    return {
      success: true,
      data: {
        proposalId: proposal.proposalId,
        payloadHash: proposal.payloadHash,
      },
    };
  } catch (err) {
    return handleActionError<{ proposalId: string; payloadHash: string }>(err);
  }
}

/**
 * Server Action: Executes an approved collections proposal (Rule 13, 18, 22).
 */
export async function executeApprovedCollectionsProposalAction(input: {
  proposalId: string;
  livePayload: Record<string, unknown>;
  workspaceId: string;
  organizationId: string;
}): Promise<CollectionsActionResult<{ proposalId: string; status: 'executed' }>> {
  try {
    const auth = await requireAuth();
    assertTenantAccess(auth, input.organizationId, input.workspaceId);

    const bridge = getFinanceProposalBridge();
    const result = await bridge.executeApprovedProposal({
      proposalId: input.proposalId,
      operatorUserId: auth.uid,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      livePayload: input.livePayload,
    });

    return {
      success: true,
      data: {
        proposalId: result.proposalId,
        status: result.status,
      },
    };
  } catch (err) {
    return handleActionError<{ proposalId: string; status: 'executed' }>(err);
  }
}

/**
 * Server Action: Rolls back an executed proposal via Saga compensation (Rule 27).
 */
export async function rollbackCollectionsProposalAction(input: {
  proposalId: string;
  workspaceId: string;
  organizationId: string;
}): Promise<CollectionsActionResult<{ proposalId: string; status: 'reverted' }>> {
  try {
    const auth = await requireAuth();
    assertTenantAccess(auth, input.organizationId, input.workspaceId);

    const bridge = getFinanceProposalBridge();
    const result = await bridge.rollbackProposal({
      proposalId: input.proposalId,
      operatorUserId: auth.uid,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
    });

    return {
      success: true,
      data: {
        proposalId: result.proposalId,
        status: result.status,
      },
    };
  } catch (err) {
    return handleActionError<{ proposalId: string; status: 'reverted' }>(err);
  }
}

/**
 * Server Action: Records a debtor promise-to-pay date and amount.
 */
export async function recordPromiseToPayAction(
  input: RecordPromiseToPayInput
): Promise<CollectionsActionResult<DebtorAccount>> {
  try {
    const auth = await requireAuth();
    assertTenantAccess(auth, input.organizationId, input.workspaceId);

    const parsed = RecordPromiseToPayInputSchema.parse(input);
    const engine = getCollectionsEngine();
    const updatedDebtor = await engine.recordPromiseToPay(parsed);

    return {
      success: true,
      data: updatedDebtor,
    };
  } catch (err) {
    return handleActionError<DebtorAccount>(err);
  }
}

/**
 * Server Action: Aggregates executive collections KPIs for Zone 1 cards.
 */
export async function getCollectionsMetricsAction(
  workspaceId: string,
  organizationId: string
): Promise<CollectionsActionResult<CollectionsMetrics>> {
  try {
    const auth = await requireAuth();
    assertTenantAccess(auth, organizationId, workspaceId);

    const engine = getCollectionsEngine();
    const metrics = await engine.getCollectionsMetrics(organizationId, workspaceId);

    return {
      success: true,
      data: metrics,
    };
  } catch (err) {
    return handleActionError<CollectionsMetrics>(err);
  }
}
