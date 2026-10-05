/**
 * @fileOverview MCP Principal Resolver (PR-6 / Workstream 1.3 / Finding N4 Anti-Spoofing)
 *
 * Implements Rule 16 (Least Privilege), Rule 47 (Explicit Workspace Scope),
 * and Rule 48 (Zero Privilege Elevation via Target Headers).
 *
 * Resolves verified MCP API Keys into canonical `AgentPrincipal` records.
 *
 * SECURITY INVARIANT (Finding N4):
 * The tenant context (`organizationId`, `workspaceId`) is bound strictly to the
 * verified database record (`mcp_keys`). External caller-supplied headers such as
 * `x-organization-id` or query parameters are strictly ignored to prevent tenant spoofing.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { McpApiKey, McpCategory } from '@/lib/mcp/types';
import type { AgentPrincipal } from '../contracts/capability-definition';
import { isNonDelegableAction } from '../contracts/risk-levels';

/**
 * Maps each MCP category to its canonical domain and tool permission scopes.
 */
const CATEGORY_SCOPES: Readonly<Record<McpCategory, readonly string[]>> = {
  memory: ['app:memory_view', 'app:memory_manage', 'tools:memory.*'],
  context: ['app:memory_view', 'tools:context.*'],
  crm: ['app:contacts_view', 'app:contacts_manage', 'tools:crm.*'],
  deal: ['app:deals_view', 'app:deals_manage', 'tools:deal.*'],
  task: ['app:tasks_view', 'app:tasks_manage', 'tools:task.*'],
  // rbac coordinates are what the governed meeting.* capabilities declare (Phase 11 M1 · T1).
  meeting: ['app:meetings_view', 'app:meetings_manage', 'rbac:operations.meetings.view', 'rbac:operations.meetings.edit', 'tools:meeting.*'],
  campaign: ['app:campaigns_view', 'app:campaigns_manage', 'tools:campaign.*'],
  governance: ['app:governance_view', 'app:governance_manage', 'tools:governance.*'],
};

export interface ResolveMcpPrincipalOptions {
  toolInvocationId?: string;
  runId?: string;
}

/**
 * Resolves an authenticated `McpApiKey` into an automated `AgentPrincipal`.
 *
 * @param apiKey The verified `McpApiKey` record from Firestore `/mcp_keys`.
 * @param options Optional invocation correlation metadata.
 * @returns Immutable `AgentPrincipal` bound strictly to the key's tenant.
 */
export function resolvePrincipalFromMcpKey(
  apiKey: McpApiKey,
  options?: ResolveMcpPrincipalOptions
): AgentPrincipal {
  if (apiKey.revoked) {
    throw new Error(`[McpPrincipal] API Key '${apiKey.id}' has been revoked.`);
  }

  if (apiKey.expiresAt) {
    const expiresMs = Date.parse(apiKey.expiresAt);
    if (!Number.isNaN(expiresMs) && expiresMs <= Date.now()) {
      throw new Error(`[McpPrincipal] API Key '${apiKey.id}' expired at ${apiKey.expiresAt}.`);
    }
  }

  const scopesSet = new Set<string>();

  // Determine allowed categories
  const categories: readonly McpCategory[] =
    Array.isArray(apiKey.allowedCategories) && apiKey.allowedCategories.length > 0
      ? apiKey.allowedCategories
      : (Object.keys(CATEGORY_SCOPES) as McpCategory[]);

  for (const cat of categories) {
    const scopes = CATEGORY_SCOPES[cat] || [];
    for (const scope of scopes) {
      // Agents can NEVER inherit non-delegable actions or wildcard '*'
      if (scope !== '*' && !isNonDelegableAction(scope)) {
        scopesSet.add(scope);
      }
    }
  }

  return {
    actorType: 'agent',
    userId: `api_key:${apiKey.id}`,
    organizationId: apiKey.organizationId,
    workspaceId: apiKey.workspaceId,
    agentId: `mcp_key:${apiKey.id}`,
    agentVersion: '2.0.0',
    toolInvocationId: options?.toolInvocationId,
    runId: options?.runId,
    grantedScopes: Array.from(scopesSet),
    effectiveRole: `mcp:${apiKey.role}`,
  };
}
