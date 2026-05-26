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
    const snap = await db.collection('message_templates')
      .where('category', '==', 'meetings')
      .get();
    
    console.log(`Total meeting templates found: ${snap.size}`);
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`- ID: ${doc.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  templateType: ${data.templateType}`);
      console.log(`  channel: ${data.channel}`);
      console.log(`  recipientType: ${data.recipientType}`);
      console.log(`  scope: ${data.scope}`);
      console.log(`  status: ${data.status}`);
      console.log(`  subject: ${data.subject}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

run();
