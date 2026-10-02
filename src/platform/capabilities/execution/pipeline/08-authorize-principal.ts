/**
 * @fileOverview Pipeline Step 8: Authorize Principal (Phase 1 / PR-4)
 *
 * Implements Rule 12 (Server-Side Risk Classification), Rule 16 (Authority Intersection),
 * Rule 17 (Non-Delegable Privileges), Rule 18 (TOCTOU Authority Re-check), and PRD §73.
 *
 * Evaluates caller's live authority against required capability permissions and risk levels.
 * Non-delegable administrative privileges are refused for automated agents.
 *
 * NON-NEGOTIABLE INVARIANT (PR-2 / PR-4 Approval Burn Prevention):
 * Base RBAC, tenant standing, and non-delegable checks MUST pass BEFORE Step 9 (Verify Approval)
 * is reached, so an unauthorized invocation can never burn a valid single-use human approval.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AgentPrincipal, AnyCapabilityDefinition } from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';
import { evaluatePrincipalAuthority, type PolicyEvaluationResult } from '../../policy/principal-evaluator';

export interface AuthorizePrincipalOptions {
  nowMs?: number;
  verifyActorStanding?: (principal: AgentPrincipal) => Promise<{ active: boolean; reason?: string }>;
}

export async function step08AuthorizePrincipal(
  principal: AgentPrincipal,
  capability: AnyCapabilityDefinition,
  options?: AuthorizePrincipalOptions
): Promise<PolicyEvaluationResult> {
  const nowMs = options?.nowMs ?? Date.now();
  const target = {
    organizationId: principal.organizationId,
    workspaceId: principal.workspaceId,
  };

  // Evaluate base authority without approval (burn prevention)
  const evaluation = evaluatePrincipalAuthority(principal, capability, target, { nowMs });

  // Filter out APPROVAL_REQUIRED, which is processed in Step 9
  const baseViolations = evaluation.violationCodes.filter((code) => code !== 'APPROVAL_REQUIRED');

  if (baseViolations.length > 0) {
    throw new CapabilityError({
      code: 'AUTHORIZATION_DENIED',
      message: evaluation.reason ?? 'Access denied: caller does not possess required authority.',
      stateChanged: 'no',
      httpStatus: 403,
      retryable: false,
    });
  }

  // Live actor standing verification (Rule 18 TOCTOU check against directory/database)
  if (options?.verifyActorStanding) {
    const standing = await options.verifyActorStanding(principal);
    if (!standing.active) {
      throw new CapabilityError({
        code: 'ACTOR_REVOKED',
        message: standing.reason ?? 'Access denied: caller standing is inactive or revoked.',
        stateChanged: 'no',
        httpStatus: 403,
        retryable: false,
      });
    }
  }

  return evaluation;
}
