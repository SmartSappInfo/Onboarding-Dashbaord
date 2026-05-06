
'use client';

/**
 * FirebaseClientProvider — Pure context provider for Firebase services.
 *
 * Initializes the Firebase app singleton and passes auth, firestore,
 * and app references to the FirebaseProvider context. Contains NO
 * route-specific logic, no bootstrap, and no auto-login side effects.
 *
 * This provider is mounted in the root layout and wraps the entire app
 * tree, including public pages (surveys, campaigns, etc.). It must
 * remain side-effect-free to prevent cross-page auth interference.
 *
 * Architectural notes:
 * - Per Vercel `server-serialization`: passes only stable service refs
 * - Per Vercel `rerender-dependencies`: no pathname or route deps
 * - Dev bootstrap is handled by FirebaseBootstrap (admin-only)
 */

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
