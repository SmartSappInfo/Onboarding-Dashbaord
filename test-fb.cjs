require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  const app = initializeApp({
    credential: cert('./serviceAccountKey.json'),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
  const db = getFirestore(app);
  db.collection('call_campaigns').get()
    .then(async (snap) => {
      console.log(`Found ${snap.size} campaigns:`);
      snap.forEach(doc => {
        const data = doc.data();
        console.log(`Campaign ID: ${doc.id}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Workspace ID: ${data.workspaceId}`);
        console.log('---');
      });

      const workspacesSnap = await db.collection('workspaces').get();
      console.log(`Found ${workspacesSnap.size} workspaces:`);
      workspacesSnap.forEach(doc => {
        console.log(`  Workspace ID: ${doc.id}, Name: ${doc.data().name}`);
      });
    })
    .catch(e => console.error('ERROR:', e.message));
} catch (e) {
  console.error('INIT ERROR:', e.message);
}
