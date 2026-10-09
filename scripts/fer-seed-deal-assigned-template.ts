#!/usr/bin/env tsx
/**
 * CLI Seeding Runner: Seed Deal Assignment Messaging Templates
 *
 * Usage:
 *   npx tsx scripts/fer-seed-deal-assigned-template.ts
 *
 * ARCHITECTURAL PURPOSE & WORKSPACE RULES (Rule 10):
 * Seeds the global deal_assigned email, SMS, and WhatsApp templates into Firestore collection `message_templates`.
 * Specifically ensures the email template includes:
 *   - `lead_link`: direct link redirecting the user to the lead's details page (/admin/entities/${entityId})
 *   - `deal_link`: direct link to the deal (/admin/deals/${dealId})
 *   - Scope: global
 *   - Status: active (isActive: true)
 *   - Recipient Type: internal_alert
 *   - Target: internal_team
 */

import 'dotenv/config';

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';
import { TEMPLATES } from '../src/lib/messaging-templates-registry';
import { MESSAGING_TRIGGERS } from '../src/lib/messaging-triggers';

async function seedDealAssignedTemplates() {
  console.log('🚀 Seeding Deal Assignment message templates into Firestore...');

  const dealAssignedTemplates = TEMPLATES.filter(t => t.templateType === 'deal_assigned');
  if (dealAssignedTemplates.length === 0) {
    throw new Error('No deal_assigned templates found in TEMPLATES registry.');
  }

  const trigger = MESSAGING_TRIGGERS.find(t => t.id === 'deal_assigned');
  const now = new Date().toISOString();

  for (const tpl of dealAssignedTemplates) {
    const docId = `global_${tpl.templateType}_${tpl.channel}`;
    const docRef = adminDb.collection('message_templates').doc(docId);

    const isEmail = tpl.channel === 'email';
    const blocks = isEmail ? [
      {
        id: `block_head_${docId}`,
        type: 'heading',
        title: tpl.subject || tpl.name,
        variant: 'h2' as const,
        style: { textAlign: 'center', fontWeight: 'bold', marginTop: '16px', marginBottom: '16px' }
      },
      {
        id: `block_body_${docId}`,
        type: 'text',
        content: tpl.body,
        style: { textAlign: 'left', lineHeight: '1.6', marginTop: '8px', marginBottom: '16px' }
      }
    ] : undefined;

    const templateDoc = {
      id: docId,
      scope: 'global',
      category: tpl.category,
      channel: tpl.channel,
      target: trigger?.target || 'internal_team',
      name: tpl.name,
      contentMode: isEmail ? 'rich_builder' : 'plain_text',
      subject: tpl.subject || '',
      body: tpl.body,
      ...(blocks ? { blocks } : {}),
      styleId: 'default',
      templateType: tpl.templateType,
      recipientType: tpl.recipientType || trigger?.recipientType || 'internal_alert',
      variableContext: tpl.variableContext || 'deal',
      declaredVariables: tpl.declaredVariables || [],
      status: 'active',
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed_deal_assigned_script',
    };

    await docRef.set(templateDoc, { merge: true });
    console.log(`✅ Upserted template: ${tpl.name} [ID: ${docId}]`);
    console.log(`   Declared Variables: ${tpl.declaredVariables.join(', ')}`);
    console.log(`   Channel: ${tpl.channel}`);
  }

  console.log('\n🎉 Successfully seeded all deal_assigned templates!\n');
}

seedDealAssignedTemplates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
