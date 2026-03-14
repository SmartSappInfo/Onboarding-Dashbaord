
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
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
      if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development' || pathname?.startsWith('/forms/')) {
        return;
      }
      
      const { auth, firestore } = firebaseServices;

      const email = 'admin@smartsapp.com';
      const password = 'SecurePassword123!';

      try {
        await setPersistence(auth, browserLocalPersistence);
        
        let user;
        if (auth.currentUser) {
            user = auth.currentUser;
        } else {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            user = userCredential.user;
        }

        const userDocRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        
        if (!userSnap.exists() || !userSnap.data().isAuthorized || !userSnap.data().roles?.includes('administrator')) {
            await setDoc(userDocRef, {
                name: 'Default Admin',
                email: user.email,
                phone: '000-000-0000',
                isAuthorized: true,
                roles: ['administrator'], 
                permissions: [
                    'schools_view', 'schools_edit', 'prospects_view', 'prospects_edit',
                    'finance_view', 'finance_manage', 'contracts_delete',
                    'studios_view', 'studios_edit', 'system_admin', 'system_user_switch', 
                    'meetings_manage', 'tasks_manage', 'activities_view'
                ],
                createdAt: userSnap.exists() ? userSnap.data().createdAt : new Date().toISOString(),
            }, { merge: true });
            console.log("Super-Admin record ensured with multi-track permissions.");
        }

      } catch (error: any) {
        if (error.code === 'auth/network-request-failed') return;
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(firestore, 'users', user.uid), {
              name: 'Default Admin',
              email: user.email,
              phone: '000-000-0000',
              isAuthorized: true,
              roles: ['administrator'],
              permissions: [
                'schools_view', 'schools_edit', 'prospects_view', 'prospects_edit',
                'finance_view', 'finance_manage', 'contracts_delete',
                'studios_view', 'studios_edit', 'system_admin', 'system_user_switch', 
                'meetings_manage', 'tasks_manage', 'activities_view'
              ],
              createdAt: new Date().toISOString(),
            });
          } catch (creationError) {
            console.error("Failed to create default admin user:", creationError);
          }
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
