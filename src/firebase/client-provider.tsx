'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []);

  // This useEffect hook will create a default admin user for development purposes.
  useEffect(() => {
    const seedAdminUser = async () => {
      // Ensure this only runs in a browser environment in development mode.
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        const auth = firebaseServices.auth;
        const email = 'admin@smartsapp.com';
        const password = 'SecurePassword123!';

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          // If creation is successful, immediately sign the user out so they can log in manually.
          if (userCredential && auth.currentUser) {
            await auth.signOut();
          }
        } catch (error: any) {
          // If the user already exists ('auth/email-already-in-use'), we can safely ignore the error.
          // For any other error, we log it to the console for debugging purposes.
          if (error.code !== 'auth/email-already-in-use') {
            console.error('Failed to seed admin user:', error);
          }
        }
      }
    };

    if (firebaseServices.auth) {
        seedAdminUser();
    }
  }, [firebaseServices.auth]);

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
