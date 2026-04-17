'use server';

import { adminDb } from './firebase-admin';
import type { AppPermissionId, UserProfile, Role, Workspace, WorkspaceEntity, PermissionsSchema, AppPermissionAction } from './types';
import { evaluatePermission } from './permissions-engine';

/**
 * @fileOverview Workspace-scoped permission checking utilities.
 * 
 * Implements Requirement 9: Workspace-Scoped Permissions
 * 
 * Permission evaluation occurs at four levels:
 * 1. Organization level: Does user belong to the organization?
 * 2. Workspace level: Does user have access to the specific workspace (via role.workspaceIds)?
 * 3. Workspace-entity level: Does user have permission to access this workspace_entities record?
 * 4. Feature/capability level: Does the workspace have the capability enabled?
 * 
 * System admins with 'system_admin' permission bypass all checks.
 */

/**
 * Result of a permission check
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  level?: 'organization' | 'workspace' | 'workspace-entity' | 'feature';
}

/**
 * Checks if a user has access to a specific workspace.
 * 
 * Evaluation logic:
 * 1. System admins bypass all checks
 * 2. User must belong to the same organization as the workspace
 * 3. User must have at least one role that grants access to the workspace
 * 
 * @param userId - The user ID to check
 * @param workspaceId - The workspace ID to check access for
 * @returns Permission check result
 * 
 * Requirements: 9.1, 9.2, 9.4
 */
export async function checkWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<PermissionCheckResult> {
  try {
    // 1. Fetch user profile
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      return {
        granted: false,
        reason: 'User not found',
        level: 'organization',
      };
    }

    const user = userSnap.data() as UserProfile;
    const permissions: AppPermissionId[] = user.permissions || [];

    // System admins bypass all permission checks
    if (permissions.includes('system_admin')) {
      return {
        granted: true,
        reason: 'System admin bypass',
      };
    }

    // 2. Fetch workspace
    const workspaceSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!workspaceSnap.exists) {
      return {
        granted: false,
        reason: 'Workspace not found',
        level: 'workspace',
      };
    }

    const workspace = workspaceSnap.data() as Workspace;

    // 3. Check organization membership
    if (user.organizationId !== workspace.organizationId) {
      return {
        granted: false,
        reason: 'User does not belong to workspace organization',
        level: 'organization',
      };
    }

    // 4. Check if user has any role that grants access to this workspace
    // Fetch all roles for the user
    const rolesSnap = await adminDb
      .collection('roles')
      .where('organizationId', '==', user.organizationId)
      .get();

    const userRoles = rolesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Role))
      .filter((role) => user.roles.includes(role.id));

    // Check if any role grants access to this workspace
    const hasWorkspaceAccess = userRoles.some((role) =>
      role.workspaceIds.includes(workspaceId)
    );

    if (!hasWorkspaceAccess) {
      return {
        granted: false,
        reason: 'User does not have a role that grants access to this workspace',
        level: 'workspace',
      };
    }

    return {
      granted: true,
    };
  } catch (error: any) {
    console.error('>>> [WORKSPACE_PERMISSIONS] checkWorkspaceAccess failed:', error.message);
    return {
      granted: false,
      reason: `Permission check failed: ${error.message}`,
    };
  }
}

/**
 * Checks if a user has access to a specific workspace_entities record.
 * 
 * This combines workspace access check with entity-level permissions.
 * 
 * @param userId - The user ID to check
 * @param workspaceEntityId - The workspace_entities document ID
 * @returns Permission check result
 * 
 * Requirements: 9.1, 9.2, 9.3
 */
export async function checkWorkspaceEntityAccess(
  userId: string,
  workspaceEntityId: string
): Promise<PermissionCheckResult> {
  try {
    // 1. Fetch workspace_entities record
    const weSnap = await adminDb
      .collection('workspace_entities')
      .doc(workspaceEntityId)
      .get();

    if (!weSnap.exists) {
      return {
        granted: false,
        reason: 'Workspace entity record not found',
        level: 'workspace-entity',
      };
    }

    const workspaceEntity = weSnap.data() as WorkspaceEntity;

    // 2. Check workspace access
    const workspaceAccessResult = await checkWorkspaceAccess(
      userId,
      workspaceEntity.workspaceId
    );

    if (!workspaceAccessResult.granted) {
      return {
        ...workspaceAccessResult,
        level: 'workspace-entity',
      };
    }

    return {
      granted: true,
    };
  } catch (error: any) {
    console.error('>>> [WORKSPACE_PERMISSIONS] checkWorkspaceEntityAccess failed:', error.message);
    return {
      granted: false,
      reason: `Permission check failed: ${error.message}`,
    };
  }
}

/**
 * Checks if a user has a specific permission AND access to a workspace.
 * 
 * This is the primary permission check function for workspace-scoped operations.
 * 
 * @param userId - The user ID to check
 * @param workspaceId - The workspace ID to check access for
 * @param permission - The permission to check (e.g., 'schools_edit', 'tags_manage')
 * @returns Permission check result
 * 
 * Requirements: 9.4
 */
