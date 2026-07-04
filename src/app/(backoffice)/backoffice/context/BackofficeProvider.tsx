'use client';

import * as React from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useDoc, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import type { BackofficeRole, BackofficeModule, BackofficeAction } from '@/lib/backoffice/backoffice-types';
import { evaluateBackofficePermission } from '@/lib/backoffice/backoffice-rbac';

// ─────────────────────────────────────────────────
// Backoffice Provider Context
// Resolves the user's backoffice roles and provides
// a unified permission-check API for the control plane.
//
// RBAC evaluation is shared with the server via
// backoffice-rbac.ts — a pure, client-safe leaf module
// (type-only imports, no Admin SDK). Single source of
// truth: client checks mirror exactly what the server
// enforces in backoffice-auth.ts.
// ─────────────────────────────────────────────────

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
    if (profile.permissions?.includes('system_admin')) {
      return ['super_admin'];
    }

    return profile.backofficeRoles ?? [];
  }, [profile]);

  // Permission check function — delegates to the shared RBAC engine
  const can = React.useCallback(
    (module: BackofficeModule, action: BackofficeAction = 'view'): boolean =>
      evaluateBackofficePermission(roles, module, action),
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
