'use server';

/**
 * @fileOverview Secure Server Actions: Finance & Operations AI Agents (Phase 12 Milestone 1)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 40 (Domain Event Publishing)
 * - Rule 51 (Next.js 15 Server Actions Conventions: session auth, error handling)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Strangler Fig Invariant: wraps deterministic capabilities)
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import { getAccountFinanceAssembler } from '@/platform/agents/finance/context/account-finance-assembler';
import {
  financeInvoiceCreateDraftCapability,
  financeInvoiceValidateCapability,
  financePaymentSearchCapability,
} from '@/platform/capabilities/finance/finance-capabilities';
import type { CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';
import {
  type AccountFinance360Context,
  type ReceivablesAging,
  type AssembleAccountFinanceContextInput,
  type CreateInvoiceDraftInput,
  type ValidateInvoiceInput,
  type ValidateInvoiceOutput,
  type SearchPaymentsInput,
  type PaymentSummary,
  FinanceError,
  FINANCE_ERROR_CODES,
  AssembleAccountFinanceContextInputSchema,
  CreateInvoiceDraftInputSchema,
  ValidateInvoiceInputSchema,
  SearchPaymentsInputSchema,
} from '@/platform/agents/finance/context/finance-context-types';
import type { CreateInvoiceDraftOutput } from '@/platform/capabilities/finance/finance-capabilities';

export interface FinanceActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

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
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDOR_VIOLATION,
      403,
      'Missing authenticated organization context.'
    );
  }

  if (sessionOrgId !== requestedOrgId) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDOR_VIOLATION,
      403,
      `IDOR_VIOLATION: Session organization '${sessionOrgId}' does not match requested organization '${requestedOrgId}'.`
    );
  }

  const sessionWsId = auth.profile?.lastActiveWorkspaceId;
  if (
    !auth.isSystemAdmin &&
    sessionWsId &&
    requestedWorkspaceId &&
    sessionWsId !== requestedWorkspaceId
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDOR_VIOLATION,
      403,
      `IDOR_VIOLATION: Session workspace '${sessionWsId}' does not match requested workspace '${requestedWorkspaceId}'.`
    );
  }

  return sessionOrgId;
}

/**
 * Sanitizes errors and returns standard FinanceActionResult (Rule 48).
 */
function handleActionError<T>(err: unknown): FinanceActionResult<T> {
  if (err instanceof FinanceError) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };
  }

  if (
    err instanceof AgentGovernanceEmergencyPausedError ||
    (err instanceof Error &&
      (err.name === 'AgentGovernanceEmergencyPausedError' ||
        err.message.includes('FINANCE_DEAD_MAN_PAUSED')))
  ) {
    return {
      success: false,
      error: {
        code: FINANCE_ERROR_CODES.FINANCE_DEAD_MAN_PAUSED,
        message: err instanceof Error ? err.message : 'Finance governance paused.',
      },
    };
  }

  const message =
    err instanceof Error ? err.message : 'An unexpected finance error occurred.';
  return {
    success: false,
    error: {
      code: FINANCE_ERROR_CODES.INTERNAL_FINANCE_ERROR,
      message,
    },
  };
}

/**
 * Assembles 360° financial context with knapsack budgeting and XML containment.
 */
export async function getAccountFinanceContextAction(
  rawInput: AssembleAccountFinanceContextInput
): Promise<FinanceActionResult<AccountFinance360Context>> {
  try {
    const auth = await requireAuth();
    const input = AssembleAccountFinanceContextInputSchema.parse(rawInput);
    assertTenantAccess(auth, input.organizationId, input.workspaceId);
    await checkGovernanceDeadManSwitch(input.organizationId);

    const assembler = getAccountFinanceAssembler();
    const context = await assembler.assembleContext(input);

    return {
      success: true,
      data: context,
    };
  } catch (err) {
    return handleActionError<AccountFinance360Context>(err);
  }
}

