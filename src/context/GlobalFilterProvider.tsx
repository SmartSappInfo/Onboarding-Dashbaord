'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';

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

  // Initialize state from URL, or default to current user if no URL param is present.
  React.useEffect(() => {
    if (isUserLoading) return;

    const assignedToParam = searchParams.get('assignedTo');
    
    if (assignedToParam) {
      // If a URL param exists, it is the source of truth.
      // The value 'all' in the URL corresponds to a `null` state (All Users).
      setAssignedUserIdState(assignedToParam === 'all' ? null : assignedToParam);
    } else if (user) {
      // On initial load without a param, default to the logged-in user.
      setAssignedUserIdState(user.uid);
    } else {
      // If no user and no param, default to showing all.
      setAssignedUserIdState(null);
    }
    setIsInitialized(true);
  // This effect runs on changes to searchParams (back/forward navigation) and when the user logs in.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isUserLoading, user]);

  const setAssignedUserId = React.useCallback((userId: string | null) => {
    // This function is called by the filter component to update the state and URL.
    setAssignedUserIdState(userId);

    const current = new URLSearchParams(Array.from(searchParams.entries()));

    // Represent the "All Users" state (`null`) as 'all' in the URL for persistence.
    if (userId === null) {
      current.set('assignedTo', 'all');
    } else {
      current.set('assignedTo', userId);
    }

    const search = current.toString();
    const query = search ? `?${search}` : '';
    
    // Use router.replace to update the URL without adding to browser history.
    router.replace(`${pathname}${query}`);
  }, [pathname, router, searchParams]);

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
