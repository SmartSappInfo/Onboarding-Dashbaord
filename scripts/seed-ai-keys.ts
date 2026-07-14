import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load local configurations
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

// Import the secret vault adapter dynamically using tsx path resolution
import { sealSecret, isVaultConfigured } from '../src/lib/backoffice/secret-vault';

async function seed() {
  const geminiKeyPlain = process.env.GEMINI_API_KEY;
  const claudeKeyPlain = process.env.ANTHROPIC_API_KEY;
  const openRouterKeyPlain = process.env.OPENROUTER_API_KEY;

  if (!geminiKeyPlain && !claudeKeyPlain && !openRouterKeyPlain) {
    console.error('❌ No API keys found in environment variables.');
    process.exit(1);
  }

  console.log('Sealing API keys using secret vault...');
  
  let geminiKey: any = geminiKeyPlain;
  let claudeKey: any = claudeKeyPlain;
  let openRouterKey: any = openRouterKeyPlain;

  try {
    if (isVaultConfigured()) {
      if (geminiKeyPlain) geminiKey = sealSecret(geminiKeyPlain);
      if (claudeKeyPlain) claudeKey = sealSecret(claudeKeyPlain);
      if (openRouterKeyPlain) openRouterKey = sealSecret(openRouterKeyPlain);
      console.log('🔒 Keys successfully encrypted/sealed.');
    } else {
      console.warn('⚠️ Vault encryption is not configured, storing keys in legacy plaintext.');
    }
  } catch (e: any) {
    console.warn('⚠️ Vault sealing failed, storing keys in legacy plaintext. Error:', e.message);
  }

  const keysDoc = {
    geminiApiKey: geminiKey || null,
    claudeApiKey: claudeKey || null,
    openRouterApiKey: openRouterKey || null,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system_seed_vault_custom'
  };

  console.log('Writing system_settings/ai_keys...');
  await db.collection('system_settings').doc('ai_keys').set(keysDoc, { merge: true });

  console.log('🎉 AI Keys successfully seeded into Firestore!');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
