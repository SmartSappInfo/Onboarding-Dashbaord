'use server';

/**
 * @fileOverview Secure Next.js 15 Server Actions: State-Version Validation & Optimistic Concurrency (Phase 14 Milestone 2)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 10 (Inline Architectural Documentation)
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard: Verify before Commit)
 * - Rule 22 (Cryptographic Hash Binding)
 * - Rule 23 (Resource Governance & Timeout Ceilings)
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
  type ResourceSnapshot,
  type VersionValidationResult,
  StateConcurrencyError,
  CONCURRENCY_ERROR_CODES,
  getStateVersionService,
} from '@/platform/verification/concurrency';

// ============================================================================
// ACTION RESULT & INPUT CONTRACTS
// ============================================================================

export interface ConcurrencyActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface CaptureSnapshotActionInput {
  resourceType: string;
  resourceId: string;
  resourceData: Record<string, unknown>;
  organizationId: string;
  workspaceId: string;
}

export interface VerifyVersionActionInput {
  expectedSnapshot: ResourceSnapshot;
  currentResourceData: Record<string, unknown> | null;
  organizationId: string;
  workspaceId: string;
  assertCurrent?: boolean;
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
    throw new StateConcurrencyError(
      'IDOR_VIOLATION',
      'Missing authenticated organization context in session profile.',
      403
    );
  }

  if (sessionOrgId !== requestedOrgId) {
    throw new StateConcurrencyError(
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
    throw new StateConcurrencyError(
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
 * Server Action: Captures an immutable pre-mutation resource snapshot (Step 2 of Responsible Execution Loop).
 */
export async function captureResourceSnapshotAction(
  input: CaptureSnapshotActionInput
): Promise<ConcurrencyActionResult<ResourceSnapshot>> {
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
          message: 'Authentication required to capture resource snapshots.',
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
          code: CONCURRENCY_ERROR_CODES.CONCURRENCY_DEAD_MAN_PAUSED,
          message: `Concurrency operations are currently suspended by platform emergency governance for organization ${orgId}.`,
        },
      };
    }

    // 4. Capture Resource Snapshot
    const service = getStateVersionService();
    const snapshot = await service.captureSnapshot({
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceData: input.resourceData,
      organizationId: orgId,
      workspaceId: input.workspaceId,
      actorId: auth.uid,
    });

    return {
      success: true,
      data: snapshot,
    };
  } catch (err: unknown) {
    if (err instanceof StateConcurrencyError) {
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
        code: 'INTERNAL_CONCURRENCY_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected concurrency error occurred.',
      },
    };
  }
}

/**
 * Server Action: Validates live database state against pre-mutation snapshot to prevent TOCTOU race conditions (Step 5).
 */
export async function verifyResourceVersionAction(
  input: VerifyVersionActionInput
): Promise<ConcurrencyActionResult<VersionValidationResult>> {
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
          message: 'Authentication required to verify resource versions.',
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
          code: CONCURRENCY_ERROR_CODES.CONCURRENCY_DEAD_MAN_PAUSED,
          message: `Concurrency operations are currently suspended by platform emergency governance for organization ${orgId}.`,
        },
      };
    }

    // 4. Verify Resource Version
    const service = getStateVersionService();
    const validationParams = {
      expectedSnapshot: input.expectedSnapshot,
      currentResourceData: input.currentResourceData,
      organizationId: orgId,
      workspaceId: input.workspaceId,
      actorId: auth.uid,
    };

    let result: VersionValidationResult;
    if (input.assertCurrent) {
      result = await service.assertVersionCurrent(validationParams);
    } else {
      result = await service.validateResourceVersion(validationParams);
    }

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    if (err instanceof StateConcurrencyError) {
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
        code: 'INTERNAL_CONCURRENCY_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected concurrency error occurred.',
      },
    };
  }
}

/**
 * Server Action: Validates that a resource version has not drifted (assertCurrent: false).
 */
export async function validateResourceVersionAction(
  input: Omit<VerifyVersionActionInput, 'assertCurrent'>
): Promise<ConcurrencyActionResult<VersionValidationResult>> {
  return verifyResourceVersionAction({ ...input, assertCurrent: false });
}

/**
 * Server Action: Asserts that a resource version is current, throwing if stale (assertCurrent: true).
 */
export async function assertResourceVersionCurrentAction(
  input: Omit<VerifyVersionActionInput, 'assertCurrent'>
): Promise<ConcurrencyActionResult<VersionValidationResult>> {
  return verifyResourceVersionAction({ ...input, assertCurrent: true });
}

