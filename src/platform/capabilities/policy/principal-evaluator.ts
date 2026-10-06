/**
 * @fileOverview Agent Principal Authority Evaluator (Phase 0 / Phase 3)
 *
 * Implements Rules 16, 17, 21 and 22. Pure and synchronous: no I/O, so it can run anywhere
 * (MCP handler, agent-step worker, dispatcher) and is exhaustively unit-testable.
 *
 *   Effective Authority = User Authority ∩ Agent Authority ∩ Workspace Scope ∩ Tool Scope ∩ Active Policy
 *
 * Principles:
 * 1. Refusal by default: a scoped capability with a missing or mismatched principal/target
 *    organization or workspace is denied. The target is REQUIRED (no string/partial forms).
 * 2. Non-delegable: capabilities flagged `risk.nonDelegable`, or requiring a non-delegable
 *    permission, can never run for an agent or delegated principal (Rule 17).
 * 3. No wildcard for agents: `*` only works for interactive humans.
 * 4. Approval binding (Rules 21, 22): an agent may run an approval-requiring capability only with a
 *    `VerifiedApproval` produced by the approval verifier — bound to this capability + version,
 *    tenant, invocation and exact payload hash. Principals cannot self-assert approvals.
 */

import { canonicalPermissionKey } from '../contracts/permission-refs';
import { isAutomatedPrincipal, type AgentPrincipal, type CapabilityDefinition, type CapabilityDomain, type VerifiedApproval } from '../contracts/capability-definition';
import { isNonDelegableAction, requiresAgentApproval } from '../contracts/risk-levels';
import { globalAgentPersonaRegistry } from '../../identity/agent-registry';

export type PolicyViolationCode =
  | 'TENANT_SCOPE_MISSING'
  | 'TENANT_ISOLATION'
  | 'WORKSPACE_SCOPE_MISSING'
  | 'WORKSPACE_ISOLATION'
  | 'NON_DELEGABLE'
  | 'INSUFFICIENT_SCOPE'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_INVALID'
  | 'PERSONA_DISALLOWED';

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason?: string;
  violations: string[];
  /** Parallel to `violations`; lets callers branch on a specific rule without string matching. */
  violationCodes: PolicyViolationCode[];
}

export type CapabilityPolicyTarget = Pick<
  CapabilityDefinition<never, unknown>,
  'id' | 'version' | 'permissions' | 'workspaceScoped' | 'tenantScoped' | 'risk'
> & { domain?: CapabilityDomain };

/** The tenant the operation acts on. Both ids are required; pass the run's/caller's own scope. */
export interface TargetScope {
  organizationId: string;
  workspaceId: string;
}

export interface EvaluationOptions {
  /** Produced only by `ApprovalVerifier` after checking the server-side approval record. */
  verifiedApproval?: VerifiedApproval;
  /** Canonical hash of the validated input this invocation will execute with. */
  payloadHash?: string;
  nowMs?: number;
}

const isBlank = (value: string | undefined): boolean => !value || value.trim() === '';

