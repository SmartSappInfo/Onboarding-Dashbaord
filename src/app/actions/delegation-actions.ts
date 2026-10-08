'use server';

/**
 * @fileOverview Next.js 15 Server Actions for Delegated Agent Identity & Authority Engine (Phase 13 Milestone 1)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Validation)
 * - Rule 16 (Authority Intersection Algebra & Agent Identity)
 * - Rule 17 (Non-Delegable Privileges Firewall)
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard)
 * - Rule 22 (Cryptographic Signature Verification)
 * - Rule 23 (Resource Ceilings: Depth <= 3)
 * - Rule 48 (Structured Error Codes & HTTP Mapping)
 * - Rule 51 (Next.js 15 Server Actions with Clerk session auth)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 61 (Audit Trail: >= 5 char justification)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z, ZodError } from 'zod';
import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import {
  AgentDelegationError,
  AuthorityIntersectionResult,
  DelegationToken,
  DelegationValidationResult,
  IssueDelegationTokenInput,
  IssueDelegationTokenInputSchema,
  RevokeDelegationTokenInput,
  RevokeDelegationTokenInputSchema,
  ValidateDelegationTokenInput,
  ValidateDelegationTokenInputSchema,
} from '@/platform/identity/delegation/delegation-types';
import {
  getDelegatedAuthorityService,
  type ComputeAuthorityParams,
} from '@/platform/identity/delegation/delegated-authority-service';

export interface DelegationActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Enforces Anti-IDOR tenant boundary validation (Rules 8 & 47).
 */
function assertTenantContext(auth: AuthContext, requestedOrgId: string): void {
  const sessionOrgId = auth.profile?.organizationId;
  if (!auth.isSystemAdmin && sessionOrgId !== requestedOrgId) {
    throw new AgentDelegationError(
      'TENANT_MISMATCH',
      `Anti-IDOR Violation: Authenticated principal from tenant '${sessionOrgId}' cannot access tenant '${requestedOrgId}' (Rules 8 & 47).`,
      403
    );
  }
}

/**
 * Server Action: Issue a cryptographically signed Delegation Token (Rule 16 & 22).
 */
export async function issueDelegationTokenAction(
  input: IssueDelegationTokenInput
): Promise<DelegationActionResult<DelegationToken>> {
  try {
    const auth = await requireAuth();
    assertTenantContext(auth, input.organizationId);

    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        return {
          success: false,
          error: `Delegation engine is emergency paused for organization '${input.organizationId}' (Rule 60).`,
          code: 'DELEGATION_DEAD_MAN_PAUSED',
        };
      }
      throw err;
    }

    const parsedInput = IssueDelegationTokenInputSchema.parse(input);
    const service = getDelegatedAuthorityService();
    const token = await service.issueDelegationToken({
      ...parsedInput,
      userId: auth.uid, // Root caller bound to authenticated session (Rule 16)
    });

    return {
      success: true,
      data: token,
    };
  } catch (error) {
    if (error instanceof AgentDelegationError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    if (error instanceof ZodError || (error as { name?: string })?.name === 'ZodError') {
      const zodErr = error as ZodError;
      return {
        success: false,
        error: zodErr.errors?.map((e) => e.message).join('; ') || 'Invalid input parameters',
        code: 'INVALID_INPUT',
      };
    }
    if (error instanceof AgentGovernanceEmergencyPausedError) {
      return {
        success: false,
        error: error.message,
        code: 'DELEGATION_DEAD_MAN_PAUSED',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown delegation error occurred',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Server Action: Validate a Delegation Token against cryptographic signature and tenant bounds (Rules 8, 18, 22).
 */
export async function validateDelegationTokenAction(
  input: ValidateDelegationTokenInput
): Promise<DelegationActionResult<DelegationValidationResult>> {
  try {
    const auth = await requireAuth();
    assertTenantContext(auth, input.targetContext.organizationId);

    const parsedInput = ValidateDelegationTokenInputSchema.parse(input);
    const service = getDelegatedAuthorityService();
    const result = await service.validateDelegationToken(
      parsedInput.token,
      parsedInput.targetContext
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof AgentDelegationError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    if (error instanceof ZodError || (error as { name?: string })?.name === 'ZodError') {
      const zodErr = error as ZodError;
      return {
        success: false,
        error: zodErr.errors?.map((e) => e.message).join('; ') || 'Invalid input parameters',
        code: 'INVALID_INPUT',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error occurred',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Server Action: Atomically revoke a delegation token and cascade to children (Rules 8, 27, 61).
 */
export async function revokeDelegationTokenAction(
  input: RevokeDelegationTokenInput
): Promise<DelegationActionResult<{ revokedCount: number }>> {
  try {
    const auth = await requireAuth();

    const parsedInput = RevokeDelegationTokenInputSchema.parse(input);
    const service = getDelegatedAuthorityService();
    const result = await service.revokeDelegationToken(
      parsedInput.tokenId,
      parsedInput.revokerId || auth.uid,
      parsedInput.reason
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof AgentDelegationError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    if (error instanceof ZodError || (error as { name?: string })?.name === 'ZodError') {
      const zodErr = error as ZodError;
      return {
        success: false,
        error: zodErr.errors?.map((e) => e.message).join('; ') || 'Invalid input parameters',
        code: 'INVALID_INPUT',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown revocation error occurred',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Server Action: Pure mathematical calculation of Authority Intersection (Rule 16 & 17).
 */
export async function computeEffectiveAuthorityAction(
  params: ComputeAuthorityParams
): Promise<DelegationActionResult<AuthorityIntersectionResult>> {
  try {
    await requireAuth();

    const service = getDelegatedAuthorityService();
    const result = service.computeEffectiveAuthority(params);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof AgentDelegationError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown authority computation error',
      code: 'INTERNAL_ERROR',
    };
  }
}
