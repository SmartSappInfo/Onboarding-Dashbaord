
'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import type { UserProfile, Perspective } from '@/lib/types';

/**
 * @fileOverview Perspective Context Provider.
 * Manages the dynamic global perspective (Onboarding, Prospects, etc.) across the app.
 * Fetches perspectives from Firestore and allows administrators to manage them.
 */

type PerspectiveContextType = {
  activeTrack: string; // The Perspective ID
  activePerspective?: Perspective;
  setActiveTrack: (perspectiveId: string) => void;
  allowedPerspectives: Perspective[];
  isLoading: boolean;
};

const PerspectiveContext = React.createContext<PerspectiveContextType | undefined>(undefined);

export function PerspectiveProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTrack, setActiveTrackState] = React.useState<string>('onboarding');
  const [isInitialized, setIsInitialized] = React.useState(false);

  // 1. Fetch Dynamic Perspectives from Firestore
  const perspectivesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'perspectives'), orderBy('createdAt', 'asc')) : null, 
  [firestore]);
  const { data: perspectives, isLoading: isPerspectivesLoading } = useCollection<Perspective>(perspectivesQuery);

  // 2. Fetch User Profile for Permission Resolution
  const userRef = useMemoFirebase(() => 
    firestore && user ? doc(firestore, 'users', user.uid) : null, 
  [firestore, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userRef);

  // 3. Resolve Allowed Perspectives based on User Permissions
  const allowedPerspectives = React.useMemo(() => {
    if (!perspectives || isUserLoading || isProfileLoading || !profile) return [];

    const perms = profile.permissions || [];
    const isAdmin = perms.includes('system_admin' as any);
    
    // In a dynamic model, we could link permissions to perspective IDs.
    // For now, we maintain the onboarding/prospect logic but map them to dynamic objects.
    return perspectives.filter(p => {
        if (isAdmin) return true;
        if (p.id === 'onboarding') return perms.includes('schools_view');
        if (p.id === 'prospect') return perms.includes('prospects_view');
        return false; // New custom perspectives might require specific permissions logic
    });
  }, [perspectives, isUserLoading, isProfileLoading, profile]);

  // 4. Initial Synchronization
  React.useEffect(() => {
    if (isPerspectivesLoading || isProfileLoading || !isInitialized && allowedPerspectives.length > 0) {
        const urlTrack = searchParams.get('track');
        const stored = typeof window !== 'undefined' ? localStorage.getItem('activePerspective') : null;
        
        let initialId = 'onboarding';

        if (urlTrack && allowedPerspectives.find(p => p.id === urlTrack)) {
            initialId = urlTrack;
        } else if (stored && allowedPerspectives.find(p => p.id === stored)) {
            initialId = stored;
        } else if (allowedPerspectives.length > 0) {
            initialId = allowedPerspectives[0].id;
        }

        setActiveTrackState(initialId);
        setIsInitialized(true);
    }
  }, [isPerspectivesLoading, isProfileLoading, allowedPerspectives, searchParams, isInitialized]);

  // 5. Perspective Switcher Handler
  const setActiveTrack = React.useCallback((perspectiveId: string) => {
    if (allowedPerspectives.find(p => p.id === perspectiveId)) {
        setActiveTrackState(perspectiveId);
        localStorage.setItem('activePerspective', perspectiveId);
        
        const params = new URLSearchParams(searchParams.toString());
        params.set('track', perspectiveId);
        router.replace(`${pathname}?${params.toString()}`);
    }
  }, [allowedPerspectives, pathname, router, searchParams]);

  const activePerspective = React.useMemo(() => 
    perspectives?.find(p => p.id === activeTrack),
  [perspectives, activeTrack]);

  const value = React.useMemo(() => ({
    activeTrack,
    activePerspective,
    setActiveTrack,
    allowedPerspectives,
    isLoading: !isInitialized || isUserLoading || isProfileLoading || isPerspectivesLoading
  }), [activeTrack, activePerspective, setActiveTrack, allowedPerspectives, isInitialized, isUserLoading, isProfileLoading, isPerspectivesLoading]);

  return (
    <PerspectiveContext.Provider value={value}>
      {children}
    </PerspectiveContext.Provider>
  );
}

export function usePerspective() {
  const context = React.useContext(PerspectiveContext);
  if (context === undefined) {
    throw new Error('usePerspective must be used within a PerspectiveProvider');
  }
  return context;
}
