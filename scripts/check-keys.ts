import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

let certConfig = {};
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    certConfig = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (e) {}
} else if (fs.existsSync('serviceAccountKey.json')) {
  certConfig = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(certConfig),
  });
}

const db = getFirestore();

async function check() {
  const docRef = db.collection('system_settings').doc('ai_keys');
  const snap = await docRef.get();
  if (snap.exists) {
    console.log('Document system_settings/ai_keys exists:', JSON.stringify(snap.data(), null, 2));
  } else {
    console.log('Document system_settings/ai_keys does NOT exist.');
  }

  // Also print process.env variables
  console.log('process.env.GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present' : 'Not present');
  console.log('process.env.ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'Present' : 'Not present');
}

check().catch(console.error);
