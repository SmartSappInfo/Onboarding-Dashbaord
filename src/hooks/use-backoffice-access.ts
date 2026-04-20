'use client';

import * as React from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useDoc, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import type { BackofficeRole } from '@/lib/backoffice/backoffice-types';

/**
 * Hook to check if the current user has backoffice access.
 * This is a lightweight version that only checks access without full backoffice context.
 */
export function useBackofficeAccess() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Fetch user profile to resolve backoffice roles
  const userRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userRef);

  // Derive backoffice access from profile
  const hasBackofficeAccess = React.useMemo<boolean>(() => {
    if (!profile) return false;

    // Super admins in the main app automatically get backoffice access
    if (profile.permissions?.includes('system_admin' as any)) {
      return true;
    }

    // Check if user has any backoffice roles
    return (profile.backofficeRoles ?? []).length > 0;
  }, [profile]);

  const isLoading = isUserLoading || isProfileLoading;

  return {
    hasBackofficeAccess,
    isLoading,
  };
}