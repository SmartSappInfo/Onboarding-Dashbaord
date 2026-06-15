'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';
import { useTenant } from './TenantContext';

const STORAGE_KEY = 'globalAssignedUserId';

type GlobalFilterContextType = {
  assignedUserId: string | null;
  setAssignedUserId: (userId: string | null) => void;
  isLoading: boolean;
};

const GlobalFilterContext = React.createContext<GlobalFilterContextType | undefined>(undefined);

export function GlobalFilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isUserLoading } = useUser();
  const { activeWorkspace, isSuperAdmin, isLoading: isTenantLoading } = useTenant();
  
  const [assignedUserId, setAssignedUserIdState] = React.useState<string | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Determine if this user is restricted to assigned entities only in the current workspace
  const isRestricted = React.useMemo(() => {
    // Defaults to true (restricted) if not explicitly set to false
    return activeWorkspace?.restrictVisibilityToAssigned !== false && !isSuperAdmin;
  }, [activeWorkspace, isSuperAdmin]);

  // Compute the effective assigned user ID used for queries and filters
  const effectiveAssignedUserId = React.useMemo(() => {
    return isRestricted ? (user?.uid || null) : assignedUserId;
  }, [isRestricted, user, assignedUserId]);

  // 1. Initialize state once from URL, sessionStorage, or user default.
  React.useEffect(() => {
    // Wait for tenant data so we know whether visibility is restricted before
    // choosing a default filter (otherwise we'd default to the current user even
    // when the workspace is configured to show all entities).
    if (isUserLoading || isTenantLoading || isInitialized) {
      return;
    }

    const urlParam = searchParams.get('assignedTo');
    const storedValue = sessionStorage.getItem(STORAGE_KEY);

    let initialValue: string | null = null;

    // The order of priority for the initial value is: URL > sessionStorage > default.
    // When the workspace restricts visibility to assigned entities, default to the
    // logged-in user. Otherwise ("All Entities" scope), default to showing all.
    if (urlParam) {
      initialValue = urlParam === 'all' ? null : urlParam;
    } else if (storedValue) {
      initialValue = storedValue === 'all' ? null : storedValue;
    } else if (isRestricted && user) {
      initialValue = user.uid;
    }

    setAssignedUserIdState(initialValue);
    setIsInitialized(true); // Mark as initialized to prevent this from running again.
  }, [isUserLoading, isTenantLoading, isRestricted, user, searchParams, isInitialized]);
  

  // 2. This function is exposed to the app to change the filter.
  // It updates the state and persists the choice to sessionStorage for cross-page navigation.
  const setAssignedUserId = React.useCallback((userId: string | null) => {
    // If restricted, do not allow changing the assigned filter state
    if (isRestricted) return;
    setAssignedUserIdState(userId);
    sessionStorage.setItem(STORAGE_KEY, userId === null ? 'all' : userId);
  }, [isRestricted]);
  
  const searchParamsString = searchParams.toString();
  // 3. This effect syncs the state to the URL's query parameters.
  React.useEffect(() => {
    // Don't update the URL until after the initial state has been set.
    if (!isInitialized) return;

    const currentParams = new URLSearchParams(searchParamsString);
    const valueInState = effectiveAssignedUserId === null ? 'all' : effectiveAssignedUserId;

    // Only update the URL if it's out of sync with the state.
    if (currentParams.get('assignedTo') !== valueInState) {
        currentParams.set('assignedTo', valueInState);
        router.replace(`${pathname}?${currentParams.toString()}`);
    }
  }, [effectiveAssignedUserId, pathname, isInitialized, searchParamsString, router]);


  const value = React.useMemo(() => ({
    assignedUserId: effectiveAssignedUserId,
    setAssignedUserId,
    isLoading: !isInitialized || isUserLoading || isTenantLoading,
  }), [effectiveAssignedUserId, setAssignedUserId, isInitialized, isUserLoading, isTenantLoading]);

  return (
    <GlobalFilterContext.Provider value={value}>
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilter() {
  const context = React.useContext(GlobalFilterContext);
  if (context === undefined) {
    throw new Error('useGlobalFilter must be used within a GlobalFilterProvider');
  }
  return context;
}
