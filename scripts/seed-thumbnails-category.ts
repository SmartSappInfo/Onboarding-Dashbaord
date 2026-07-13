/**
 * Seeding protocol script to register 'Thumbnails' category in media_categories for all workspaces.
 * Run with: npx tsx scripts/seed-thumbnails-category.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ServiceAccountConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

const serviceAccount = JSON.parse(
  readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8')
) as ServiceAccountConfig;

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

interface CategoryData {
  name: string;
  workspaceId: string;
  createdAt: string;
}

async function seedThumbnailsCategory() {
  console.log('\n🚀 Executing Fetch, Enrich & Restore Category Seeding Protocol...\n');

  const workspacesRef = db.collection('workspaces');
  const workspacesSnap = await workspacesRef.get();

  if (workspacesSnap.empty) {
    console.log('No workspaces found.');
    return;
  }

  const categoryCol = db.collection('media_categories');
  let seededCount = 0;

  for (const doc of workspacesSnap.docs) {
    const workspaceId = doc.id;
    
    // Check if 'Thumbnails' already exists
    const qSnap = await categoryCol
      .where('workspaceId', '==', workspaceId)
      .where('name', '==', 'Thumbnails')
      .limit(1)
      .get();

    if (qSnap.empty) {
      const payload: CategoryData = {
        name: 'Thumbnails',
        workspaceId,
        createdAt: new Date().toISOString()
      };
      await categoryCol.add(payload);
      console.log(`[Seed] Added 'Thumbnails' category for workspace: ${workspaceId}`);
      seededCount++;
    }
  }

  console.log(`\n✅ Seeding protocol completed. Registered 'Thumbnails' for ${seededCount} workspaces.\n`);
}

seedThumbnailsCategory()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Category seeding failed:', err);
    process.exit(1);
  });