export async function checkWorkspacePermission(
  userId: string,
  workspaceId: string,
  permission: AppPermissionId
): Promise<PermissionCheckResult> {
  try {
    // 1. Check workspace access first
    const workspaceAccessResult = await checkWorkspaceAccess(userId, workspaceId);

    if (!workspaceAccessResult.granted) {
      return workspaceAccessResult;
    }

    // 2. Fetch user profile to check permissions
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      return {
        granted: false,
        reason: 'User not found',
        level: 'organization',
      };
    }

    const user = userSnap.data() as UserProfile;
    const permissions: AppPermissionId[] = user.permissions || [];
    const schema = user.permissionsSchema;

    // System admins bypass all permission checks
    if (permissions.includes('system_admin')) {
      return {
        granted: true,
        reason: 'System admin bypass',
      };
    }

    // 3. Evaluate permission
    let isGranted = false;

    if (schema) {
      // Use the new hierarchical schema if available
      const coords = mapLegacyPermissionToCoordinates(permission);
      if (coords) {
        isGranted = evaluatePermission(schema, coords.section, coords.feature, coords.action);
      } else {
        // Fallback to flat array if no mapping exists yet
        isGranted = permissions.includes(permission);
      }
    } else {
      // Legacy flat array check
      isGranted = permissions.includes(permission);
    }

    if (!isGranted) {
      return {
        granted: false,
        reason: `User does not have required permission: ${permission}`,
        level: 'feature',
      };
    }

    return {
      granted: true,
    };
  } catch (error: any) {
    console.error('>>> [WORKSPACE_PERMISSIONS] checkWorkspacePermission failed:', error.message);
    return {
      granted: false,
      reason: `Permission check failed: ${error.message}`,
    };
  }
}

/**
 * Checks if a workspace has a specific capability enabled.
 * 
 * @param workspaceId - The workspace ID to check
 * @param capability - The capability to check (e.g., 'billing', 'admissions', 'messaging')
 * @returns Permission check result
 * 
 * Requirements: 9.4
 */
export async function checkWorkspaceCapability(
  workspaceId: string,
  capability: 'billing' | 'admissions' | 'children' | 'contracts' | 'messaging' | 'automations' | 'tasks'
): Promise<PermissionCheckResult> {
  try {
    const workspaceSnap = await adminDb.collection('workspaces').doc(workspaceId).get();

    if (!workspaceSnap.exists) {
      return {
        granted: false,
        reason: 'Workspace not found',
        level: 'workspace',
      };
    }

    const workspace = workspaceSnap.data() as Workspace;

    if (!workspace.capabilities) {
      return {
        granted: false,
        reason: 'Workspace capabilities not configured',
        level: 'feature',
      };
    }

    if (!workspace.capabilities[capability]) {
      return {
        granted: false,
        reason: `Workspace does not have ${capability} capability enabled`,
        level: 'feature',
      };
    }

    return {
      granted: true,
    };
  } catch (error: any) {
    console.error('>>> [WORKSPACE_PERMISSIONS] checkWorkspaceCapability failed:', error.message);
    return {
      granted: false,
      reason: `Capability check failed: ${error.message}`,
    };
  }
}

/**
 * Comprehensive permission check that evaluates all four levels:
 * 1. Organization membership
 * 2. Workspace access
 * 3. Feature permission
 * 4. Workspace capability (optional)
 * 
 * @param userId - The user ID to check
 * @param workspaceId - The workspace ID to check access for
 * @param permission - The permission to check
 * @param capability - Optional capability to check
 * @returns Permission check result
 * 
 * Requirements: 9.4
 */
export async function checkFullWorkspacePermission(
  userId: string,
  workspaceId: string,
  permission: AppPermissionId,
  capability?: 'billing' | 'admissions' | 'children' | 'contracts' | 'messaging' | 'automations' | 'tasks'
): Promise<PermissionCheckResult> {
  try {
    // 1. Check workspace permission (includes organization and workspace access)
    const permissionResult = await checkWorkspacePermission(userId, workspaceId, permission);

    if (!permissionResult.granted) {
      return permissionResult;
    }

    // 2. Check workspace capability if specified
    if (capability) {
      const capabilityResult = await checkWorkspaceCapability(workspaceId, capability);

      if (!capabilityResult.granted) {
        return capabilityResult;
      }
    }

    return {
      granted: true,
    };
  } catch (error: any) {
    console.error('>>> [WORKSPACE_PERMISSIONS] checkFullWorkspacePermission failed:', error.message);
    return {
      granted: false,
      reason: `Permission check failed: ${error.message}`,
    };
  }
}

/**
 * Gets all workspace IDs that a user has access to.
 * 
 * @param userId - The user ID
 * @returns Array of workspace IDs the user has access to
 * 
 * Requirements: 9.5
 */
