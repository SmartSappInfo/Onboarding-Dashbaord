require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  console.log('Initializing Firebase Admin SDK...');
  const app = initializeApp({
    credential: cert('./serviceAccountKey.json'),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
  const db = getFirestore(app);
  
  console.log('Fetching expired import logs (rawFieldsCleared == true)...');
  db.collection('import_logs')
    .where('rawFieldsCleared', '==', true)
    .get()
    .then(async (snap) => {
      if (snap.empty) {
        console.log('SUCCESS: No expired import payloads found to un-expire.');
        process.exit(0);
      }

      console.log(`Found ${snap.size} expired import logs. Un-expiring and extending TTL...`);
      const now = new Date();
      const batch = db.batch();
      
      snap.forEach(doc => {
        batch.update(doc.ref, {
          rawFieldsCleared: false,
          startedAt: now,
          unexpiredAt: now.toISOString()
        });
        console.log(`- Un-expired log: ${doc.id} | Filename: ${doc.data().filename}`);
      });

      await batch.commit();
      console.log(`\nSUCCESS: Successfully un-expired ${snap.size} import payloads and extended their TTL!`);
      process.exit(0);
    })
    .catch(e => {
      console.error('ERROR during execution:', e.message);
      process.exit(1);
    });
} catch (e) {
  console.error('INIT ERROR:', e.message);
  process.exit(1);
}
