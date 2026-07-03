// @ts-nocheck
/**
 * Fetch, enrich, and restore migration script to add a default "General" category
 * to all existing media assets.
 * 
 * Run with: npx tsx scripts/migrate-media-categories.ts
 * Or: DRY_RUN=true npx tsx scripts/migrate-media-categories.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { readFileSync } from 'fs';
import { join } from 'path';

const serviceAccount = JSON.parse(
  readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const DRY_RUN = process.env.DRY_RUN === 'true';

interface UpdatePayload {
  category: string;
}

async function migrateMediaCategories() {
  console.log(`\n🚀 Starting media categories migration (DRY_RUN: ${DRY_RUN})...\n`);

  const mediaRef = db.collection('media');
  const snapshot = await mediaRef.get();

  if (snapshot.empty) {
    console.log('No media documents found.');
    return;
  }

  const batch = db.batch();
  let updateCount = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    
    // If the category is missing, enrich it to 'General'
    if (!data.category) {
      updateCount++;
      console.log(`[Enrich] Media document "${doc.id}" (${data.name || 'unnamed'}) -> category: "General"`);
      
      if (!DRY_RUN) {
        const updates: UpdatePayload = { category: 'General' };
        batch.update(doc.ref, updates);
      }
    }
  });

  if (updateCount > 0) {
    if (!DRY_RUN) {
      await batch.commit();
      console.log(`\n✅ Successfully migrated ${updateCount} media assets to "General"\n`);
    } else {
      console.log(`\n🔍 Dry run completed. Would migrate ${updateCount} media assets to "General"\n`);
    }
  } else {
    console.log('\n✅ All media assets are up to date with categories\n');
  }
}

migrateMediaCategories()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