export async function getUserWorkspaceIds(userId: string): Promise<string[]> {
  try {
    // 1. Fetch user profile
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      return [];
    }

    const user = userSnap.data() as UserProfile;
    const permissions: AppPermissionId[] = user.permissions || [];

    // System admins have access to all workspaces in their organization
    if (permissions.includes('system_admin')) {
      const workspacesSnap = await adminDb
        .collection('workspaces')
        .where('organizationId', '==', user.organizationId)
        .get();

      return workspacesSnap.docs.map((doc) => doc.id);
    }

    // 2. Fetch all roles for the user
    const rolesSnap = await adminDb
      .collection('roles')
      .where('organizationId', '==', user.organizationId)
      .get();

    const userRoles = rolesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Role))
      .filter((role) => user.roles.includes(role.id));

    // 3. Collect all workspace IDs from user roles
    const workspaceIds = new Set<string>();
    userRoles.forEach((role) => {
      role.workspaceIds.forEach((wsId) => workspaceIds.add(wsId));
    });

    return Array.from(workspaceIds);
  } catch (error: any) {
    console.error('>>> [WORKSPACE_PERMISSIONS] getUserWorkspaceIds failed:', error.message);
    return [];
  }
}

/**
 * Checks if a user has a specific permission using the new hierarchical coordinates.
 * This is the recommended way to check permissions for new features.
 */
export async function canUser(
  userId: string,
  section: keyof PermissionsSchema,
  feature: string,
  action: AppPermissionAction = 'view',
  workspaceId?: string // Optional workspace context
): Promise<PermissionCheckResult> {
  try {
    // 1. If workspaceId is provided, check access first
    if (workspaceId) {
      const workspaceAccess = await checkWorkspaceAccess(userId, workspaceId);
      if (!workspaceAccess.granted) return workspaceAccess;
    }

    // 2. Fetch user profile
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      return { granted: false, reason: 'User not found', level: 'organization' };
    }

    const user = userSnap.data() as UserProfile;
    
    // System Admin Bypass
    if (user.permissions?.includes('system_admin')) {
      return { granted: true, reason: 'System admin bypass' };
    }

    // 3. Evaluate Hierarchical Permission
    if (!user.permissionsSchema) {
      return { granted: false, reason: 'Hierarchical permissions not initialized for user', level: 'feature' };
    }

    const granted = evaluatePermission(user.permissionsSchema, section, feature, action);

    return {
      granted,
      reason: granted ? undefined : `Access denied for ${section}/${feature}:${action}`,
      level: 'feature'
    };
  } catch (error: any) {
    console.error(`>>> [WORKSPACE_PERMISSIONS] canUser failed:`, error.message);
    return { granted: false, reason: `Permission check error: ${error.message}` };
  }
}

/**
 * Bridge function to map legacy string permissions to new hierarchical coordinates.
 */
function mapLegacyPermissionToCoordinates(permission: AppPermissionId): { section: keyof PermissionsSchema, feature: string, action: AppPermissionAction } | null {
  const mapping: Record<AppPermissionId, { section: keyof PermissionsSchema, feature: string, action: AppPermissionAction }> = {
    schools_view: { section: 'operations', feature: 'campuses', action: 'view' },
    schools_edit: { section: 'operations', feature: 'campuses', action: 'edit' },
    prospects_view: { section: 'operations', feature: 'pipeline', action: 'view' },
    meetings_manage: { section: 'operations', feature: 'meetings', action: 'edit' },
    tasks_manage: { section: 'operations', feature: 'tasks', action: 'edit' },
    finance_view: { section: 'finance', feature: 'agreements', action: 'view' }, // Approximation
    finance_manage: { section: 'finance', feature: 'agreements', action: 'edit' }, // Approximation
    contracts_delete: { section: 'finance', feature: 'agreements', action: 'delete' },
    studios_view: { section: 'studios', feature: 'landingPages', action: 'view' }, // Approximation
    studios_edit: { section: 'studios', feature: 'landingPages', action: 'edit' }, // Approximation
    dashboard_manage: { section: 'operations', feature: 'dashboard', action: 'edit' },
    activities_view: { section: 'management', feature: 'activities', action: 'view' },
    tags_view: { section: 'studios', feature: 'tags', action: 'view' },
    tags_manage: { section: 'studios', feature: 'tags', action: 'edit' },
    tags_apply: { section: 'studios', feature: 'tags', action: 'view' }, // Using view as proxy
    forms_manage: { section: 'studios', feature: 'forms', action: 'edit' },
    fields_manage: { section: 'management', feature: 'fields', action: 'edit' },
    system_admin: { section: 'management', feature: 'users', action: 'view' }, // Dummy mapping, usually bypassed
    system_user_switch: { section: 'management', feature: 'users', action: 'edit' },
  };

  return mapping[permission] || null;
}
