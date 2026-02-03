
'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';


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
        const { auth, firestore } = firebaseServices;
        const email = 'admin@smartsapp.com';
        const password = 'SecurePassword123!';

        try {
          // Check if user exists by trying to sign in first
          await signInWithEmailAndPassword(auth, email, password);
          console.log("Admin user already exists.");
          await auth.signOut();
        } catch (error: any) {
          if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
            // User does not exist, create them
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
              console.log("Default admin user created and authorized.");
              await auth.signOut(); // Sign out after seeding
            } catch (creationError) {
              console.error("Failed to create default admin user:", creationError);
            }
          } else {
            // Other sign-in error
            console.error("Error checking for admin user:", error);
          }
        }
      }
    };

    if (firebaseServices.auth && firebaseServices.firestore) {
        seedAdminUser();
    }
  }, [firebaseServices]);

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

    