/**
 * @fileOverview Authority for platform capabilities reached through the legacy MCP registry
 * (Phase 11 M2 review R1; Rules 16, 17, 51, 64).
 *
 * WHY
 * `globalMcpRegistry` (used by `/api/mcp` v1, the supervisor, legacy workflows and domain
 * specialists) wraps every canonical capability. The wrapper used to call `capability.handler()`
 * with a made-up principal (`tools:<id>` scope, role `mcp_caller`), skipping flags, permissions,
 * resource scope, live standing, idempotency and audit. It now runs through the gateway with the
 * authority resolved here.
 *
 * RULES
 * - API-key callers have no user authority on this endpoint (a v1 key carries no scopes), so they
 *   are refused and pointed to the governed `/api/mcp/v2/{domain}` endpoint, which maps key scopes.
 * - Everyone else acts for a user: that user's LIVE profile must exist, be approved, belong to the
 *   same organization and be a member of the workspace (system admins excepted). Scopes come from
 *   the same function a signed-in session uses (`principalFromProfile`).
 * - Agent callers get the user's scopes minus wildcards and non-delegable actions (Rules 16, 17).
 *
 * CAUTION: `callerId` is trusted as the acting user ONLY because API-key callers are refused first;
 * for session callers the route sets it from the verified session.
 *
 * Tests: src/lib/mcp/__tests__/legacy-mcp-governed.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { AgentPrincipal } from '@/platform/capabilities/contracts/capability-definition';
import { loadLiveUserPrincipal } from '@/platform/capabilities/policy/live-user-principal';
import { isNonDelegableAction } from '@/platform/capabilities/contracts/risk-levels';
import type { McpExecutionContext } from './types';

export const LEGACY_MCP_API_KEY_REFUSAL =
  "Platform capabilities aren't available to API keys on this endpoint. Use the governed endpoint /api/mcp/v2/{domain}.";

export type LegacyMcpAuthority = { principal: AgentPrincipal } | { refusal: string };

export async function resolveLegacyMcpPrincipal(ctx: McpExecutionContext, db: Firestore): Promise<LegacyMcpAuthority> {
  if (ctx.apiKeyId || ctx.callerType === 'api_key') return { refusal: LEGACY_MCP_API_KEY_REFUSAL };

  const uid = ctx.userId ?? ctx.callerId;
  const denied = { refusal: 'The acting user could not be verified for this workspace.' };
  const human = await loadLiveUserPrincipal(db, { uid, organizationId: ctx.organizationId, workspaceId: ctx.workspaceId });
  if (!human) return denied;
  if (ctx.callerType !== 'agent') return { principal: human };

  return {
    principal: {
      ...human,
      actorType: 'agent',
      agentId: `legacy_mcp:${ctx.callerId}`,
      runId: ctx.requestId,
      grantedScopes: human.grantedScopes.filter((scope) => !scope.includes('*') && !isNonDelegableAction(scope)),
    },
  };
}
