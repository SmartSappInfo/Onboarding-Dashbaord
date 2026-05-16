import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

try {
  const app = initializeApp({
    credential: cert('./serviceAccountKey.json'),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
  const db = getFirestore(app);
  db.collection('field_groups').limit(1).get()
    .then(() => console.log('SUCCESS'))
    .catch(e => console.error('ERROR:', e.message));
} catch (e: any) {
  console.error('INIT ERROR:', e.message);
}
