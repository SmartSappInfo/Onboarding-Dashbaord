'use client';

import * as React from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useDoc, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import type { BackofficeRole, BackofficeModule, BackofficeAction } from '@/lib/backoffice/backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Provider Context
// Resolves the user's backoffice roles and provides
// a unified permission-check API for the control plane.
// ─────────────────────────────────────────────────

/**
 * Client-side RBAC check — mirrors the server-side ROLE_MATRIX.
 * Duplicated here intentionally to avoid importing server-only code
 * into client components (bundle-barrel-imports).
 */
const ROLE_MATRIX: Record<BackofficeRole, Record<BackofficeModule, Set<BackofficeAction>>> = {
  super_admin: {
    dashboard: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    organizations: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    workspaces: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    features: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    templates: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    fields: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    assets: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    operations: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    audit: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    settings: new Set(['view', 'create', 'edit', 'delete', 'execute']),
  },
  tenant_admin_ops: {
    dashboard: new Set(['view']),
    organizations: new Set(['view', 'create', 'edit']),
    workspaces: new Set(['view', 'create', 'edit']),
    features: new Set(['view']),
    templates: new Set(['view']),
    fields: new Set(['view']),
    assets: new Set(['view']),
    operations: new Set(['view']),
    audit: new Set(['view']),
    settings: new Set(['view']),
  },
  release_admin: {
    dashboard: new Set(['view']),
    organizations: new Set(['view']),
    workspaces: new Set(['view']),
    features: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    templates: new Set(['view']),
    fields: new Set(['view']),
    assets: new Set(['view']),
    operations: new Set(['view']),
    audit: new Set(['view']),
    settings: new Set(['view']),
  },
  template_admin: {
    dashboard: new Set(['view']),
    organizations: new Set(['view']),
    workspaces: new Set(['view']),
    features: new Set(['view']),
    templates: new Set(['view', 'create', 'edit', 'delete']),
    fields: new Set(['view', 'create', 'edit']),
    assets: new Set(['view', 'create', 'edit', 'delete']),
    operations: new Set(['view']),
    audit: new Set(['view']),
    settings: new Set(['view']),
  },
  support_admin: {
    dashboard: new Set(['view']),
    organizations: new Set(['view', 'edit']),
    workspaces: new Set(['view', 'edit']),
    features: new Set(['view']),
    templates: new Set(['view']),
    fields: new Set(['view']),
    assets: new Set(['view']),
    operations: new Set(['view', 'execute']),
    audit: new Set(['view']),
    settings: new Set(['view']),
  },
  security_auditor: {
    dashboard: new Set(['view']),
    organizations: new Set(['view']),
    workspaces: new Set(['view']),
    features: new Set(['view']),
    templates: new Set(['view']),
    fields: new Set(['view']),
    assets: new Set(['view']),
    operations: new Set(['view']),
    audit: new Set(['view']),
    settings: new Set(['view']),
  },
  migration_admin: {
    dashboard: new Set(['view']),
    organizations: new Set(['view']),
    workspaces: new Set(['view']),
    features: new Set(['view']),
    templates: new Set(['view']),
    fields: new Set(['view']),
    assets: new Set(['view']),
    operations: new Set(['view', 'create', 'edit', 'execute']),
    audit: new Set(['view']),
    settings: new Set(['view']),
  },
  readonly_auditor: {
    dashboard: new Set(['view']),
    organizations: new Set(['view']),
    workspaces: new Set(['view']),
    features: new Set(['view']),
    templates: new Set(['view']),
    fields: new Set(['view']),
    assets: new Set(['view']),
    operations: new Set(['view']),
    audit: new Set(['view']),
    settings: new Set(['view']),
  },
};

interface BackofficeContextType {
  /** User's backoffice roles */
  roles: BackofficeRole[];
  /** Check if user can perform an action on a module */
  can: (module: BackofficeModule, action?: BackofficeAction) => boolean;
  /** Whether the user has any backoffice access */
  hasAccess: boolean;
  /** Whether the user is a backoffice super admin */
  isSuperAdmin: boolean;
  /** User profile data */
  profile: UserProfile | null;
  /** Whether context is still loading */
  isLoading: boolean;
}

const BackofficeContext = React.createContext<BackofficeContextType | undefined>(undefined);

export function BackofficeProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Fetch user profile to resolve backoffice roles
  const userRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userRef);

  // Derive backoffice roles from profile (rerender-derived-state)
  const roles = React.useMemo<BackofficeRole[]>(() => {
    if (!profile) return [];

    // Super admins in the main app automatically get backoffice super_admin
    if (profile.permissions?.includes('system_admin' as any)) {
      return ['super_admin'];
    }

    return profile.backofficeRoles ?? [];
  }, [profile]);

  // Permission check function
  const can = React.useCallback(
    (module: BackofficeModule, action: BackofficeAction = 'view'): boolean => {
      if (roles.length === 0) return false;

      for (const role of roles) {
        const modulePerms = ROLE_MATRIX[role]?.[module];
        if (modulePerms?.has(action)) return true;
      }
      return false;
    },
    [roles]
  );

  // Derived booleans (rerender-derived-state — computed during render, not in effects)
  const hasAccess = roles.length > 0;
  const isSuperAdmin = roles.includes('super_admin');
  const isLoading = isUserLoading || isProfileLoading;

  const value = React.useMemo<BackofficeContextType>(
    () => ({
      roles,
      can,
      hasAccess,
      isSuperAdmin,
      profile: profile ?? null,
      isLoading,
    }),
    [roles, can, hasAccess, isSuperAdmin, profile, isLoading]
  );

  return (
    <BackofficeContext.Provider value={value}>
      {children}
    </BackofficeContext.Provider>
  );
}

/**
 * Hook to access backoffice context.
 * Must be used within a BackofficeProvider.
 */
export function useBackoffice(): BackofficeContextType {
  const context = React.useContext(BackofficeContext);
  if (context === undefined) {
    throw new Error('useBackoffice must be used within a BackofficeProvider');
  }
  return context;
}
