#!/usr/bin/env tsx
/**
 * CLI Migration Runner: Messaging Templates FER (Fetch-Enrich-Restore) Protocol
 *
 * Usage:
 *   npx tsx scripts/fer-messaging-templates.ts
 *   DRY_RUN=true npx tsx scripts/fer-messaging-templates.ts
 *
 * Architectural Purpose:
 *   1. FETCH: Queries all existing `message_templates` from Firestore.
 *   2. ENRICH: Aligns template categories, trigger mappings, and metadata using the canonical registry.
 *   3. RESTORE: Detects any missing global blueprints (such as the newly added SMS and WhatsApp assignment
 *      notifications, and Deal Assignment multi-channel templates) and automatically seeds them as active
 *      global blueprints in Firestore.
 */

import 'dotenv/config';

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';
import { TEMPLATES } from '../src/lib/messaging-templates-registry';
import { MESSAGING_TRIGGERS } from '../src/lib/messaging-triggers';

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 400;

async function run() {
  console.log(`\n🚀 Starting Messaging Templates FER Protocol${DRY_RUN ? ' [DRY RUN]' : ''}...`);

  try {
    // ── PHASE 1: Fetch ──────────────────────────────────────────────────────────
    console.log('📥 Phase 1: Fetching all existing message templates from Firestore...');
    const snapshot = await adminDb.collection('message_templates').get();
    console.log(`   Found ${snapshot.size} existing template documents.`);

    const existingGlobalKeys = new Set<string>();
    let enrichedCount = 0;
    let skippedCount = 0;

    const enrichBatch = adminDb.batch();
    let enrichOpCount = 0;

    // ── PHASE 2: Enrich ────────────────────────────────────────────────────────
    console.log('🔄 Phase 2: Analyzing and enriching existing templates...');
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.scope === 'global' && data.templateType && data.channel) {
        existingGlobalKeys.add(`${data.templateType}__${data.channel}`);
      }

      // Check if assignment_notification email needs updated declaredVariables
      if (data.templateType === 'assignment_notification' && data.channel === 'email') {
        const declared = (data.declaredVariables as string[]) || [];
        const requiredVars = ['assigned_to', 'entity_name', 'assigner_name', 'org_name'];
        const missingVars = requiredVars.filter(v => !declared.includes(v));

        if (missingVars.length > 0) {
          if (!DRY_RUN) {
            enrichBatch.update(doc.ref, {
              declaredVariables: Array.from(new Set([...declared, ...requiredVars])),
              updatedAt: new Date().toISOString(),
            });
            enrichOpCount++;
          }
          enrichedCount++;
          console.log(`   Enriched template "${data.name || doc.id}" with missing declared variables: ${missingVars.join(', ')}`);
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    if (!DRY_RUN && enrichOpCount > 0) {
      await enrichBatch.commit();
      console.log(`   Committed ${enrichOpCount} template enrichments.`);
    }

    // ── PHASE 3: Restore / Seed Missing Global Blueprints ───────────────────────
    console.log('🌱 Phase 3: Checking for missing global template blueprints...');
    const missingTemplates = TEMPLATES.filter(tpl => {
      const key = `${tpl.templateType}__${tpl.channel}`;
      return !existingGlobalKeys.has(key);
    });

    console.log(`   Discovered ${missingTemplates.length} global blueprints missing in Firestore.`);

    let seededCount = 0;
    if (missingTemplates.length > 0) {
      const timestamp = new Date().toISOString();
      const seedBatches: FirebaseFirestore.WriteBatch[] = [];
      let currentSeedBatch = adminDb.batch();
      let seedOpCount = 0;

      for (const tpl of missingTemplates) {
        const docId = `global_${tpl.templateType}_${tpl.channel}`;
        const docRef = adminDb.collection('message_templates').doc(docId);
        const trigger = MESSAGING_TRIGGERS.find(t => t.id === tpl.templateType);

        const templateDoc: Record<string, unknown> = {
          id: docId,
          scope: 'global',
          category: tpl.category,
          channel: tpl.channel,
          target: trigger?.target || (tpl.recipientType === 'internal_alert' ? 'internal_team' : 'external_client'),
          name: tpl.name,
          contentMode: 'plain_text',
          subject: tpl.subject || '',
          body: tpl.body,
          templateType: tpl.templateType,
          recipientType: tpl.recipientType || trigger?.recipientType || 'external_alert',
          variableContext: tpl.variableContext || 'common',
          declaredVariables: tpl.declaredVariables || [],
          status: 'active',
          version: 1,
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: 'fer_protocol_cli',
        };

        if (tpl.reminderConfig) {
          templateDoc.reminderConfig = tpl.reminderConfig;
        }

        if (DRY_RUN) {
          console.log(`   [DRY RUN] Would seed: "${tpl.name}" (${tpl.templateType}/${tpl.channel}) -> ID: ${docId}`);
        } else {
          currentSeedBatch.set(docRef, templateDoc);
          seedOpCount++;
          if (seedOpCount >= BATCH_SIZE) {
            seedBatches.push(currentSeedBatch);
            currentSeedBatch = adminDb.batch();
            seedOpCount = 0;
          }
          console.log(`   Seeded blueprint: "${tpl.name}" (${tpl.templateType}/${tpl.channel}) -> ID: ${docId}`);
        }
        seededCount++;
      }

      if (!DRY_RUN && seedOpCount > 0) {
        seedBatches.push(currentSeedBatch);
      }

      if (!DRY_RUN) {
        for (const batch of seedBatches) {
          await batch.commit();
        }
      }
    }

    // ── SUMMARY ────────────────────────────────────────────────────────────────
    console.log('\n============================================================');
    console.log(`✅ Messaging Templates FER Protocol Complete${DRY_RUN ? ' (DRY RUN)' : ''}`);
    console.log('============================================================');
    console.log(`Total Templates Scanned : ${snapshot.size}`);
    console.log(`Templates Enriched      : ${enrichedCount}`);
    console.log(`Templates Skipped       : ${skippedCount}`);
    console.log(`Missing Blueprints Seeded: ${seededCount}`);
    console.log('============================================================\n');

  } catch (err: unknown) {
    console.error('\n❌ FER Protocol execution failed:', err);
    process.exit(1);
  }
}

run();
