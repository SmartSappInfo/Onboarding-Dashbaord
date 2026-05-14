import * as admin from 'firebase-admin';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function purgeFocalPersons() {
  console.log('🚀 Starting Focal Person Purge Script...');
  const BATCH_SIZE = 400; // Stay under the 500 limit safely
  
  let processedCount = 0;
  let deletedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let hasMore = true;

  try {
    while (hasMore) {
      let query = db.collection('entities').limit(BATCH_SIZE);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      const batch = db.batch();
      let opsInBatch = 0;

      for (const doc of snapshot.docs) {
        processedCount++;
        const data = doc.data();
        
        const hasFocalPersonFields = 
          data.focalPerson !== undefined || 
          data.focalPersons !== undefined || 
          data.contactPersons !== undefined;

        if (hasFocalPersonFields) {
          // SAFEGUARD: Ensure entityContacts exists and is populated
          if (Array.isArray(data.entityContacts) && data.entityContacts.length > 0) {
            batch.update(doc.ref, {
              focalPerson: admin.firestore.FieldValue.delete(),
              focalPersons: admin.firestore.FieldValue.delete(),
              contactPersons: admin.firestore.FieldValue.delete()
            });
            deletedCount++;
            opsInBatch++;
          } else {
            console.warn(`⚠️ Skipped Entity ${doc.id} - Has legacy contact fields but NO entityContacts!`);
            skippedCount++;
          }
        }
      }

      if (opsInBatch > 0) {
        await batch.commit();
        console.log(`✅ Committed batch of ${opsInBatch} deletions.`);
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    // Log the migration in SystemMigrationLog
    await db.collection('system_logs').add({
      type: 'migration',
      migrationName: 'purge_focal_persons',
      status: 'completed',
      details: `Purged legacy focalPerson fields safely.`,
      stats: {
        processed: processedCount,
        deleted: deletedCount,
        skipped: skippedCount,
        failed: failedCount
      },
      executedAt: new Date().toISOString()
    });

    console.log('\n🎉 Purge Complete!');
    console.log(`- Processed: ${processedCount}`);
    console.log(`- Deleted:   ${deletedCount}`);
    console.log(`- Skipped:   ${skippedCount}`);
    console.log(`- Failed:    ${failedCount}`);

  } catch (error) {
    console.error('❌ Error during purge:', error);
    process.exit(1);
  }
}

// Execute
purgeFocalPersons()
  .then(() => process.exit(0))
  .catch(console.error);
