require('dotenv').config({ path: '.env.local' });
const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({
  credential: cert('./serviceAccountKey.json'),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});
const db = getFirestore(app);

async function run() {
  try {
    const weSnap = await db.collection('workspace_entities').limit(3).get();
    console.log('--- WORKSPACE ENTITIES ---');
    weSnap.forEach(doc => {
      const data = doc.data();
      console.log('ID:', doc.id);
      console.log('displayName:', data.displayName);
      console.log('entityId:', data.entityId);
      console.log('entityContacts keys/type:', typeof data.entityContacts, Array.isArray(data.entityContacts) ? data.entityContacts.length : 'not array');
      console.log('contacts keys/type:', typeof data.contacts, Array.isArray(data.contacts) ? data.contacts.length : 'not array');
      console.log('has primaryContactName:', !!data.primaryContactName, 'value:', data.primaryContactName);
      console.log('has primaryEmail:', !!data.primaryEmail, 'value:', data.primaryEmail);
    });

    console.log('--- ENTITIES ---');
    const entSnap = await db.collection('entities').limit(3).get();
    entSnap.forEach(doc => {
      const data = doc.data();
      console.log('ID:', doc.id);
      console.log('name:', data.name);
      console.log('entityContacts keys/type:', typeof data.entityContacts, Array.isArray(data.entityContacts) ? data.entityContacts.length : 'not array');
      if (Array.isArray(data.entityContacts)) {
        console.log('entityContacts sample:', data.entityContacts.map(c => ({ name: c.name, email: c.email, phone: c.phone, isPrimary: c.isPrimary, isSignatory: c.isSignatory })));
      }
    });

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

run();
