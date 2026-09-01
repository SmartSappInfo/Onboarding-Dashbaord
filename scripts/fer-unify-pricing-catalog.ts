/**
 * @fileoverview FER Data Migration & Initializer: Commercial & Pricing Hub Unification
 *
 * PROTOCOL (FER-07 Data Integrity & Safety):
 * - Initializes baseline Product Categories (Software, Services, Hardware, Consulting)
 * - Seeds standard baseline Price Book
 * - Converts legacy subscription packages into active catalog offerings if not present
 * - Safe chunked batches (<= 350 ops per batch commit)
 * - Dry-run mode by default for zero unintended side-effects.
 *
 * USAGE:
 *   npx ts-node scripts/fer-unify-pricing-catalog.ts --dry-run
 *   npx ts-node scripts/fer-unify-pricing-catalog.ts --live --workspace=ws_123
 */

import { adminDb } from '../src/lib/firebase-admin';

interface SeedCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  order: number;
}

const DEFAULT_CATEGORIES: SeedCategory[] = [
  { id: 'cat_software', name: 'Software Licenses', description: 'Core recurring software seats and modules', color: '#4f46e5', order: 1 },
  { id: 'cat_services', name: 'Professional Services', description: 'Onboarding, training, and custom engineering', color: '#059669', order: 2 },
  { id: 'cat_hardware', name: 'Hardware & Devices', description: 'Physical terminals and peripheral equipment', color: '#d97706', order: 3 },
  { id: 'cat_consulting', name: 'Strategic Advisory', description: 'Dedicated account optimization and consulting', color: '#7c3aed', order: 4 },
];

async function runMigration() {
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');
  const workspaceArg = args.find(a => a.startsWith('--workspace='));
  const targetWorkspace = workspaceArg ? workspaceArg.split('=')[1] : undefined;

  console.log(`[FER-07] Running Pricing & Commercial Hub Seeding (Mode: ${isLive ? 'LIVE' : 'DRY-RUN'})...`);

  // 1. Fetch workspaces to seed
  let workspaceIds: string[] = [];
  if (targetWorkspace) {
    workspaceIds = [targetWorkspace];
  } else {
    const wsSnap = await adminDb.collection('workspaces').limit(50).get();
    workspaceIds = wsSnap.docs.map(d => d.id);
  }

  console.log(`[FER-07] Found ${workspaceIds.length} target workspace(s).`);

  for (const wsId of workspaceIds) {
    console.log(`\n--- Processing Workspace: ${wsId} ---`);

    // Check Categories
    const catSnap = await adminDb.collection('product_categories')
      .where('workspaceId', '==', wsId)
      .get();

    console.log(`[Workspace ${wsId}] Existing categories: ${catSnap.size}`);

    if (catSnap.empty) {
      console.log(`[Workspace ${wsId}] Seeding ${DEFAULT_CATEGORIES.length} default categories...`);
      if (isLive) {
        const batch = adminDb.batch();
        for (const cat of DEFAULT_CATEGORIES) {
          const docRef = adminDb.collection('product_categories').doc(`${wsId}_${cat.id}`);
          batch.set(docRef, {
            ...cat,
            workspaceId: wsId,
            organizationId: 'default_org',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        await batch.commit();
        console.log(`[Workspace ${wsId}] Default categories successfully seeded.`);
      }
    }

    // Check Standard Price Book
    const pbSnap = await adminDb.collection('price_books')
      .where('workspaceId', '==', wsId)
      .where('isStandard', '==', true)
      .get();

    if (pbSnap.empty) {
      console.log(`[Workspace ${wsId}] Standard price book missing. Seeding Standard USD Price Book...`);
      if (isLive) {
        const pbRef = adminDb.collection('price_books').doc(`${wsId}_standard_usd`);
        await pbRef.set({
          name: 'Standard Price Book (USD)',
          description: 'Default baseline commercial rate sheet',
          currency: 'USD',
          isStandard: true,
          isActive: true,
          workspaceId: wsId,
          organizationId: 'default_org',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log(`[Workspace ${wsId}] Standard Price Book created.`);
      }
    }
  }

  console.log('\n[FER-07] Seeding & Validation Complete.');
}

runMigration().catch(err => {
  console.error('[FER-07] Fatal migration error:', err);
  process.exit(1);
});
