'use client';

import { useCallback } from 'react';
import { useUser } from '@/firebase';

// ─────────────────────────────────────────────────
// useBackofficeToken
// Returns a stable getter for the caller's Firebase ID token,
// passed to backoffice server actions in place of the old
// client-built `actor` object (which was spoofable).
//
// getIdToken() auto-refreshes near expiry — never force-refresh
// per call (avoids an extra network round-trip).
// ─────────────────────────────────────────────────

/** Thrown when a token is requested before auth has resolved a user. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('Not authenticated');
    this.name = 'NotAuthenticatedError';
  }
}

export function useBackofficeToken(): () => Promise<string> {
  const { user } = useUser();

  return useCallback(async (): Promise<string> => {
    if (!user) throw new NotAuthenticatedError();
    return user.getIdToken();
  }, [user]);
}
