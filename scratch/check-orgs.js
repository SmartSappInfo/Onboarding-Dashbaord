require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  const app = initializeApp({
    credential: cert('./serviceAccountKey.json'),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
  const db = getFirestore(app);
  
  Promise.all([
    db.collection('organizations').get(),
    db.collection('workspaces').get()
  ]).then(([orgsSnap, wsSnap]) => {
    console.log(`--- Organizations (${orgsSnap.size}) ---`);
    orgsSnap.forEach(doc => {
      console.log(`ID: ${doc.id} | Name: ${doc.data().name} | Data:`, JSON.stringify(doc.data()));
    });
    
    console.log(`\n--- Workspaces (${wsSnap.size}) ---`);
    wsSnap.forEach(doc => {
      console.log(`ID: ${doc.id} | Name: ${doc.data().name} | OrgId: ${doc.data().organizationId}`);
    });
    process.exit(0);
  }).catch(e => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
} catch (e) {
  console.error('INIT ERROR:', e.message);
  process.exit(1);
}
