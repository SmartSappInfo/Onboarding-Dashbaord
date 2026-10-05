/**
 * @fileOverview Session Principal Resolver (PR-6 / Workstream 1.3)
 *
 * Implements Rule 16 (Least Privilege), Rule 17 (Non-Delegable Operations),
 * Rule 47 (Explicit Workspace Scope), and Rule 69 (Master Layering Axiom).
 *
 * Resolves verified Next.js session cookies into canonical `AgentPrincipal` records,
 * calculating granted scopes across flat permissions, roles, and hierarchical coordinates.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireWorkspace, type AuthContext } from '@/lib/auth/require-auth';
import type { AgentPrincipal } from '../contracts/capability-definition';
import {
  flattenPermissionsSchema,
  normalizePermissionsSchema,
} from '@/lib/permissions-engine';
import type { PermissionsSchema } from '@/lib/types';

export interface ResolveSessionPrincipalOptions {
  /**
   * Pre-resolved auth context (e.g. from an existing requireWorkspace / requireAuth call)
   * to avoid redundant Firebase lookups during a single request lifecycle.
   */
  authContext?: AuthContext;
}

/**
 * Extracts all hierarchical `rbac:<section>.<feature>.<action>` permission coordinates
 * from a normalized PermissionsSchema where the action is explicitly enabled.
 */
export function extractHierarchicalScopes(schema: PermissionsSchema): string[] {
  const normalized = normalizePermissionsSchema(schema);
  const scopes: string[] = [];

  const sections: (keyof PermissionsSchema)[] = [
    'operations',
    'finance',
    'studios',
    'social',
    'workforce',
    'management',
  ];

  for (const section of sections) {
    const secObj = normalized[section];
    if (!secObj || !secObj.enabled || !secObj.features) continue;

    for (const [featureName, featurePerms] of Object.entries(secObj.features)) {
      if (!featurePerms || typeof featurePerms !== 'object') continue;

      for (const [actionName, isAllowed] of Object.entries(featurePerms)) {
        if (isAllowed === true) {
          scopes.push(`rbac:${section}.${featureName}.${actionName}`);
        }
      }
    }
  }

  return scopes;
}

/**
 * Resolves the authenticated caller's session into an interactive human `AgentPrincipal`.
 *
 * @param workspaceId The target workspace to verify access against.
 * @param options Optional pre-resolved auth context.
 * @returns Fully populated, verified `AgentPrincipal`.
 */
export async function resolvePrincipalFromSession(
  workspaceId: string,
  options?: ResolveSessionPrincipalOptions
): Promise<AgentPrincipal> {
  const auth = options?.authContext ?? (await requireWorkspace(workspaceId));
  const profile = auth.profile;
  const scopesSet = new Set<string>();

  // 1. System Admin gets wildcard scope for interactive user operations
  if (auth.isSystemAdmin) {
    scopesSet.add('*');
    scopesSet.add('app:system_admin');
    scopesSet.add('system_admin');
  }

  // 2. Collect flat permissions (e.g. 'contacts_view' -> 'app:contacts_view')
  if (Array.isArray(profile.permissions)) {
    for (const perm of profile.permissions) {
      if (typeof perm === 'string' && perm.trim() !== '') {
        scopesSet.add(perm);
        if (!perm.startsWith('app:') && !perm.startsWith('rbac:')) {
          scopesSet.add(`app:${perm}`);
        }
      }
    }
  }

  // 3. Collect hierarchical coordinates and flattened schemas
  if (profile.permissionsSchema) {
    const hierarchical = extractHierarchicalScopes(profile.permissionsSchema);
    for (const scope of hierarchical) {
      scopesSet.add(scope);
    }

    const flattened = flattenPermissionsSchema(profile.permissionsSchema);
    for (const perm of flattened) {
      scopesSet.add(perm);
      if (!perm.startsWith('app:')) {
        scopesSet.add(`app:${perm}`);
      }
    }
  }

  // 3b. Legacy flat `meetings_manage` implies the meetings RBAC coordinates (Phase 11 M1 · T1).
  // Most roles still use the flat list, where managing meetings has always included viewing them.
  // Without this, legacy-role users could not use the governed `meeting.*` capabilities at all.
  if (scopesSet.has('meetings_manage') || scopesSet.has('app:meetings_manage')) {
    scopesSet.add('rbac:operations.meetings.view');
    scopesSet.add('rbac:operations.meetings.edit');
  }

  // 4. Default self-identity and workspace discovery scopes granted to all verified workspace members
  scopesSet.add('identity:read');
  scopesSet.add('workspace:read');
  scopesSet.add('identity:access:check');
  scopesSet.add('identity:access:list');

  const effectiveRole =
    auth.isSystemAdmin
      ? 'system_admin'
      : profile.role || (Array.isArray(profile.roles) && profile.roles[0]) || 'member';

  return {
    actorType: 'user',
    userId: auth.uid,
    organizationId: profile.organizationId,
    workspaceId,
    grantedScopes: Array.from(scopesSet),
    effectiveRole,
  };
}
