/**
 * @fileOverview Pipeline Step 1: Resolve Principal (Phase 1 / PR-4)
 *
 * Implements Rule 11, Rule 13, Rule 16, PRD §73, and Tools §4.
 *
 * Resolves caller identity from invocation context or session.
 * Rejects unauthenticated callers immediately with `UNAUTHENTICATED` (`stateChanged: 'no'`).
 * Enforces that MCP callers are always typed `actorType: 'agent'`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AgentPrincipal } from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';
import type { CapabilityInvocation } from '../invocation';

export interface ResolvePrincipalOptions {
  getPrincipal?: () => Promise<AgentPrincipal | null> | AgentPrincipal | null;
}

export async function step01ResolvePrincipal(
  invocation: CapabilityInvocation,
  options?: ResolvePrincipalOptions
): Promise<AgentPrincipal> {
  let principal = invocation.principal;

  if (!principal && options?.getPrincipal) {
    const resolved = await options.getPrincipal();
    if (resolved) {
      principal = resolved;
    }
  }

  if (!principal) {
    throw CapabilityError.unauthenticated('Access denied: authentication required.');
  }

  // Validate minimum tenant coordinates
  if (!principal.organizationId || !principal.workspaceId) {
    throw CapabilityError.unauthenticated('Access denied: principal lacks organization or workspace context.');
  }

  // MCP protocol compliance (Rule 11): Tool callers are never interactive humans.
  // Force agent actorType regardless of incoming principal asserted role.
  if (invocation.surface === 'mcp' && principal.actorType !== 'agent') {
    return {
      ...principal,
      actorType: 'agent',
    };
  }

  return principal;
}
