/**
 * @fileOverview Pipeline Step 9: Verify Approval (Phase 1 / PR-4)
 *
 * Implements Rule 21 (Two-Phase Actions), Rule 22 (Approval Binding & Burn Prevention),
 * PRD §73, and Tools §4.
 *
 * For automated agents executing high-risk (L3/L4) capabilities:
 * - Requires a verified human approval bound to the validated payload hash.
 * - Single-use binding binds the approval to this invocation.
 * - Re-evaluates full authority with the verified approval attached.
 *
 * Throws `APPROVAL_REQUIRED` (`stateChanged: 'no'`) if approval is missing.
 * Throws `FORBIDDEN` (`stateChanged: 'no'`) if approval verification fails.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  isAutomatedPrincipal,
  type AgentPrincipal,
  type AnyCapabilityDefinition,
  type VerifiedApproval,
} from '../../contracts/capability-definition';
import { requiresAgentApproval } from '../../contracts/risk-levels';
import {
  CapabilityError,
  type CapabilityErrorCode,
} from '../../errors/capability-error';
import {
  computeApprovalPayloadHash,
  type ApprovalVerifier,
} from '../../policy/approval-verifier';
import { evaluatePrincipalAuthority } from '../../policy/principal-evaluator';

export interface VerifyApprovalOptions {
  approvalId?: string;
  approvals?: ApprovalVerifier;
  nowMs?: number;
}

export async function step09VerifyApproval(
  principal: AgentPrincipal,
  capability: AnyCapabilityDefinition,
  validatedInput: unknown,
  options?: VerifyApprovalOptions
): Promise<VerifiedApproval | undefined> {
  const isAutomatedAgent = isAutomatedPrincipal(principal);
  const needsApproval = isAutomatedAgent && requiresAgentApproval(capability.risk);

  if (!needsApproval) {
    return undefined;
  }

  const approvalId = options?.approvalId;
  if (!approvalId) {
    throw CapabilityError.approvalRequired(
      undefined,
      `Human Approval Required: '${capability.id}' (${capability.risk.level}) needs a verified approval for agent execution.`
    );
  }

  const verifier = options?.approvals;
  if (!verifier) {
    throw new CapabilityError({
      code: 'APPROVAL_VERIFIER_UNAVAILABLE',
      message: 'No approval verifier is configured on this platform instance.',
      stateChanged: 'no',
      httpStatus: 403,
      retryable: false,
    });
  }

  const nowMs = options?.nowMs ?? Date.now();
  const target = {
    organizationId: principal.organizationId,
    workspaceId: principal.workspaceId,
  };

  const payloadHash = computeApprovalPayloadHash({
    capabilityId: capability.id,
    capabilityVersion: capability.version,
    ...target,
    input: validatedInput,
  });

  const toolInvocationId = principal.toolInvocationId ?? `${principal.runId ?? 'run'}:${capability.id}`;

  const verification = await verifier.verifyAndBind({
    approvalId,
    capabilityId: capability.id,
    capabilityVersion: capability.version,
    ...target,
    payloadHash,
    toolInvocationId,
    agentId: principal.agentId,
    nowMs,
  });

  if (!verification.ok) {
    throw new CapabilityError({
      code: (verification.code as CapabilityErrorCode) || 'FORBIDDEN',
      message: verification.message,
      stateChanged: 'no',
      httpStatus: 403,
      retryable: false,
    });
  }

  // Re-evaluate full authority with verified approval attached
  const finalAuthority = evaluatePrincipalAuthority(principal, capability, target, {
    verifiedApproval: verification.approval,
    payloadHash,
    nowMs,
  });

  if (!finalAuthority.allowed) {
    throw new CapabilityError({
      code: 'AUTHORIZATION_DENIED',
      message: finalAuthority.reason ?? 'Principal is not authorized after approval evaluation.',
      stateChanged: 'no',
      httpStatus: 403,
      retryable: false,
    });
  }

  return verification.approval;
}
