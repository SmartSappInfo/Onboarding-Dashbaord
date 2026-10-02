/**
 * @fileOverview Agent Delegation Principal Resolver (PR-6 / Workstream 1.3)
 *
 * Implements Rule 16 (Least Privilege & Agent Wildcard Ban) and Rule 17 (Non-Delegable Actions).
 *
 * Derives a delegated `AgentPrincipal` from an authenticated user principal, computing
 * Effective Authority = User Authority ∩ Agent Allowlist, while strictly eliminating
 * wildcards (`*`) and non-delegable permissions.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AgentPrincipal } from '../contracts/capability-definition';
import { isNonDelegableAction } from '../contracts/risk-levels';

export interface AgentDelegationOptions {
  agentVersion?: string;
  delegationId?: string;
  runId?: string;
  policyVersion?: string;
  toolInvocationId?: string;
  /**
   * Explicit allowlist of scopes the agent is permitted to request.
   * If provided, the agent's scopes will be restricted to User Scopes ∩ Agent Allowlist.
   */
  agentAllowlist?: string[];
}

/**
 * Resolves an agent delegation principal from an authenticated human user principal.
 *
 * INVARIANTS:
 * 1. Actor type is coerced to 'agent'.
 * 2. Wildcard '*' is strictly stripped (Rule 16: agents cannot have wildcard authority).
 * 3. Non-delegable permissions (e.g. system_admin, organization.delete) are strictly stripped (Rule 17).
 * 4. Tenant boundaries (organizationId, workspaceId) are locked to the user principal.
 */
export function resolvePrincipalForAgent(
  userPrincipal: AgentPrincipal,
  agentId: string,
  options?: AgentDelegationOptions
): AgentPrincipal {
  let candidateScopes = userPrincipal.grantedScopes;

  // 1. Compute intersection if an explicit agent allowlist is provided (Rule 16)
  if (Array.isArray(options?.agentAllowlist)) {
    const allowlistSet = new Set(options.agentAllowlist);
    candidateScopes = candidateScopes.filter((scope) => allowlistSet.has(scope));
  }

  // 2. Filter out wildcards and non-delegable actions (Rule 16 & Rule 17)
  const safeScopes = candidateScopes.filter((scope) => {
    // Agents can NEVER have wildcard access
    if (scope === '*') {
      return false;
    }
    // Agents can NEVER inherit non-delegable actions
    if (isNonDelegableAction(scope)) {
      return false;
    }
    return true;
  });

  return {
    actorType: 'agent',
    userId: userPrincipal.userId,
    organizationId: userPrincipal.organizationId,
    workspaceId: userPrincipal.workspaceId,
    agentId,
    agentVersion: options?.agentVersion ?? '1.0.0',
    delegationId: options?.delegationId,
    runId: options?.runId,
    policyVersion: options?.policyVersion,
    toolInvocationId: options?.toolInvocationId,
    grantedScopes: safeScopes,
    effectiveRole: `agent:${agentId}`,
  };
}
