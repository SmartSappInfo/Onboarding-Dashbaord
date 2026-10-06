/**
 * @fileOverview Live principals for server-side flows that act for a person without their session
 * (Phase 11 M0 · T4; Rules 16, 17, 18).
 *
 * - `loadLiveUserPrincipal`: the person's CURRENT authority, read from their live profile: it must
 *   exist, be approved, belong to the organisation and be a member of the workspace (system admins
 *   excepted). Scopes come from `principalFromProfile`, exactly as for a signed-in session.
 * - `delegatedAgentPrincipal`: an agent acting for that person gets the INTERSECTION of the person's
 *   scopes and the persona's allowed permissions (matched by canonical coordinate), minus wildcards
 *   and non-delegable permissions. An agent can never hold more than both of them.
 *
 * Used by: CRM proposal execution (T4), the legacy MCP bridge (M2 review R1).
 * Tests: src/platform/__tests__/agents/crm/crm-proposal-execution.test.ts, src/lib/mcp/__tests__/legacy-mcp-governed.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import type { AgentPrincipal } from '../contracts/capability-definition';
import { canonicalPermissionKey } from '../contracts/permission-refs';
import { isNonDelegableAction } from '../contracts/risk-levels';
import { principalFromProfile } from './session-principal-resolver';
import { globalAgentPersonaRegistry } from '@/platform/identity/agent-registry';
import type { AgentPersonaId } from '@/platform/identity/agent-persona-types';

const LiveProfileSchema = z.object({
  organizationId: z.string().min(1),
  workspaceIds: z.array(z.string()).default([]),
  isAuthorized: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  permissionsSchema: z.unknown().optional(),
  role: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

export async function loadLiveUserPrincipal(
  db: Firestore,
  params: { uid: string; organizationId: string; workspaceId: string }
): Promise<AgentPrincipal | null> {
  if (!params.uid || params.uid.includes('/')) return null;
  const snap = await db.collection('users').doc(params.uid).get();
  const parsed = snap.exists ? LiveProfileSchema.safeParse(snap.data()) : null;
  if (!parsed?.success) return null;
  const profile = parsed.data;
  const isSystemAdmin = (profile.permissions ?? []).includes('system_admin');
  if (profile.isAuthorized !== true) return null;
  if (profile.organizationId !== params.organizationId) return null;
  if (!isSystemAdmin && !profile.workspaceIds.includes(params.workspaceId)) return null;
  return principalFromProfile({ uid: params.uid, workspaceId: params.workspaceId, isSystemAdmin, profile });
}

export function delegatedAgentPrincipal(
  human: AgentPrincipal,
  personaId: AgentPersonaId,
  ids: { runId: string; toolInvocationId: string }
): AgentPrincipal | null {
  const persona = globalAgentPersonaRegistry.getPersona(personaId);
  if (!persona) return null;
  const humanIsAdmin = human.grantedScopes.includes('*');
  const humanKeys = new Set(human.grantedScopes.map(canonicalPermissionKey).filter((k): k is string => k !== null));
  const granted = persona.allowedPermissions.filter((perm) => {
    if (perm.includes('*') || isNonDelegableAction(perm)) return false;
    if (humanIsAdmin || human.grantedScopes.includes(perm)) return true;
    const key = canonicalPermissionKey(perm);
    return key !== null && humanKeys.has(key);
  });
  return {
    actorType: 'agent',
    userId: human.userId,
    organizationId: human.organizationId,
    workspaceId: human.workspaceId,
    agentId: personaId,
    runId: ids.runId,
    toolInvocationId: ids.toolInvocationId,
    grantedScopes: granted,
    effectiveRole: persona.role,
  };
}
