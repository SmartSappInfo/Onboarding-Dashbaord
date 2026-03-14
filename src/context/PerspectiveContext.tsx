'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile, InstitutionalTrack } from '@/lib/types';

/**
 * @fileOverview Perspective Context Provider.
 * Manages the global institutional track ('onboarding' vs 'prospect') across the app.
 * Synchronizes with URL params and enforces permission-based access.
 */

type PerspectiveContextType = {
  activeTrack: InstitutionalTrack;
  setActiveTrack: (track: InstitutionalTrack) => void;
  allowedTracks: InstitutionalTrack[];
  isLoading: boolean;
};

const PerspectiveContext = React.createContext<PerspectiveContextType | undefined>(undefined);

export function PerspectiveProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTrack, setActiveTrackState] = React.useState<InstitutionalTrack>('onboarding');
  const [allowedTracks, setAllowedTracks] = React.useState<InstitutionalTrack[]>(['onboarding']);
  const [isInitialized, setIsInitialized] = React.useState(false);

  const userRef = useMemoFirebase(() => 
    firestore && user ? doc(firestore, 'users', user.uid) : null, 
  [firestore, user]);
  
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userRef);

  // 1. Resolve Permissions & Allowed Tracks
  React.useEffect(() => {
    if (isUserLoading || isProfileLoading || !profile) return;

    const perms = profile.permissions || [];
    const isAdmin = perms.includes('system_admin' as any);
    const canSeeSchools = perms.includes('schools_view') || isAdmin;
    const canSeeProspects = perms.includes('prospects_view') || isAdmin;

    const allowed: InstitutionalTrack[] = [];
    if (canSeeSchools) allowed.push('onboarding');
    if (canSeeProspects) allowed.push('prospect');

    setAllowedTracks(allowed);

    // Initial preference resolution: URL > Storage > Permission Default
    const urlTrack = searchParams.get('track') as InstitutionalTrack;
    const stored = typeof window !== 'undefined' ? localStorage.getItem('activePerspective') as InstitutionalTrack : null;
    
    let initial: InstitutionalTrack = 'onboarding';

    if (urlTrack && allowed.includes(urlTrack)) {
        initial = urlTrack;
    } else if (stored && allowed.includes(stored)) {
        initial = stored;
    } else if (canSeeProspects && !canSeeSchools) {
        initial = 'prospect';
    }

    setActiveTrackState(initial);
    setIsInitialized(true);
  }, [isUserLoading, isProfileLoading, profile, searchParams]);

  // 2. Perspective Switcher Handler
  const setActiveTrack = React.useCallback((track: InstitutionalTrack) => {
    if (allowedTracks.includes(track)) {
        setActiveTrackState(track);
        localStorage.setItem('activePerspective', track);
        
        // Sync to URL
        const params = new URLSearchParams(searchParams.toString());
        params.set('track', track);
        router.replace(`${pathname}?${params.toString()}`);
    }
  }, [allowedTracks, pathname, router, searchParams]);

  const value = React.useMemo(() => ({
    activeTrack,
    setActiveTrack,
    allowedTracks,
    isLoading: !isInitialized || isUserLoading || isProfileLoading
  }), [activeTrack, setActiveTrack, allowedTracks, isInitialized, isUserLoading, isProfileLoading]);

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
