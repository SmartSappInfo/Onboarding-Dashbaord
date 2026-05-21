require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  const app = initializeApp({
    credential: cert('./serviceAccountKey.json'),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
  const db = getFirestore(app);
  db.collection('workspaces').get()
    .then((snap) => {
      console.log(`Found ${snap.size} workspaces:`);
      snap.forEach(doc => {
        console.log(`ID: ${doc.id} | Name: ${doc.data().name}`);
      });
      process.exit(0);
    })
    .catch(e => {
      console.error('ERROR:', e.message);
      process.exit(1);
    });
} catch (e) {
  console.error('INIT ERROR:', e.message);
  process.exit(1);
}
