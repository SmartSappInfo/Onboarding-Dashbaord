require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  const app = initializeApp({
    credential: cert('./serviceAccountKey.json'),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
  const db = getFirestore(app);
  
  db.collection('workspace_entities').get()
    .then((snap) => {
      console.log('Total entities found in workspace_entities:', snap.size);
      if (snap.size > 0) {
        const first = snap.docs[0].data();
        console.log('Fields on first entity document:', Object.keys(first));
        console.log('entityContacts property:', first.entityContacts);
        console.log('contacts property:', first.contacts);
        
        let withEntityContacts = 0;
        let withContacts = 0;
        let totalContactsInEntityContacts = 0;
        let totalContactsInContacts = 0;
        
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (Array.isArray(data.entityContacts)) {
            withEntityContacts++;
            totalContactsInEntityContacts += data.entityContacts.length;
          }
          if (Array.isArray(data.contacts)) {
            withContacts++;
            totalContactsInContacts += data.contacts.length;
          }
        });
        
        console.log(`Entities with entityContacts array: ${withEntityContacts} (Total contacts: ${totalContactsInEntityContacts})`);
        console.log(`Entities with contacts array: ${withContacts} (Total contacts: ${totalContactsInContacts})`);
      }
    })
    .catch(e => console.error('ERROR:', e.stack));
} catch (e) {
  console.error('INIT ERROR:', e.message);
}
