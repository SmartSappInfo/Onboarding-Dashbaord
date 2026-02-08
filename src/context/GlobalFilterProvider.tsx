
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

  // Initialize state from URL or logged-in user
  React.useEffect(() => {
    if (isUserLoading) return;

    const assignedToParam = searchParams.get('assignedTo');
    if (assignedToParam) {
      setAssignedUserIdState(assignedToParam);
    } else if (user) {
      // Default to the current user's ID if no filter is set in the URL
      setAssignedUserIdState(user.uid);
    } else {
      setAssignedUserIdState(null); // Default to "All" if no user
    }
    setIsInitialized(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isUserLoading, user]);

  const setAssignedUserId = React.useCallback((userId: string | null) => {
    setAssignedUserIdState(userId);

    const current = new URLSearchParams(Array.from(searchParams.entries()));

    if (!userId) {
      current.delete('assignedTo');
    } else {
      current.set('assignedTo', userId);
    }

    const search = current.toString();
    const query = search ? `?${search}` : '';
    
    // Using router.replace to avoid adding to browser history
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
