'use client';

/**
 * @fileoverview Workspace & Organization Roles Hook.
 *
 * Single source of truth for querying and indexing the `roles` collection
 * scoped to an organization:
 * - Scoped by `where('organizationId', '==', organizationId)`.
 * - Provides an indexed `roleMap` (Map<roleId, Role>) for O(1) lookups.
 * - Adheres to zero `any/any[]` and Next.js client component best practices.
 */

import { useMemo } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Role } from '@/lib/types';

/**
 * Builds an O(1) lookup Map from an array of Role entities.
 */
export function useRoleLookup(roles: Role[] | null | undefined): Map<string, Role> {
  return useMemo(() => {
    const map = new Map<string, Role>();
    if (!roles) return map;
    for (const role of roles) {
      if (role && role.id) {
        map.set(role.id, role);
      }
    }
    return map;
  }, [roles]);
}

/**
 * Hook to retrieve all custom and system roles for an organization,
 * sorted alphabetically by role name.
 */
export function useWorkspaceRoles(organizationId: string | null | undefined) {
  const firestore = useFirestore();

  const rolesQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId) return null;
    return query(
      collection(firestore, 'roles'),
      where('organizationId', '==', organizationId),
      orderBy('name', 'asc')
    );
  }, [firestore, organizationId]);

  const { data: roles, isLoading, error } = useCollection<Role>(rolesQuery);
  const roleMap = useRoleLookup(roles);

  return {
    roles,
    roleMap,
    isLoading,
    error,
  };
}
