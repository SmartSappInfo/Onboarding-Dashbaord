'use server';

import type { IndustryVertical } from './types';
import { getWorkspaceIndustry } from './industry-cache';
import { adminDb } from './firebase-admin';
import type { Workspace } from './types';

/**
 * @fileOverview Industry-specific permission system
 * 
 * Implements Requirement 16: Industry-Specific Permissions
 * 
 * This module extends the base permission system with industry-specific permissions.
 * Each industry vertical has its own set of permissions that are only valid within
 * workspaces of that industry type.
 * 
 * Permission validation occurs in two stages:
 * 1. Industry validation: Check if permission is valid for workspace's industry
 * 2. Role validation: Check if user's role grants the permission
 */

/**
 * Permission type covering generic and industry-specific permissions
 * 
 * Generic permissions apply to all industries.
 * Industry-specific permissions are prefixed with the industry name.
 */
export type Permission =
  // Generic permissions (apply to all industries)
  | 'contacts_view'
  | 'contacts_edit'
  | 'contacts_create'
  | 'contacts_delete'
  | 'pipeline_view'
  | 'pipeline_manage'
  | 'finance_view'
  | 'finance_manage'
  // SaaS permissions
  | 'saas_trials_manage'
  | 'saas_usage_view'
  | 'saas_health_view'
  | 'saas_subscriptions_manage'
  | 'saas_support_manage'
  | 'saas_onboarding_manage'
  // School Enrollment permissions
  | 'schoolenrollment_admissions_manage'
  | 'schoolenrollment_enrollments_manage'
  | 'schoolenrollment_visits_manage'
  // Law permissions
  | 'law_matters_manage'
  | 'law_conflict_check'
  | 'law_time_tracking'
  | 'law_consultations_manage'
  | 'law_documents_manage'
  // Marketing permissions
  | 'marketing_campaigns_manage'
  | 'marketing_reports_view'
  | 'marketing_deliverables_manage'
  | 'marketing_proposals_manage'
  // Real Estate permissions
  | 'realestate_properties_manage'
  | 'realestate_viewings_manage'
  | 'realestate_offers_manage'
  | 'realestate_deals_manage'
  // Consultancy permissions
  | 'consultancy_engagements_manage'
  | 'consultancy_outcomes_view'
  | 'consultancy_discoveries_manage'
  | 'consultancy_milestones_manage';

/**
 * Returns all valid permissions for a given industry vertical.
 * 
 * This includes:
 * - Base permissions (valid for all industries)
 * - Industry-specific permissions (only for the specified industry)
 * 
 * @param industry - The industry vertical
 * @returns Array of valid permissions for the industry
 * 
 * Requirements: 16.1, 16.2
 */
export function getIndustryPermissions(industry: IndustryVertical): Permission[] {
  const basePermissions: Permission[] = [
    'contacts_view',
    'contacts_edit',
    'contacts_create',
    'contacts_delete',
    'pipeline_view',
    'pipeline_manage',
    'finance_view',
    'finance_manage',
  ];
  
  const industryPermissions: Record<IndustryVertical, Permission[]> = {
    SaaS: [
      'saas_trials_manage',
      'saas_usage_view',
      'saas_health_view',
      'saas_subscriptions_manage',
      'saas_support_manage',
      'saas_onboarding_manage',
    ],
    SchoolEnrollment: [
      'schoolenrollment_admissions_manage',
      'schoolenrollment_enrollments_manage',
      'schoolenrollment_visits_manage',
    ],
    Law: [
      'law_matters_manage',
      'law_conflict_check',
      'law_time_tracking',
      'law_consultations_manage',
      'law_documents_manage',
    ],
    Marketing: [
      'marketing_campaigns_manage',
      'marketing_reports_view',
      'marketing_deliverables_manage',
      'marketing_proposals_manage',
    ],
    RealEstate: [
      'realestate_properties_manage',
      'realestate_viewings_manage',
      'realestate_offers_manage',
      'realestate_deals_manage',
    ],
    Consultancy: [
      'consultancy_engagements_manage',
      'consultancy_outcomes_view',
      'consultancy_discoveries_manage',
      'consultancy_milestones_manage',
    ],
  };
  
  return [...basePermissions, ...industryPermissions[industry]];
}