export function evaluatePrincipalAuthority(
  principal: AgentPrincipal,
  capability: CapabilityPolicyTarget,
  target: TargetScope,
  options: EvaluationOptions = {}
): PolicyEvaluationResult {
  const violations: string[] = [];
  const violationCodes: PolicyViolationCode[] = [];
  const deny = (code: PolicyViolationCode, message: string) => {
    violationCodes.push(code);
    violations.push(message);
  };

  // Fail closed: agent rules apply unless the principal is explicitly an interactive user.
  const isAutomatedAgent = isAutomatedPrincipal(principal);

  // 1. Tenant (organization) boundary
  if (capability.tenantScoped) {
    if (isBlank(principal.organizationId) || isBlank(target.organizationId)) {
      deny('TENANT_SCOPE_MISSING', 'Scope Error: tenant-scoped capability requires both principal and target organizationId.');
    } else if (principal.organizationId !== target.organizationId) {
      deny(
        'TENANT_ISOLATION',
        `Tenant Isolation Violation: Principal organization (${principal.organizationId}) does not match target organization (${target.organizationId})`
      );
    }
  }

  // 2. Workspace boundary
  if (capability.workspaceScoped) {
    if (isBlank(principal.workspaceId) || isBlank(target.workspaceId)) {
      deny('WORKSPACE_SCOPE_MISSING', 'Scope Error: workspace-scoped capability requires both principal and target workspaceId.');
    } else if (principal.workspaceId !== target.workspaceId) {
      deny(
        'WORKSPACE_ISOLATION',
        `Tenant Isolation Violation: Principal workspace (${principal.workspaceId}) does not match target workspace (${target.workspaceId})`
      );
    }
  }

  // 3. Non-delegable (Rule 17)
  if (isAutomatedAgent) {
    if (capability.risk.nonDelegable) {
      deny('NON_DELEGABLE', `Non-Delegable Risk Violation: Capability '${capability.id}' cannot be executed by an automated or delegated agent.`);
    }
    for (const permission of capability.permissions) {
      if (isNonDelegableAction(permission)) {
        deny('NON_DELEGABLE', `Non-Delegable Permission Violation: Action '${permission}' cannot be executed by an automated agent or delegated principal.`);
      }
    }
  }

  // 4. Scope intersection (Rule 16); wildcard only for interactive humans. A required permission is
  // met by an exact grant or by a grant that is the SAME permission under the declared vocabulary
  // (alias → canonical coordinate, Phase 11 M0 · T4). Equivalence never widens beyond declared synonyms.
  const grantedCanonical = new Set(
    principal.grantedScopes.map(canonicalPermissionKey).filter((k): k is string => k !== null)
  );
  for (const permission of capability.permissions) {
    const key = canonicalPermissionKey(permission);
    const explicit = principal.grantedScopes.includes(permission) || (key !== null && grantedCanonical.has(key));
    const wildcard = !isAutomatedAgent && principal.grantedScopes.includes('*');
    if (!explicit && !wildcard) {
      deny('INSUFFICIENT_SCOPE', `Insufficient Scope: Missing required permission scope '${permission}'`);
    }
  }

  // 4b. Agent Persona boundary check (Rule 16 / Phase 3 Milestone 1 & 2)
  if (isAutomatedAgent && principal.agentId && capability.domain) {
    if (globalAgentPersonaRegistry.hasPersona(principal.agentId)) {
      // If a verified human approval exists, the autonomous risk ceiling is bypassed (Rule 22)
      // because execution is explicitly authorized by a human operator, while domain boundaries remain strictly enforced.
      const riskToCheck = options.verifiedApproval
        ? { level: 'L0_READ' as const }
        : capability.risk;

      const personaValidation = globalAgentPersonaRegistry.validatePersonaCapability(
        principal.agentId,
        {
          domain: capability.domain,
          risk: riskToCheck,
        }
      );
      if (!personaValidation.allowed) {
        deny('PERSONA_DISALLOWED', `Persona Violation: ${personaValidation.reason}`);
      }
    }
  }

  // 5. Verified human approval for agents (Rules 21, 22)
  if (isAutomatedAgent && requiresAgentApproval(capability.risk)) {
    const approval = options.verifiedApproval;
    if (!approval) {
      deny('APPROVAL_REQUIRED', `Human Approval Required: '${capability.id}' (${capability.risk.level}) needs a verified approval for agent execution.`);
    } else {
      const now = options.nowMs ?? Date.now();
      const mismatches: string[] = [];
      if (approval.capabilityId !== capability.id) mismatches.push('capability');
      if (approval.capabilityVersion !== capability.version) mismatches.push('capability version');
      if (approval.organizationId !== target.organizationId) mismatches.push('organization');
      if (approval.workspaceId !== target.workspaceId) mismatches.push('workspace');
      if (!principal.toolInvocationId || approval.toolInvocationId !== principal.toolInvocationId) mismatches.push('tool invocation');
      if (!options.payloadHash || approval.payloadHash !== options.payloadHash) mismatches.push('payload');
      const expiresMs = Date.parse(approval.expiresAt);
      if (Number.isNaN(expiresMs) || expiresMs <= now) mismatches.push('expiry');
      if (principal.agentId && approval.approvedBy === principal.agentId) mismatches.push('self-approval');
      if (mismatches.length > 0) {
        deny('APPROVAL_INVALID', `Invalid Approval: approval ${approval.approvalId} does not match (${mismatches.join(', ')}).`);
      }
    }
  }

  if (violations.length > 0) {
    return { allowed: false, reason: violations.join('; '), violations, violationCodes };
  }
  return { allowed: true, violations: [], violationCodes: [] };
}
