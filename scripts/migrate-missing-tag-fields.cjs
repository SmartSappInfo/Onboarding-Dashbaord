require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function migrateTags() {
  console.log('>>> Starting Tag Data Migration...');
  
  // 1. Initialize Firebase Admin
  let app;
  try {
    app = initializeApp({
      credential: cert('./serviceAccountKey.json'),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
  } catch (e) {
    console.error('Initialization Error:', e.message);
    process.exit(1);
  }
  
  const db = getFirestore(app);
  
  // 2. Fetch all tags
  console.log('Fetching tags from Firestore...');
  const tagsSnap = await db.collection('tags').get();
  console.log(`Found ${tagsSnap.size} total tags in database.`);
  
  const tagsToUpdate = [];
  
  tagsSnap.forEach(doc => {
    const data = doc.data();
    let needsUpdate = false;
    const updateData = {};
    
    // Check missing fields
    if (data.category === undefined) {
      updateData.category = 'custom';
      needsUpdate = true;
    }
    if (data.isSystem === undefined) {
      updateData.isSystem = false;
      needsUpdate = true;
    }
    if (data.usageCount === undefined) {
      updateData.usageCount = 0;
      needsUpdate = true;
    }
    if (data.scope === undefined) {
      updateData.scope = 'workspace';
      needsUpdate = true;
    }
    if (data.description === undefined) {
      updateData.description = '';
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      updateData.updatedAt = new Date().toISOString();
      tagsToUpdate.push({
        ref: doc.ref,
        id: doc.id,
        name: data.name,
        workspaceId: data.workspaceId,
        updates: updateData
      });
    }
  });
  
  console.log(`Identified ${tagsToUpdate.length} tags needing migration.`);
  
  if (tagsToUpdate.length === 0) {
    console.log('All tags are healthy. No updates needed.');
    process.exit(0);
  }
  
  // 3. Process updates in batches of 500 (Firestore limit)
  const BATCH_SIZE = 500;
  const batches = [];
  
  for (let i = 0; i < tagsToUpdate.length; i += BATCH_SIZE) {
    batches.push(tagsToUpdate.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`Processing ${batches.length} batch(es)...`);
  
  let totalUpdated = 0;
  
  await Promise.all(batches.map(async (batchGroup, batchIdx) => {
    const batch = db.batch();
    
    batchGroup.forEach(item => {
      console.log(`  [Batch ${batchIdx + 1}] Queuing Tag: "${item.name}" (ID: ${item.id}) in workspace "${item.workspaceId}" -> Updates:`, item.updates);
      batch.update(item.ref, item.updates);
    });
    
    await batch.commit();
    totalUpdated += batchGroup.length;
    console.log(`  [Batch ${batchIdx + 1}] Successfully committed ${batchGroup.length} updates.`);
  }));
  
  console.log(`>>> Migration complete! Successfully updated ${totalUpdated} tags.`);
}

migrateTags().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
