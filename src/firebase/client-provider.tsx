
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
    return initializeFirebase();
  }, []);

  useEffect(() => {
    const seedOrgArchitecture = async () => {
      if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development' || !pathname?.startsWith('/admin')) {
        return;
      }
      
      const { auth, firestore } = firebaseServices;
      const timestamp = new Date().toISOString();

      // 1. Ensure Root Organization
      const orgId = 'smartsapp-hq';
      const orgRef = doc(firestore, 'organizations', orgId);
      const orgSnap = await getDoc(orgRef);
      if (!orgSnap.exists()) {
          await setDoc(orgRef, {
              id: orgId,
              name: 'SmartSapp HQ',
              slug: 'smartsapp-hq',
              createdAt: timestamp,
              updatedAt: timestamp
          });
      }

      // 2. Ensure Core Workspaces anchored to Org
      const coreWorkspaces = [
          { id: 'onboarding', name: 'Client Onboarding', orgId, color: '#3B5FFF' },
          { id: 'prospect', name: 'Sales Leads', orgId, color: '#10b981' }
      ];

      for (const w of coreWorkspaces) {
          const wRef = doc(firestore, 'workspaces', w.id);
          const wSnap = await getDoc(wRef);
          if (!wSnap.exists()) {
              await setDoc(wRef, {
                  id: w.id,
                  organizationId: w.orgId,
                  name: w.name,
                  color: w.color,
                  status: 'active',
                  statuses: [],
                  createdAt: timestamp,
                  updatedAt: timestamp
              });
          }
      }

      // 3. Ensure Default Admin with Sovereignty
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
        
        if (!userSnap.exists() || !userSnap.data().organizationId) {
            await setDoc(userDocRef, {
                name: 'Default Admin',
                email: user.email,
                phone: '000-000-0000',
                isAuthorized: true,
                organizationId: orgId,
                workspaceIds: ['onboarding', 'prospect'], // Full access to Org hubs
                roles: ['administrator'], 
                permissions: [
                    'schools_view', 'schools_edit', 'prospects_view', 'prospects_edit',
                    'finance_view', 'finance_manage', 'contracts_delete',
                    'studios_view', 'studios_edit', 'system_admin', 'system_user_switch', 
                    'meetings_manage', 'tasks_manage', 'activities_view'
                ],
                createdAt: userSnap.exists() ? userSnap.data().createdAt : timestamp,
            }, { merge: true });
            console.log(">>> [BOOTSTRAP] Sovereign Admin identity enforced.");
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
              organizationId: orgId,
              workspaceIds: ['onboarding', 'prospect'],
              roles: ['administrator'],
              permissions: [
                'schools_view', 'schools_edit', 'prospects_view', 'prospects_edit',
                'finance_view', 'finance_manage', 'contracts_delete',
                'studios_view', 'studios_edit', 'system_admin', 'system_user_switch', 
                'meetings_manage', 'tasks_manage', 'activities_view'
              ],
              createdAt: timestamp,
            });
          } catch (creationError) {
            console.error("Failed to create default admin user:", creationError);
          }
        }
      }
    };

    if (firebaseServices.auth && firebaseServices.firestore) {
        seedOrgArchitecture();
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
