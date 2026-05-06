'use client';

/**
 * FirebaseBootstrap — Dev-only infrastructure seeder.
 *
 * Seeds the root organization and core workspaces on first mount.
 * Does NOT perform any authentication — login is handled exclusively
 * by the login page. This component renders nothing.
 *
 * Architectural notes:
 * - Module-level `didInit` guard (per Vercel `advanced-init-once`)
 * - No `pathname` dependency — runs once per app load
 * - Dev-only: returns immediately in production
 * - Rendered only inside AdminLayout (never on public pages)
 */

import { useEffect } from 'react';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Module-level guard — survives remounts and React Strict Mode double-fire
let didInit = false;

/** Super admin email — the sovereign identity for this deployment. */
const SUPER_ADMIN_EMAIL = 'jakjoejoe@gmail.com';

export default function FirebaseBootstrap() {
  const firestore = useFirestore();

  useEffect(() => {
    // advanced-init-once: never run twice
    if (didInit) return;

    // Production guard: zero overhead in production builds
    if (process.env.NODE_ENV !== 'development') return;

    // SSR guard
    if (typeof window === 'undefined') return;

    if (!firestore) return;

    didInit = true;

    const seedInfrastructure = async () => {
      const timestamp = new Date().toISOString();

      try {
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
            updatedAt: timestamp,
          });
          console.log('>>> [BOOTSTRAP] Root organization seeded.');
        }

        // 2. Ensure Core Workspaces anchored to Org
        const coreWorkspaces = [
          { id: 'onboarding', name: 'Client Onboarding', orgId, color: '#3B5FFF' },
          { id: 'prospect', name: 'Sales Leads', orgId, color: '#10b981' },
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
              updatedAt: timestamp,
            });
            console.log(`>>> [BOOTSTRAP] Workspace "${w.name}" seeded.`);
          }
        }

        // 3. Ensure Super Admin config document
        // This allows the login flow to auto-authorize the super admin on first sign-in
        const configRef = doc(firestore, 'system_config', 'super_admins');
        const configSnap = await getDoc(configRef);
        if (!configSnap.exists()) {
          await setDoc(configRef, {
            emails: [SUPER_ADMIN_EMAIL],
            updatedAt: timestamp,
          });
          console.log(`>>> [BOOTSTRAP] Super admin config seeded for ${SUPER_ADMIN_EMAIL}.`);
        } else {
          // Ensure the email is in the list
          const data = configSnap.data();
          const emails: string[] = data?.emails || [];
          if (!emails.includes(SUPER_ADMIN_EMAIL)) {
            await setDoc(configRef, {
              emails: [...emails, SUPER_ADMIN_EMAIL],
              updatedAt: timestamp,
            }, { merge: true });
            console.log(`>>> [BOOTSTRAP] Super admin email added: ${SUPER_ADMIN_EMAIL}.`);
          }
        }

        console.log('>>> [BOOTSTRAP] Infrastructure seed complete.');
      } catch (error) {
        // Non-fatal: seed failures should not break the app
        console.warn('>>> [BOOTSTRAP] Seed failed (non-fatal):', error);
      }
    };

    seedInfrastructure();
  }, [firestore]);

  // This component renders nothing
  return null;
}
