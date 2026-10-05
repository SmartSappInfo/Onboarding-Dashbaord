'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import type { WorkspaceEntity, Task, Deal } from '@/lib/types';

/**
 * useWorkspaceVisibility
 *
 * Central hook for evaluating workspace-level tri-domain visibility scoping.
 * Enforces that standard users see only their assigned or created items by default,
 * while allowing system and workspace admins to bypass the restriction.
 *
 * ARCHITECTURAL GUIDELINES (Rule 10):
 * - Fail-closed defaults: if any of the three settings is not explicitly false, it evaluates to true.
 * - Tri-Domain:
 *   1. Entities (restrictEntitiesToAssigned / restrictToAssigned)
 *   2. Deals (restrictDealsToAssigned)
 *   3. Tasks (restrictTasksToAssigned)
 * - Assignee OR Creator visibility: A restricted user can view records assigned to them OR created by them.
 * - isWorkspaceAdmin: Users with admin privileges within the workspace or superadmins bypass restrictions.
 */
export function useWorkspaceVisibility() {
  const { activeWorkspace, isSuperAdmin, isWorkspaceAdmin } = useTenant();
  const { user } = useUser();

  const userIsAdmin = Boolean(isSuperAdmin || isWorkspaceAdmin);

  // 1. Entities Visibility Scope
  const restrictEntitiesToAssigned = React.useMemo(() => {
    if (userIsAdmin) return false;
    return activeWorkspace?.restrictVisibilityToAssigned !== false;
  }, [activeWorkspace?.restrictVisibilityToAssigned, userIsAdmin]);

  // 2. Deals Visibility Scope
  const restrictDealsToAssigned = React.useMemo(() => {
    if (userIsAdmin) return false;
    return activeWorkspace?.restrictDealsVisibilityToAssigned !== false;
  }, [activeWorkspace?.restrictDealsVisibilityToAssigned, userIsAdmin]);

  // 3. Tasks Visibility Scope
  const restrictTasksToAssigned = React.useMemo(() => {
    if (userIsAdmin) return false;
    return activeWorkspace?.restrictTasksVisibilityToAssigned !== false;
  }, [activeWorkspace?.restrictTasksVisibilityToAssigned, userIsAdmin]);

  // Evaluators
  const canViewEntity = React.useCallback(
    (entity: Partial<WorkspaceEntity> | null | undefined) => {
      if (!entity) return false;
      if (!restrictEntitiesToAssigned) return true;
      return entity.assignedTo?.userId === user?.uid || entity.createdBy === user?.uid;
    },
    [restrictEntitiesToAssigned, user?.uid]
  );

  const canViewDeal = React.useCallback(
    (deal: Partial<Deal> | null | undefined) => {
      if (!deal) return false;
      if (!restrictDealsToAssigned) return true;
      return deal.assignedTo?.userId === user?.uid || deal.createdBy === user?.uid;
    },
    [restrictDealsToAssigned, user?.uid]
  );

  const canViewTask = React.useCallback(
    (task: Partial<Task> | null | undefined) => {
      if (!task) return false;
      if (!restrictTasksToAssigned) return true;
      if (task.createdBy === user?.uid) return true;
      if (!task.assignedTo) return false;
      if (Array.isArray(task.assignedTo)) {
        return (
          task.assignedTo.includes(user?.uid || '') ||
          Boolean(user?.email && task.assignedTo.includes(user.email))
        );
      }
      return (
        task.assignedTo === user?.uid ||
        Boolean(user?.email && task.assignedTo === user.email)
      );
    },
    [restrictTasksToAssigned, user?.uid, user?.email]
  );

  return {
    isWorkspaceAdmin: userIsAdmin,
    // Alias for backward compatibility with existing entities components
    restrictToAssigned: restrictEntitiesToAssigned,
    restrictEntitiesToAssigned,
    restrictDealsToAssigned,
    restrictTasksToAssigned,
    canViewEntity,
    canViewDeal,
    canViewTask,
    currentUserUid: user?.uid,
  };
}
