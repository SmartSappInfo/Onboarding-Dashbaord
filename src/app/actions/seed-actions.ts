'use server';

/**
 * @fileOverview Seed Actions — Server-side dev infrastructure seeder.
 *
 * Direct client-side SDK writes to system collections (`organizations`, `workspaces`,
 * `system_config`) trigger Firestore Security Rule permission errors for unauthenticated
 * or regular client connections.
 *
 * This server action uses `adminDb` (Firebase Admin SDK) to check and seed required
 * development infrastructure securely on the server side without compromising client
 * security rules.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Never remove the `NODE_ENV === 'development'` guard. Seeding system config must be
 *   dev-only or explicitly triggered by authenticated super-admins.
 * - All Firestore writes here use `adminDb`, which bypasses security rules. Ensure
 *   no sensitive client input is passed directly to write operations without validation.
 */

import { adminDb } from '@/lib/firebase-admin';

export interface SeedInfrastructureResult {
  success: boolean;
  seeded: string[];
  error?: string;
}

/** Super admin email — designated sovereign identity for dev deployment. */
const SUPER_ADMIN_EMAIL = 'jakjoejoe@gmail.com';

/**
 * Server action to seed core infrastructure (Org, Workspaces, Super Admin config)
 * in development environments safely via adminDb.
 */
export async function seedInfrastructureAction(): Promise<SeedInfrastructureResult> {
  // Production guard: Zero execution in production builds
  if (process.env.NODE_ENV !== 'development') {
    return { success: true, seeded: [] };
  }

  const seeded: string[] = [];
  const timestamp = new Date().toISOString();

  try {
    // 1. Ensure Root Organization ('smartsapp-hq')
    const orgId = 'smartsapp-hq';
    const orgRef = adminDb.collection('organizations').doc(orgId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
      await orgRef.set({
        id: orgId,
        name: 'SmartSapp HQ',
        slug: 'smartsapp-hq',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      seeded.push(`Organization: ${orgId}`);
    }

    // 2. Ensure Core Workspaces anchored to Org
    const coreWorkspaces = [
      { id: 'onboarding', name: 'Client Onboarding', orgId, color: '#3B5FFF' },
      { id: 'prospect', name: 'Sales Leads', orgId, color: '#10b981' },
    ];

    for (const w of coreWorkspaces) {
      const wRef = adminDb.collection('workspaces').doc(w.id);
      const wSnap = await wRef.get();
      if (!wSnap.exists) {
        await wRef.set({
          id: w.id,
          organizationId: w.orgId,
          name: w.name,
          color: w.color,
          status: 'active',
          statuses: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        seeded.push(`Workspace: ${w.id}`);
      }
    }

    // 3. Ensure Super Admin Config document ('system_config/super_admins')
    const configRef = adminDb.collection('system_config').doc('super_admins');
    const configSnap = await configRef.get();

    if (!configSnap.exists) {
      await configRef.set({
        emails: [SUPER_ADMIN_EMAIL],
        updatedAt: timestamp,
      });
      seeded.push(`SuperAdminConfig: ${SUPER_ADMIN_EMAIL}`);
    } else {
      const data = configSnap.data();
      const emails: string[] = Array.isArray(data?.emails) ? data.emails : [];
      if (!emails.includes(SUPER_ADMIN_EMAIL)) {
        await configRef.set({
          emails: [...emails, SUPER_ADMIN_EMAIL],
          updatedAt: timestamp,
        }, { merge: true });
        seeded.push(`SuperAdminEmail: ${SUPER_ADMIN_EMAIL}`);
      }
    }

    return { success: true, seeded };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[SEED_ACTION] Dev infrastructure seed error:', errorMessage);
    return {
      success: false,
      seeded,
      error: errorMessage,
    };
  }
}