/**
 * Computes receivables aging report for an entity.
 */
export async function getReceivablesAgingAction(params: {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  asOfDate?: string;
}): Promise<FinanceActionResult<ReceivablesAging>> {
  try {
    const auth = await requireAuth();
    assertTenantAccess(auth, params.organizationId, params.workspaceId);
    await checkGovernanceDeadManSwitch(params.organizationId);

    const assembler = getAccountFinanceAssembler();
    const ctx = await assembler.assembleContext({
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      entityId: params.entityId,
      referenceDate: params.asOfDate,
    });

    return {
      success: true,
      data: ctx.aging,
    };
  } catch (err) {
    return handleActionError<ReceivablesAging>(err);
  }
}

/**
 * Creates an unissued draft invoice with deterministic math.
 */
export async function createInvoiceDraftAction(
  rawInput: CreateInvoiceDraftInput
): Promise<FinanceActionResult<CreateInvoiceDraftOutput>> {
  try {
    const auth = await requireAuth();
    const input = CreateInvoiceDraftInputSchema.parse(rawInput);
    assertTenantAccess(auth, input.organizationId, input.workspaceId);
    await checkGovernanceDeadManSwitch(input.organizationId);

    const execContext: CapabilityExecutionContext = {
      principal: {
        actorType: 'user',
        userId: auth.uid,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        grantedScopes: [
          'rbac:finance.invoices.create',
          'rbac:finance.invoices.view',
        ],
        effectiveRole: auth.profile?.role || 'admin',
      },
      correlationId: `corr_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    const result = await financeInvoiceCreateDraftCapability.handler(
      input,
      execContext
    );

    if (!result.success) {
      return {
        success: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (err) {
    return handleActionError<CreateInvoiceDraftOutput>(err);
  }
}

/**
 * Validates invoice line items and calculation consistency.
 */
export async function validateInvoiceAction(
  rawInput: ValidateInvoiceInput
): Promise<FinanceActionResult<ValidateInvoiceOutput>> {
  try {
    const auth = await requireAuth();
    const orgId = auth.profile?.organizationId || 'org_default';
    await checkGovernanceDeadManSwitch(orgId);

    const input = ValidateInvoiceInputSchema.parse(rawInput);
    const execContext: CapabilityExecutionContext = {
      principal: {
        actorType: 'user',
        userId: auth.uid,
        organizationId: orgId,
        workspaceId: auth.profile?.lastActiveWorkspaceId || 'ws_default',
        grantedScopes: ['rbac:finance.invoices.view'],
        effectiveRole: auth.profile?.role || 'admin',
      },
      correlationId: `corr_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    const result = await financeInvoiceValidateCapability.handler(
      input,
      execContext
    );

    if (!result.success) {
      return {
        success: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (err) {
    return handleActionError<ValidateInvoiceOutput>(err);
  }
}

/**
 * Searches recorded payments by reference or debtor.
 */
export async function searchPaymentsAction(
  rawInput: SearchPaymentsInput
): Promise<
  FinanceActionResult<{ payments: PaymentSummary[]; totalFound: number }>
> {
  try {
    const auth = await requireAuth();
    const input = SearchPaymentsInputSchema.parse(rawInput);
    assertTenantAccess(auth, input.organizationId, input.workspaceId);
    await checkGovernanceDeadManSwitch(input.organizationId);

    const execContext: CapabilityExecutionContext = {
      principal: {
        actorType: 'user',
        userId: auth.uid,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        grantedScopes: ['rbac:finance.invoices.view'],
        effectiveRole: auth.profile?.role || 'admin',
      },
      correlationId: `corr_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    const result = await financePaymentSearchCapability.handler(
      input,
      execContext
    );

    if (!result.success) {
      return {
        success: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (err) {
    return handleActionError<{ payments: PaymentSummary[]; totalFound: number }>(
      err
    );
  }
}
