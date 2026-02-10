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
  const [isLoading, setIsLoading] = React.useState(true);

  // Initialize state from sessionStorage or URL param for persistence.
  const [assignedUserId, setAssignedUserIdState] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const storedValue = sessionStorage.getItem(STORAGE_KEY);
      if (storedValue) {
        return storedValue === 'all' ? null : storedValue;
      }
    }
    const param = searchParams.get('assignedTo');
    return param === 'all' ? null : param;
  });

  // Effect to set the initial default value and handle hydration.
  React.useEffect(() => {
    if (isUserLoading) return;

    let initialValue: string | null = null;
    const storedValue = sessionStorage.getItem(STORAGE_KEY);

    if (storedValue) {
      initialValue = storedValue === 'all' ? null : storedValue;
    } else if (user) {
      // Default to current user only if nothing is stored from a previous session.
      initialValue = user.uid;
    }
    
    setAssignedUserIdState(initialValue);
    setIsLoading(false);
  }, [isUserLoading, user]);
  

  const setAssignedUserId = React.useCallback((userId: string | null) => {
    setAssignedUserIdState(userId);
    // Persist to session storage so it sticks across page loads.
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, userId === null ? 'all' : userId);
    }
  }, []);

  // Effect to keep the URL in sync with the state from session storage.
  React.useEffect(() => {
    // Don't modify URL until the initial value has been set.
    if (isLoading) return;

    const currentParams = new URLSearchParams(Array.from(searchParams.entries()));
    const valueInState = assignedUserId === null ? 'all' : assignedUserId;

    // If the state has a value, ensure it's in the URL.
    if (valueInState && currentParams.get('assignedTo') !== valueInState) {
        currentParams.set('assignedTo', valueInState);
        const search = currentParams.toString();
        const query = search ? `?${search}` : '';
        // Use replace to update URL without adding to browser history.
        router.replace(`${pathname}${query}`);
    }
    
  }, [assignedUserId, pathname, router, searchParams, isLoading]);

  const value = React.useMemo(() => ({
    assignedUserId,
    setAssignedUserId,
    isLoading: isLoading || isUserLoading,
  }), [assignedUserId, setAssignedUserId, isLoading, isUserLoading]);

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
