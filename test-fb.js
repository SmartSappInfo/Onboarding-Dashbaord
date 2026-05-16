require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  const app = initializeApp({
    credential: cert('./serviceAccountKey.json'),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
  const db = getFirestore(app);
  db.collection('field_groups').limit(1).get()
    .then(() => console.log('SUCCESS'))
    .catch(e => console.error('ERROR:', e.message));
} catch (e) {
  console.error('INIT ERROR:', e.message);
}
