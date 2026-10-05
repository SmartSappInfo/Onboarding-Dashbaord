/**
 * @fileOverview Universal Administrator & Scope Helper
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * Centralizes the definition of what constitutes an "Admin" within a workspace context.
 * Used across navigation, settings, entity scoping, deals scoping, and tasks scoping.
 *
 * An Administrator is defined as:
 * 1. Superadmin (Tenant / System level)
 * 2. User with 'system_admin' permission
 * 3. User with global role 'admin' or 'owner' or included in roles array
 * 4. User with workspace-specific admin/owner role in workspaceRoles[workspaceId]
 * 5. User with management:systemSettings:edit or management:users:edit permission
 *
 * TESTABILITY: Covered in `src/lib/__tests__/workspace-admin-utils.test.ts`.
 */

import type { UserProfile, PermissionsSchema } from '@/lib/types';

export function isUserWorkspaceAdmin(
  profile: UserProfile | null | undefined,
  workspaceId: string | null | undefined,
  permissionsSchema?: PermissionsSchema | null,
  isSuperAdmin = false
): boolean {
  if (isSuperAdmin) return true;
  if (!profile) return false;

  // 1. Direct system admin permission
  if (profile.permissions?.includes('system_admin')) {
    return true;
  }

  // 2. Global roles check
  if (profile.role === 'admin' || profile.role === 'owner') {
    return true;
  }
  if (
    profile.roles?.some((r) =>
      ['admin', 'owner', 'super_admin', 'system_admin', 'workspace_admin'].includes(r)
    )
  ) {
    return true;
  }

  // 3. Workspace-scoped role check
  if (workspaceId && profile.workspaceRoles?.[workspaceId]) {
    const wsRoles = profile.workspaceRoles[workspaceId];
    if (wsRoles.some((r) => ['admin', 'owner', 'workspace_admin'].includes(r))) {
      return true;
    }
  }

  // 4. Hierarchical permission check (supports normalized schema with `features` as well as direct map)
  const mgmt = permissionsSchema?.management as unknown as Record<string, unknown> | undefined;
  const mgmtFeatures = (mgmt?.features as Record<string, unknown> | undefined) || mgmt;
  const sysSettings = mgmtFeatures?.systemSettings as { edit?: boolean } | undefined;
  const usersPerm = mgmtFeatures?.users as { edit?: boolean } | undefined;

  if (sysSettings?.edit === true || usersPerm?.edit === true) {
    return true;
  }

  return false;
}
