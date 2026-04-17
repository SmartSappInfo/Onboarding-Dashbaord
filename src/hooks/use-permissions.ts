'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { PermissionsSchema, AppPermissionAction, AppPermissionId } from '@/lib/types';
import { evaluatePermission } from '@/lib/permissions-engine';

/**
 * @fileOverview Hierarchical Permissions Hook.
 * 
 * Provides a clean interface for checking component-level visibility 
 * and action enablement based on the RBAC system.
 */

interface UsePermissionsReturn {
  /** Check if a specific action is permitted in the current context */
  can: (section: keyof PermissionsSchema, feature: string, action?: AppPermissionAction) => boolean;
  /** Check a flat permission by ID */
  hasPermission: (perm: AppPermissionId) => boolean;
  /** Whether the current user is a system admin (bypasses checks) */
  isSystemAdmin: boolean;
  /** Whether the tenant context is still loading */
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { isSuperAdmin, hasPermission, permissionsSchema, isLoading } = useTenant();

  const can = React.useCallback((
    section: keyof PermissionsSchema,
    feature: string,
    action: AppPermissionAction = 'view'
  ): boolean => {
    if (isLoading) return false;
    if (isSuperAdmin) return true;
    
    // Evaluate the hierarchical schema if available
    if (permissionsSchema) {
      return evaluatePermission(permissionsSchema, section, feature, action);
    }
    
    return false;
  }, [isSuperAdmin, isLoading, permissionsSchema]);

  return React.useMemo(() => ({
    can,
    hasPermission,
    isSystemAdmin: isSuperAdmin,
    isLoading,
  }), [can, hasPermission, isSuperAdmin, isLoading]);
}
