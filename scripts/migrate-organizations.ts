/**
 * Migration script to add missing fields to existing organizations
 * Run with: npx tsx scripts/migrate-organizations.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function migrateOrganizations() {
  console.log('Starting organization migration...');
  
  const organizationsRef = db.collection('organizations');
  const snapshot = await organizationsRef.get();
  
  if (snapshot.empty) {
    console.log('No organizations found.');
    return;
  }
  
  const batch = db.batch();
  let updateCount = 0;
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    const updates: any = {};
    
    // Add missing timestamps
    if (!data.createdAt) {
      updates.createdAt = new Date().toISOString();
    }
    
    if (!data.updatedAt) {
      updates.updatedAt = data.createdAt || new Date().toISOString();
    }
    
    // Add missing status
    if (!data.status) {
      updates.status = 'active';
    }
    
    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      updateCount++;
      console.log(`Updating organization: ${doc.id} (${data.name})`);
    }
  });
  
  if (updateCount > 0) {
    await batch.commit();
    console.log(`✅ Successfully updated ${updateCount} organizations`);
  } else {
    console.log('✅ All organizations are up to date');
  }
}

migrateOrganizations()
  .then(() => {
    console.log('Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
