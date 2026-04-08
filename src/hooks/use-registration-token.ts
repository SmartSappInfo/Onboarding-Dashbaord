'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { Meeting, MeetingRegistrant } from '@/lib/types';

interface UseRegistrationTokenResult {
  /** The current token from the URL, or null */
  token: string | null;
  /** The resolved registrant document if token is valid */
  registrant: MeetingRegistrant | null;
  /** Whether the token lookup is in progress */
  isLoading: boolean;
  /** Whether registration is enabled for this meeting */
  registrationEnabled: boolean;
  /** Whether registration is required to join (replaces join form) */
  registrationRequired: boolean;
  /** Set a new token (used after registration) */
  setToken: (token: string) => void;
  /** Clear the token (used for "not you?" flow) */
  clearToken: () => void;
}

/**
 * Hook that resolves a registrant token from the URL search params.
 * Used by hero components to decide whether to show:
 *   - JoinMeetingForm (no registration)
 *   - MeetingRegistrationForm (registration required, no valid token)
 *   - MeetingRegisteredState (registration required, valid token)
 */
export function useRegistrationToken(meeting: Meeting): UseRegistrationTokenResult {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();

  const [token, setTokenState] = useState<string | null>(searchParams.get('token'));
  const [registrant, setRegistrant] = useState<MeetingRegistrant | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const registrationEnabled = !!meeting.registrationEnabled;
  const registrationRequired = !!meeting.registrationEnabled && !!meeting.registrationRequiredToJoin;

  // Resolve token → registrant
  useEffect(() => {
    if (!token || !firestore || !registrationEnabled) {
      setRegistrant(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const resolveToken = async () => {
      try {
        const registrantsRef = collection(firestore, `meetings/${meeting.id}/registrants`);
        const q = query(registrantsRef, where('token', '==', token), limit(1));
        const snapshot = await getDocs(q);

        if (!cancelled) {
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            setRegistrant({ id: doc.id, ...doc.data() } as MeetingRegistrant);
          } else {
            // Invalid token — clear it
            setRegistrant(null);
            setTokenState(null);
          }
        }
      } catch (error) {
        console.error('Token resolution failed:', error);
        if (!cancelled) {
          setRegistrant(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    resolveToken();
    return () => { cancelled = true; };
  }, [token, firestore, meeting.id, registrationEnabled]);

  const setToken = (newToken: string) => {
    setTokenState(newToken);
    // Update URL without full navigation
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('token', newToken);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const clearToken = () => {
    setTokenState(null);
    setRegistrant(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    }
  };

  return {
    token,
    registrant,
    isLoading,
    registrationEnabled,
    registrationRequired,
    setToken,
    clearToken,
  };
}
