
'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { UserProfile, Workspace } from '@/lib/types';

/**
 * @fileOverview Workspace Context Provider.
 * Manages the dynamic global workspace (formerly Perspective) across the app.
 * Fetches workspaces from Firestore and allows administrators to manage them.
 */

type WorkspaceContextType = {
  activeWorkspaceId: string; // The Workspace ID
  activeWorkspace?: Workspace;
  setActiveWorkspace: (workspaceId: string) => void;
  allowedWorkspaces: Workspace[];
  isLoading: boolean;
};

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeWorkspaceId, setActiveWorkspaceIdState] = React.useState<string>('onboarding');
  const [isInitialized, setIsInitialized] = React.useState(false);

  // 1. Fetch Dynamic Workspaces from Firestore
  const workspacesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'workspaces'), orderBy('createdAt', 'asc')) : null, 
  [firestore]);
  const { data: workspaces, isLoading: isWorkspacesLoading } = useCollection<Workspace>(workspacesQuery);

  // 2. Fetch User Profile for Permission Resolution
  const userRef = useMemoFirebase(() => 
    firestore && user ? doc(firestore, 'users', user.uid) : null, 
  [firestore, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userRef);

  // 3. Resolve Allowed Workspaces based on User Permissions
  const allowedWorkspaces = React.useMemo(() => {
    if (!workspaces || isUserLoading || isProfileLoading || !profile) return [];

    const perms = profile.permissions || [];
    const isAdmin = perms.includes('system_admin' as any);
    
    return workspaces.filter(w => {
        if (isAdmin) return true;
        // Map hardcoded permissions to specific workspace IDs for now
        if (w.id === 'onboarding') return perms.includes('schools_view');
        if (w.id === 'prospect') return perms.includes('prospects_view');
        return false;
    });
  }, [workspaces, isUserLoading, isProfileLoading, profile]);

  // 4. Initial Synchronization
  React.useEffect(() => {
    if (isWorkspacesLoading || isProfileLoading || !isInitialized && allowedWorkspaces.length > 0) {
        const urlTrack = searchParams.get('track');
        const stored = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspace') : null;
        
        let initialId = 'onboarding';

        if (urlTrack && allowedWorkspaces.find(w => w.id === urlTrack)) {
            initialId = urlTrack;
        } else if (stored && allowedWorkspaces.find(w => w.id === stored)) {
            initialId = stored;
        } else if (allowedWorkspaces.length > 0) {
            initialId = allowedWorkspaces[0].id;
        }

        setActiveWorkspaceIdState(initialId);
        setIsInitialized(true);
    }
  }, [isWorkspacesLoading, isProfileLoading, allowedWorkspaces, searchParams, isInitialized]);

  // 5. Workspace Switcher Handler
  const setActiveWorkspace = React.useCallback((workspaceId: string) => {
    if (allowedWorkspaces.find(w => w.id === workspaceId)) {
        setActiveWorkspaceIdState(workspaceId);
        localStorage.setItem('activeWorkspace', workspaceId);
        
        const params = new URLSearchParams(searchParams.toString());
        params.set('track', workspaceId);
        router.replace(`${pathname}?${params.toString()}`);
    }
  }, [allowedWorkspaces, pathname, router, searchParams]);

  const activeWorkspace = React.useMemo(() => 
    workspaces?.find(w => w.id === activeWorkspaceId),
  [workspaces, activeWorkspaceId]);

  const value = React.useMemo(() => ({
    activeWorkspaceId,
    activeWorkspace,
    setActiveWorkspace,
    allowedWorkspaces,
    isLoading: !isInitialized || isUserLoading || isProfileLoading || isWorkspacesLoading
  }), [activeWorkspaceId, activeWorkspace, setActiveWorkspace, allowedWorkspaces, isInitialized, isUserLoading, isProfileLoading, isWorkspacesLoading]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
