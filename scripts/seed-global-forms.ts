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
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY env var:', e);
  }
} else if (fs.existsSync('serviceAccountKey.json')) {
  try {
    certConfig = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
  } catch (e) {
    console.error('Failed to parse serviceAccountKey.json file:', e);
  }
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(certConfig),
  });
}

const db = getFirestore();

async function seed() {
  const timestamp = new Date().toISOString();

  const emailDoc = {
    id: 'global_form_invitation_email',
    scope: 'global',
    category: 'forms',
    channel: 'email',
    target: 'external_client',
    name: 'Form Invitation (Email)',
    contentMode: 'rich_builder',
    subject: "Great to connect, {{contact_name}}! Here is what's next.",
    body: "",
    blocks: [
      {
        id: "block_head_global_form_invitation_email",
        type: "heading",
        title: "Great to connect, {{contact_name}}! Here is what's next.",
        variant: "h2",
        style: { textAlign: "center", fontWeight: "bold", marginTop: "16px", marginBottom: "16px" }
      },
      {
        id: "block_body_global_form_invitation_email",
        type: "text",
        content: "Hi {{contact_name}},\n\nThanks so much for reaching out to {{org_name}}! We’ve received your information and am currently reviewing it to see how we can best help you. As a next step, A team member will call you to discuss how best we can assist you. \n\nIn the meantime, simply reply to this email if you have any immediate questions. Looking forward to speaking with you!\n\nBest regards",
        style: { textAlign: "left", lineHeight: "1.6", marginTop: "8px", marginBottom: "16px" }
      }
    ],
    styleId: 'default',
    templateType: 'form_invitation',
    recipientType: 'external_alert',
    variableContext: 'form',
    declaredVariables: ['contact_name', 'org_name'],
    status: 'active',
    version: 1,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: 'system_seed_custom'
  };

  const smsDoc = {
    id: 'global_form_invitation_sms',
    scope: 'global',
    category: 'forms',
    channel: 'sms',
    target: 'external_client',
    name: 'Form Invitation (SMS)',
    contentMode: 'plain_text',
    subject: "",
    body: "Hi {{respondent_name}}, thanks for your interest in {{org_name}}! 🚀 We've received your request. A team member will call you shortly to assist you with your next steps.",
    styleId: 'default',
    templateType: 'form_invitation',
    recipientType: 'external_alert',
    variableContext: 'form',
    declaredVariables: ['respondent_name', 'org_name'],
    status: 'active',
    version: 1,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: 'system_seed_custom'
  };

  console.log('Writing global_form_invitation_email...');
  await db.collection('message_templates').doc('global_form_invitation_email').set(emailDoc, { merge: true });

  console.log('Writing global_form_invitation_sms...');
  await db.collection('message_templates').doc('global_form_invitation_sms').set(smsDoc, { merge: true });

  console.log('🎉 Seeding successfully completed!');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
