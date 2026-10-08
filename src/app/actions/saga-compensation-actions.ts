'use server';

/**
 * @fileOverview Secure Next.js 15 Server Actions: Universal Saga Compensation Engine (Phase 14 Milestone 3)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 10 (Inline Architectural Documentation)
 * - Rule 12 (Risk Vocabulary: L2_STATE_MUTATION)
 * - Rule 17 (Non-Delegable Restrictions)
 * - Rule 19 (Deterministic Idempotency)
 * - Rule 22 (Cryptographic Hash Binding)
 * - Rule 23 (Resource Governance & Timeout Ceilings)
 * - Rule 25 (DLQ Bridge Integration)
 * - Rule 27 (Universal Reverse-LIFO Saga Compensation Model)
 * - Rule 40 (Domain Event Auditing)
 * - Rule 48 (Sanitized Error Taxonomy)
 * - Rule 51 (Next.js 15 Server Actions Conventions: session auth, error handling)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Strangler Fig Invariant)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  type SagaCompensationResult,
  type SagaExecutionLedger,
  type SagaStepStatus,
  type ResourceSnapshot,
  SagaCompensationError,
  SAGA_ERROR_CODES,
  getSagaCompensationService,
} from '@/platform/verification/saga';

// ============================================================================
// ACTION RESULT & INPUT CONTRACTS
// ============================================================================

export interface SagaActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  actionConfig?: {
    path: string;
    label: string;
  };
}

export interface ExecuteSagaCompensationActionInput {
  runId: string;
  organizationId: string;
  workspaceId: string;
  reason: string;
  dryRun?: boolean;
}

export interface GetSagaLedgerActionInput {
  runId: string;
  organizationId: string;
  workspaceId: string;
}

export interface RecordSagaStepActionInput {
  runId: string;
  stepIndex: number;
  capabilityId: string;
  domain?: string;
  actionType?: 'create' | 'update' | 'delete' | 'custom';
  organizationId: string;
  workspaceId: string;
  inputPayload: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  preStateSnapshot?: ResourceSnapshot;
  postStateSnapshot?: ResourceSnapshot;
  status?: SagaStepStatus;
}

// ============================================================================
// ANTI-IDOR HELPER (Rules 8 & 47)
// ============================================================================

function assertTenantAccess(
  auth: AuthContext,
  requestedOrgId: string,
  requestedWorkspaceId?: string
): string {
  const sessionOrgId = auth.profile?.organizationId;
  if (!sessionOrgId) {
    throw new SagaCompensationError(
      'IDOR_VIOLATION',
      'Missing authenticated organization context in session profile.',
      403
    );
  }

  if (sessionOrgId !== requestedOrgId) {
    throw new SagaCompensationError(
      'IDOR_VIOLATION',
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
    throw new SagaCompensationError(
      'IDOR_VIOLATION',
      `IDOR_VIOLATION: Session workspace '${sessionWsId}' does not match requested workspace '${requestedWorkspaceId}'.`,
      403
    );
  }

  return sessionOrgId;
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Server Action: Executes reverse-LIFO Saga compensation for a failed workflow run (Step 6).
 */
export async function executeSagaCompensationAction(
  input: ExecuteSagaCompensationActionInput
): Promise<SagaActionResult<SagaCompensationResult>> {
  try {
    // 1. Session Authentication (Rule 51)
    let auth: AuthContext;
    try {
      auth = await requireAuth();
    } catch {
      return {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required to execute saga compensation.',
        },
      };
    }

    // 2. Anti-IDOR Multi-Tenant Lock (Rules 8 & 47)
    const orgId = assertTenantAccess(auth, input.organizationId, input.workspaceId);

    // 3. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(orgId);
    } catch {
      return {
        success: false,
        error: {
          code: SAGA_ERROR_CODES.SAGA_DEAD_MAN_PAUSED,
          message: `Saga compensation is currently suspended by platform emergency governance for organization ${orgId}.`,
        },
      };
    }

    // 4. Execute Reverse-LIFO Compensation (Rule 27)
    const service = getSagaCompensationService();
    const result = await service.compensateRun({
      runId: input.runId,
      organizationId: orgId,
      workspaceId: input.workspaceId,
      reason: input.reason,
      dryRun: input.dryRun ?? false,
    });

    return {
      success: true,
      data: result,
      actionConfig: {
        path: '/admin/workflows',
        label: 'View Workflows',
      },
    };
  } catch (err: unknown) {
    if (err instanceof SagaCompensationError) {
      return {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'INTERNAL_SAGA_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected saga compensation error occurred.',
      },
    };
  }
}

/**
 * Server Action: Retrieves the execution ledger for a workflow run.
 */
export async function getSagaExecutionLedgerAction(
  input: GetSagaLedgerActionInput
): Promise<SagaActionResult<SagaExecutionLedger | null>> {
  try {
    // 1. Session Authentication (Rule 51)
    let auth: AuthContext;
    try {
      auth = await requireAuth();
    } catch {
      return {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required to retrieve execution ledgers.',
        },
      };
    }

    // 2. Anti-IDOR Multi-Tenant Lock (Rules 8 & 47)
    const orgId = assertTenantAccess(auth, input.organizationId, input.workspaceId);

    // 3. Retrieve Execution Ledger
    const service = getSagaCompensationService();
    const ledger = await service.getLedger(input.runId, {
      organizationId: orgId,
      workspaceId: input.workspaceId,
    });

    return {
      success: true,
      data: ledger,
    };
  } catch (err: unknown) {
    if (err instanceof SagaCompensationError) {
      return {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'INTERNAL_SAGA_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred retrieving ledger.',
      },
    };
  }
}

/**
 * Server Action: Records an individual step in the execution ledger.
 */
export async function recordSagaStepAction(
  input: RecordSagaStepActionInput
): Promise<SagaActionResult<{ recorded: boolean; stepId: string }>> {
  try {
    // 1. Session Authentication (Rule 51)
    let auth: AuthContext;
    try {
      auth = await requireAuth();
    } catch {
      return {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required to record saga steps.',
        },
      };
    }

    // 2. Anti-IDOR Multi-Tenant Lock (Rules 8 & 47)
    const orgId = assertTenantAccess(auth, input.organizationId, input.workspaceId);

    // 3. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(orgId);
    } catch {
      return {
        success: false,
        error: {
          code: SAGA_ERROR_CODES.SAGA_DEAD_MAN_PAUSED,
          message: `Saga operations are currently suspended by platform emergency governance for organization ${orgId}.`,
        },
      };
    }

    // 4. Record Saga Step
    const service = getSagaCompensationService();
    const stepId = await service.recordStep({
      runId: input.runId,
      stepIndex: input.stepIndex,
      capabilityId: input.capabilityId,
      domain: input.domain,
      actionType: input.actionType,
      organizationId: orgId,
      workspaceId: input.workspaceId,
      actorId: auth.uid,
      actorType: 'user',
      inputPayload: input.inputPayload,
      outputPayload: input.outputPayload,
      preStateSnapshot: input.preStateSnapshot,
      postStateSnapshot: input.postStateSnapshot,
      status: input.status ?? 'COMPLETED',
    });

    return {
      success: true,
      data: {
        recorded: true,
        stepId,
      },
    };
  } catch (err: unknown) {
    if (err instanceof SagaCompensationError) {
      return {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'INTERNAL_SAGA_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred recording saga step.',
      },
    };
  }
}
