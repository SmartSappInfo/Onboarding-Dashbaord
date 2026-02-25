'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { usePathname } from 'next/navigation';


interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const pathname = usePathname();
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []);

  // This useEffect hook will create a default admin user for development purposes.
  useEffect(() => {
    const seedAdminUser = async () => {
      // Disable background auth attempts on public form pages to prevent 
      // network-request-failed errors during large payload submissions.
      if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development' || pathname?.startsWith('/forms/')) {
        return;
      }
      
      const { auth, firestore } = firebaseServices;

      // Don't run if a user is already logged in
      if (auth.currentUser) {
        return;
      }

      const email = 'admin@smartsapp.com';
      const password = 'SecurePassword123!';

      try {
        // Set persistence to ensure the dev user stays logged in
        await setPersistence(auth, browserLocalPersistence);
        // Attempt to sign in
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error: any) {
        if (error.code === 'auth/network-request-failed') {
            console.warn("Dev Seeder: Network request failed. Skipping admin user seed.");
            return;
        }
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
          // If user doesn't exist, create them
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const userDocRef = doc(firestore, 'users', user.uid);
            await setDoc(userDocRef, {
              name: 'Default Admin',
              email: user.email,
              phone: '000-000-0000',
              isAuthorized: true,
              createdAt: new Date().toISOString(),
            });
            console.log("Default admin user created, authorized, and signed in.");
          } catch (creationError) {
            console.error("Failed to create default admin user:", creationError);
          }
        } else {
          // Other sign-in errors can be ignored in this dev script
        }
      }
    };

    if (firebaseServices.auth && firebaseServices.firestore) {
        seedAdminUser();
    }
  }, [firebaseServices, pathname]);

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
