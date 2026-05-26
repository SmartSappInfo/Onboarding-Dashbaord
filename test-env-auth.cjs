require('dotenv').config({ path: '.env' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

try {
  if (!serviceAccountKey) {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_KEY is not defined in .env');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(serviceAccountKey);
  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  const db = getFirestore(app);
  db.collection('workspaces').limit(1).get()
    .then((snap) => {
      console.log('SUCCESS: Authenticated successfully using env var key! Found workspaces:', snap.size);
      process.exit(0);
    })
    .catch((error) => {
      console.error('FIRESTORE ERROR Code:', error.code);
      console.error('FIRESTORE ERROR Message:', error.message);
      process.exit(1);
    });
} catch (e) {
  console.error('INIT ERROR:', e.message);
  process.exit(1);
}
