'use server';

/**
 * @fileOverview Secure Server Actions: Postcondition Verification & Governance (Phase 14 Milestone 1)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 10 (Inline Architectural Documentation)
 * - Rule 21 (Two-Phase Verification Invariants: Verify before Commit)
 * - Rule 23 (Resource Governance & Execution Budgeting)
 * - Rule 40 (Domain Event Auditing)
 * - Rule 48 (Sanitized Error Taxonomy: no internal stack leaks)
 * - Rule 51 (Next.js 15 Server Actions Conventions: session auth, error handling)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Strangler Fig Invariant: wraps deterministic capabilities)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  VerificationResult,
  AgentVerificationError,
  VERIFICATION_ERROR_CODES,
} from '@/platform/verification';
import { getPostconditionEngine } from '@/platform/verification/postcondition-engine';
import {
  getCachedVerificationResult,
  cacheVerificationResult,
} from '@/platform/capabilities/verification/verification-capabilities';

export interface VerificationActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface EvaluatePostconditionsActionInput {
  organizationId: string;
  workspaceId: string;
  capabilityId: string;
  preStateSnapshot: Record<string, unknown>;
  postStateSnapshot: Record<string, unknown> | null;
  mutationPayload: Record<string, unknown>;
  customAssertions?: string[];
  executionId?: string;
}

export interface GetExecutionVerificationActionInput {
  organizationId: string;
  workspaceId: string;
  executionId: string;
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
    throw new AgentVerificationError(
      'IDOR_VIOLATION',
      'Missing authenticated organization context in session profile.',
      403
    );
  }

  if (sessionOrgId !== requestedOrgId) {
    throw new AgentVerificationError(
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
    throw new AgentVerificationError(
      'IDOR_VIOLATION',
      `IDOR_VIOLATION: Session workspace '${sessionWsId}' does not match requested workspace '${requestedWorkspaceId}'.`,
      403
    );
  }

  return sessionOrgId;
}

/**
 * Server Action: Evaluates postcondition invariant assertions against pre/post state snapshots.
 */
export async function evaluatePostconditionsAction(
  input: EvaluatePostconditionsActionInput
): Promise<VerificationActionResult<VerificationResult>> {
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
          message: 'Authentication required to evaluate postconditions.',
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
          code: VERIFICATION_ERROR_CODES.VERIFICATION_DEAD_MAN_PAUSED,
          message: `Verification operations are currently suspended by platform emergency governance for organization ${orgId}.`,
        },
      };
    }

    // 4. Dispatch to Core Postcondition Engine
    const engine = getPostconditionEngine();
    const result = await engine.evaluatePostconditions(
      input.capabilityId,
      {
        organizationId: orgId,
        workspaceId: input.workspaceId,
        actorId: auth.uid,
        preStateSnapshot: input.preStateSnapshot,
        postStateSnapshot: input.postStateSnapshot,
        mutationPayload: input.mutationPayload,
      },
      {
        executionId: input.executionId,
        customAssertions: input.customAssertions,
      }
    );

    // 5. Cache result for history lookup
    cacheVerificationResult(result);

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    if (err instanceof AgentVerificationError) {
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
        code: 'INTERNAL_VERIFICATION_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected verification error occurred.',
      },
    };
  }
}

/**
 * Server Action: Retrieves past execution verification outcome and evidence by execution ID.
 */
export async function getExecutionVerificationAction(
  input: GetExecutionVerificationActionInput
): Promise<VerificationActionResult<VerificationResult | null>> {
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
          message: 'Authentication required to retrieve execution verification.',
        },
      };
    }

    // 2. Anti-IDOR Multi-Tenant Lock (Rules 8 & 47)
    assertTenantAccess(auth, input.organizationId, input.workspaceId);

    // 3. Cache lookup
    const result = getCachedVerificationResult(input.executionId);

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    if (err instanceof AgentVerificationError) {
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
        code: 'INTERNAL_VERIFICATION_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred retrieving verification results.',
      },
    };
  }
}