/**
 * Checks if a permission is valid for a given industry.
 * 
 * @param permission - The permission to check
 * @param industry - The industry vertical
 * @returns True if the permission is valid for the industry
 * 
 * Requirements: 16.8
 */
export function isPermissionValidForIndustry(
  permission: Permission,
  industry: IndustryVertical
): boolean {
  const allowedPermissions = getIndustryPermissions(industry);
  return allowedPermissions.includes(permission);
}

/**
 * Checks if a user has a specific permission in a workspace.
 * 
 * This function performs two-stage validation:
 * 1. Validates that the permission is valid for the workspace's industry
 * 2. Checks if the user's role grants the permission
 * 
 * @param userId - The user ID to check
 * @param workspaceId - The workspace ID
 * @param permission - The permission to check
 * @returns True if the user has the permission
 * 
 * Requirements: 16.8, 16.9
 */
export async function checkPermission(
  userId: string,
  workspaceId: string,
  permission: Permission
): Promise<boolean> {
  try {
    // 1. Get workspace industry
    const { industry } = await getWorkspaceIndustry(workspaceId);
    
    // 2. Validate permission is valid for this industry
    if (!isPermissionValidForIndustry(permission, industry)) {
      console.warn(
        `[PERMISSIONS] Permission '${permission}' is not valid for industry '${industry}' in workspace '${workspaceId}'`
      );
      return false;
    }
    
    // 3. Check role-based access
    return await roleHasPermission(userId, workspaceId, permission);
  } catch (error: any) {
    console.error('[PERMISSIONS] checkPermission failed:', error.message);
    return false;
  }
}

/**
 * Checks if a user's role grants a specific permission in a workspace.
 * 
 * This is a placeholder implementation that should be replaced with
 * actual role-based permission checking logic.
 * 
 * @param userId - The user ID
 * @param workspaceId - The workspace ID
 * @param permission - The permission to check
 * @returns True if the user's role grants the permission
 * 
 * Requirements: 16.9
 */
async function roleHasPermission(
  userId: string,
  workspaceId: string,
  permission: Permission
): Promise<boolean> {
  try {
    // Fetch user profile
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      return false;
    }

    const user = userSnap.data();
    
    // System admins have all permissions
    if (user?.permissions?.includes('system_admin')) {
      return true;
    }

    // Check if user has the permission directly
    if (user?.permissions?.includes(permission)) {
      return true;
    }

    // TODO: Implement role-based permission checking
    // This should:
    // 1. Fetch user's roles for the workspace
    // 2. Check if any role grants the permission
    // 3. Return true if permission is granted
    
    return false;
  } catch (error: any) {
    console.error('[PERMISSIONS] roleHasPermission failed:', error.message);
    return false;
  }
}

/**
 * Gets all permissions available to a user in a workspace.
 * 
 * This returns the intersection of:
 * - Permissions valid for the workspace's industry
 * - Permissions granted by the user's roles
 * 
 * @param userId - The user ID
 * @param workspaceId - The workspace ID
 * @returns Array of permissions available to the user
 * 
 * Requirements: 16.10
 */
export async function getUserPermissionsInWorkspace(
  userId: string,
  workspaceId: string
): Promise<Permission[]> {
  try {
    // 1. Get workspace industry
    const { industry } = await getWorkspaceIndustry(workspaceId);
    
    // 2. Get all valid permissions for this industry
    const validPermissions = getIndustryPermissions(industry);
    
    // 3. Filter to permissions the user actually has
    const userPermissions: Permission[] = [];
    
    for (const permission of validPermissions) {
      const hasPermission = await roleHasPermission(userId, workspaceId, permission);
      if (hasPermission) {
        userPermissions.push(permission);
      }
    }
    
    return userPermissions;
  } catch (error: any) {
    console.error('[PERMISSIONS] getUserPermissionsInWorkspace failed:', error.message);
    return [];
  }
}
