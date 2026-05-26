'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import type { WorkspaceEntity } from '@/lib/types';

/**
 * useWorkspaceVisibility
 * 
 * Central hook for evaluating workspace-level entity visibility scoping.
 * Enforces that standard users see only their assigned entities by default,
 * while allowing system admins (system_admin permission) to bypass the restriction.
 */
export function useWorkspaceVisibility() {
  const { activeWorkspace, isSuperAdmin } = useTenant();
  const { user } = useUser();

  const restrictToAssigned = React.useMemo(() => {
    // If the setting is not explicitly false, it defaults to true (restricted)
    return activeWorkspace?.restrictVisibilityToAssigned !== false && !isSuperAdmin;
  }, [activeWorkspace, isSuperAdmin]);

  const canViewEntity = React.useCallback((entity: WorkspaceEntity | null | undefined) => {
    if (!entity) return false;
    if (!restrictToAssigned) return true;
    return entity.assignedTo?.userId === user?.uid;
  }, [restrictToAssigned, user]);

  return {
    restrictToAssigned,
    canViewEntity,
    currentUserUid: user?.uid,
  };
}
