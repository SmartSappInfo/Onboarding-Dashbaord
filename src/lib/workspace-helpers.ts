/**
 * Workspace Helper Utilities
 * 
 * Provides utilities for workspace ID handling and multi-tenancy logic.
 * Created during Phase 2.2 of TypeScript error resolution.
 * 
 * Migration Context:
 * - All entities use workspaceIds: string[] (array for multi-workspace support)
 * - Activities use workspaceId: string (singular - belongs to one workspace)
 */

import type { School } from './types';

/**
 * Gets the primary workspace ID for a school.
 * 
 * @param school - The school object
 * @returns The first workspace ID or 'onboarding' as fallback
 * 
 * @example
 * const workspaceId = getPrimaryWorkspaceId(school);
 * await logActivity({ workspaceId, ... });
 */
export function getPrimaryWorkspaceId(school: School): string {
  if (!school.workspaceIds || school.workspaceIds.length === 0) {
    return 'onboarding'; // Default fallback
  }
  return school.workspaceIds[0];
}

/**
 * Checks if a school belongs to a specific workspace.
 * 
 * @param school - The school object
 * @param workspaceId - The workspace ID to check
 * @returns True if school is in the workspace
 * 
 * @example
 * if (isInWorkspace(school, 'prospect')) {
 *   // Handle prospect logic
 * }
 */
export function isInWorkspace(school: School, workspaceId: string): boolean {
  if (!school.workspaceIds) return false;
  return school.workspaceIds.includes(workspaceId);
}

/**
 * Checks if a school is a prospect.
 * 
 * @param school - The school object
 * @returns True if school is in prospect workspace
 * 
 * @example
 * if (isProspect(school)) {
 *   // Show prospect-specific UI
 * }
 */
export function isProspect(school: School): boolean {
  return isInWorkspace(school, 'prospect');
}

/**
 * Checks if a school is in onboarding.
 * 
 * @param school - The school object
 * @returns True if school is in onboarding workspace
 * 
 * @example
 * if (isOnboarding(school)) {
 *   // Show onboarding checklist
 * }
 */
export function isOnboarding(school: School): boolean {
  return isInWorkspace(school, 'onboarding');
}

/**
 * Checks if a school is active (not in prospect or onboarding).
 * 
 * @param school - The school object
 * @returns True if school is in active workspace
 * 
 * @example
 * if (isActive(school)) {
 *   // Enable full features
 * }
 */
export function isActive(school: School): boolean {
  return isInWorkspace(school, 'active');
}

/**
 * Gets all workspace IDs for a school as a comma-separated string.
 * 
 * @param school - The school object
 * @returns Comma-separated workspace IDs
 * 
 * @example
 * const workspaces = getWorkspaceIdsString(school);
 * // Returns: "onboarding,active"
 */
export function getWorkspaceIdsString(school: School): string {
  if (!school.workspaceIds || school.workspaceIds.length === 0) {
    return 'onboarding';
  }
  return school.workspaceIds.join(',');
}

/**
 * Gets a display-friendly workspace name.
 * 
 * @param workspaceId - The workspace ID
 * @returns Human-readable workspace name
 * 
 * @example
 * const name = getWorkspaceName('onboarding');
 * // Returns: "Onboarding"
 */
export function getWorkspaceName(workspaceId: string): string {
  const names: Record<string, string> = {
    'onboarding': 'Onboarding',
    'prospect': 'Prospect',
    'active': 'Active',
    'churned': 'Churned',
  };
  return names[workspaceId] || workspaceId.charAt(0).toUpperCase() + workspaceId.slice(1);
}
