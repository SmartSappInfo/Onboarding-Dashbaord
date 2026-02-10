'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';

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
  
  const [assignedUserId, setAssignedUserIdState] = React.useState<string | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // 1. Initialize state once from URL, sessionStorage, or user default.
  React.useEffect(() => {
    // This effect should only run once after the user has been loaded.
    if (isUserLoading || isInitialized) {
      return;
    }

    const urlParam = searchParams.get('assignedTo');
    const storedValue = sessionStorage.getItem(STORAGE_KEY);
    
    let initialValue: string | null = null;

    // The order of priority for the initial value is: URL > sessionStorage > logged-in user
    if (urlParam) {
      initialValue = urlParam === 'all' ? null : urlParam;
    } else if (storedValue) {
      initialValue = storedValue === 'all' ? null : storedValue;
    } else if (user) {
      initialValue = user.uid;
    }

    setAssignedUserIdState(initialValue);
    setIsInitialized(true); // Mark as initialized to prevent this from running again.
  }, [isUserLoading, user, searchParams, isInitialized]);
  

  // 2. This function is exposed to the app to change the filter.
  // It updates the state and persists the choice to sessionStorage for cross-page navigation.
  const setAssignedUserId = React.useCallback((userId: string | null) => {
    setAssignedUserIdState(userId);
    sessionStorage.setItem(STORAGE_KEY, userId === null ? 'all' : userId);
  }, []);
  
  const searchParamsString = searchParams.toString();
  // 3. This effect syncs the state to the URL's query parameters.
  React.useEffect(() => {
    // Don't update the URL until after the initial state has been set.
    if (!isInitialized) return;

    const currentParams = new URLSearchParams(searchParamsString);
    const valueInState = assignedUserId === null ? 'all' : assignedUserId;

    // Only update the URL if it's out of sync with the state.
    if (currentParams.get('assignedTo') !== valueInState) {
        currentParams.set('assignedTo', valueInState);
        router.replace(`${pathname}?${currentParams.toString()}`);
    }
  }, [assignedUserId, pathname, isInitialized, searchParamsString, router]);


  const value = React.useMemo(() => ({
    assignedUserId,
    setAssignedUserId,
    isLoading: !isInitialized || isUserLoading,
  }), [assignedUserId, setAssignedUserId, isInitialized, isUserLoading]);

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
