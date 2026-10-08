'use server';

/**
 * @fileOverview Secure Next.js 15 Server Actions: Agent Health & Discrepancy Core (Phase 14 Milestone 4)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 10 (Inline Architectural Documentation)
 * - Rule 12 (Risk Vocabulary: L2_STATE_MUTATION for reset, L0_READ for telemetry)
 * - Rule 17 (Non-Delegable Restrictions)
 * - Rule 19 (Deterministic Idempotency)
 * - Rule 24 (Dynamic Circuit Breakers)
 * - Rule 40 (Domain Event Auditing)
 * - Rule 48 (Sanitized Error Taxonomy)
 * - Rule 51 (Next.js 15 Server Actions Conventions: session auth, error handling)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 61 (Mandatory Justification for Operator Actions >= 5 chars)
 * - Rule 69 (Strangler Fig Invariant)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  type AgentHealthScorecard,
  type DiscrepancyReport,
  AgentHealthError,
  HEALTH_ERROR_CODES,
  GetHealthScorecardInputSchema,
  ListHealthScorecardsInputSchema,
  ResetCircuitBreakerInputSchema,
  EvaluateDiscrepancyInputSchema,
  type GetHealthScorecardInput,
  type ListHealthScorecardsInput,
  type ResetCircuitBreakerInput,
  type EvaluateDiscrepancyInput,
} from '@/platform/verification/health';
import { getAgentHealthService } from '@/platform/verification/health/agent-health-service';
import { getDiscrepancyService } from '@/platform/verification/health/discrepancy-service';

// ============================================================================
// ACTION RESULT CONTRACT
// ============================================================================

export interface HealthActionResult<T> {
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
    throw new AgentHealthError(
      HEALTH_ERROR_CODES.IDOR_VIOLATION,
      'Missing authenticated organization context in session profile.'
    );
  }

  if (sessionOrgId !== requestedOrgId) {
    throw new AgentHealthError(
      HEALTH_ERROR_CODES.IDOR_VIOLATION,
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
    throw new AgentHealthError(
      HEALTH_ERROR_CODES.IDOR_VIOLATION,
      `IDOR_VIOLATION: Session workspace '${sessionWsId}' does not match requested workspace '${requestedWorkspaceId}'.`
    );
  }

  return sessionOrgId;
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Retrieves the real-time health scorecard for a specific agent persona.
 */
export async function getAgentHealthScorecardAction(
  input: GetHealthScorecardInput
): Promise<HealthActionResult<AgentHealthScorecard>> {
  try {
    const auth = await requireAuth();
    const parsed = GetHealthScorecardInputSchema.parse(input);
    assertTenantAccess(auth, parsed.organizationId, parsed.workspaceId);

    try {
      await checkGovernanceDeadManSwitch(parsed.organizationId);
    } catch {
      return {
        success: false,
        error: {
          code: HEALTH_ERROR_CODES.HEALTH_DEAD_MAN_PAUSED,
          message: 'Platform emergency dead-man pause is currently engaged.',
        },
      };
    }

    const service = getAgentHealthService();
    const scorecard = await service.getScorecard(parsed);

    return {
      success: true,
      data: scorecard,
    };
  } catch (err) {
    const code = err instanceof AgentHealthError ? err.code : 'UNKNOWN_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: { code, message },
    };
  }
}

/**
 * Lists health scorecards for all registered agent personas within a workspace.
 */
export async function listAgentHealthScorecardsAction(
  input: ListHealthScorecardsInput
): Promise<HealthActionResult<AgentHealthScorecard[]>> {
  try {
    const auth = await requireAuth();
    const parsed = ListHealthScorecardsInputSchema.parse(input);
    assertTenantAccess(auth, parsed.organizationId, parsed.workspaceId);

    try {
      await checkGovernanceDeadManSwitch(parsed.organizationId);
    } catch {
      return {
        success: false,
        error: {
          code: HEALTH_ERROR_CODES.HEALTH_DEAD_MAN_PAUSED,
          message: 'Platform emergency dead-man pause is currently engaged.',
        },
      };
    }

    const service = getAgentHealthService();
    const scorecards = await service.listScorecards(parsed);

    return {
      success: true,
      data: scorecards,
    };
  } catch (err) {
    const code = err instanceof AgentHealthError ? err.code : 'UNKNOWN_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: { code, message },
    };
  }
}

/**
 * Manually resets a tripped agent circuit breaker with mandatory operator justification (Rules 17 & 61).
 */
export async function resetAgentCircuitBreakerAction(
  input: ResetCircuitBreakerInput
): Promise<HealthActionResult<AgentHealthScorecard>> {
  try {
    const auth = await requireAuth();

    // Rule 61: Audit justification must be at least 5 characters
    if (!input.justification || input.justification.trim().length < 5) {
      return {
        success: false,
        error: {
          code: HEALTH_ERROR_CODES.HEALTH_INVALID_JUSTIFICATION,
          message: 'Audit justification must be at least 5 characters (Rule 61).',
        },
      };
    }

    const parsed = ResetCircuitBreakerInputSchema.parse(input);
    assertTenantAccess(auth, parsed.organizationId, parsed.workspaceId);

    try {
      await checkGovernanceDeadManSwitch(parsed.organizationId);
    } catch {
      return {
        success: false,
        error: {
          code: HEALTH_ERROR_CODES.HEALTH_DEAD_MAN_PAUSED,
          message: 'Platform emergency dead-man pause is currently engaged.',
        },
      };
    }

    const service = getAgentHealthService();
    const scorecard = await service.resetCircuitBreaker({
      ...parsed,
      actor: {
        type: 'user',
        id: auth.uid,
      },
    });

    return {
      success: true,
      data: scorecard,
    };
  } catch (err) {
    const code = err instanceof AgentHealthError ? err.code : 'UNKNOWN_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: { code, message },
    };
  }
}

/**
 * Evaluates side-effect discrepancies and triggers bounded autonomous self-healing.
 */
export async function evaluateDiscrepancyAction(
  input: EvaluateDiscrepancyInput
): Promise<HealthActionResult<DiscrepancyReport>> {
  try {
    const auth = await requireAuth();
    const parsed = EvaluateDiscrepancyInputSchema.parse(input);
    assertTenantAccess(auth, parsed.organizationId, parsed.workspaceId);

    try {
      await checkGovernanceDeadManSwitch(parsed.organizationId);
    } catch {
      return {
        success: false,
        error: {
          code: HEALTH_ERROR_CODES.HEALTH_DEAD_MAN_PAUSED,
          message: 'Platform emergency dead-man pause is currently engaged.',
        },
      };
    }

    const service = getDiscrepancyService();
    const report = await service.evaluateDiscrepancy(parsed);

    return {
      success: true,
      data: report,
    };
  } catch (err) {
    const code = err instanceof AgentHealthError ? err.code : 'UNKNOWN_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: { code, message },
    };
  }
}
