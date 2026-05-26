require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  const app = initializeApp({
    credential: cert('./serviceAccountKey.json'),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
  const db = getFirestore(app);
  db.collection('users').get()
    .then((snap) => {
      console.log(`Found ${snap.size} users:`);
      snap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id} | Email: ${d.email} | Name: ${d.name} | Role: ${d.role} | Authorized: ${d.isAuthorized}`);
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
