#!/usr/bin/env tsx
// @ts-nocheck
/**
 * Migration Script: FER Protocol - Template Identifiers
 *
 * Usage:
 *   npx tsx scripts/fer-template-identifiers.ts
 *   DRY_RUN=true npx tsx scripts/fer-template-identifiers.ts
 *
 * What it does:
 *   Updates all existing `message_templates` documents that lack a `templateType`.
 *   It applies the standard `slugify` function to the template's `name` to generate
 *   the missing identifier.
 *
 * Idempotent: Only updates documents that are missing the `templateType` field.
 */

import * as dotenv from 'dotenv';
dotenv.config();

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 400; // Firestore batch limit is 500
const NOW = new Date().toISOString();

interface MigrationStats {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; name: string; error: string }>;
}

const slugify = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

function buildUpdatePayload(
  data: FirebaseFirestore.DocumentData,
  docId: string
): Record<string, unknown> | null {
  const updates: Record<string, unknown> = {};

  // Check if templateType is missing or empty string
  if (!data.templateType || data.templateType.trim() === '') {
    const rawName = data.name || `untitled_template_${docId}`;
    const generatedSlug = slugify(rawName);
    
    // Fallback if slugify results in empty string
    updates.templateType = generatedSlug || `fallback_key_${docId}`;
  }

  // Stamp updatedAt
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = NOW;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

async function migrateTemplateIdentifiers(): Promise<void> {
  console.log(`\n🔄 FER: Migrating Template Identifiers${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let hasMore = true;

  while (hasMore) {
    let q = adminDb
      .collection('message_templates')
      .orderBy('__name__')
      .limit(BATCH_SIZE);

    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const snapshot = await q.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.docs.length === BATCH_SIZE;

    const toUpdate: Array<{ ref: FirebaseFirestore.DocumentReference; payload: Record<string, unknown>; name: string }> = [];

    for (const doc of snapshot.docs) {
      stats.total++;
      const data = doc.data();
      const payload = buildUpdatePayload(data, doc.id);

      if (!payload) {
        stats.skipped++;
        continue;
      }

      toUpdate.push({ ref: doc.ref, payload, name: data.name ?? doc.id });
    }

    if (toUpdate.length === 0) {
      continue;
    }

    if (DRY_RUN) {
      for (const item of toUpdate) {
        console.log(`  🔍 Would update: "${item.name}" (${item.ref.id})`);
        console.log(`     New templateType: ${item.payload.templateType}`);
        stats.updated++;
      }
      continue;
    }

    const batch = adminDb.batch();
    for (const item of toUpdate) {
      batch.update(item.ref, item.payload);
    }

    try {
      await batch.commit();
      for (const item of toUpdate) {
        console.log(`  ✅ Updated: "${item.name}" (${item.ref.id}) -> [${item.payload.templateType}]`);
        stats.updated++;
      }
    } catch (err) {
      console.warn('  ⚠️  Batch commit failed, retrying individually...');
      for (const item of toUpdate) {
        try {
          await item.ref.update(item.payload);
          console.log(`  ✅ Updated: "${item.name}" (${item.ref.id}) -> [${item.payload.templateType}]`);
          stats.updated++;
        } catch (itemErr) {
          const message = itemErr instanceof Error ? itemErr.message : String(itemErr);
          console.error(`  ❌ Failed: "${item.name}" (${item.ref.id}) — ${message}`);
          stats.failed++;
          stats.errors.push({ id: item.ref.id, name: item.name, error: message });
        }
      }
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`📊 Migration Summary${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`   Total documents scanned : ${stats.total}`);
  console.log(`   Updated / Enriched      : ${stats.updated}`);
  console.log(`   Skipped (already ok)    : ${stats.skipped}`);
  console.log(`   Failed                  : ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const e of stats.errors) {
      console.log(`   • [${e.id}] "${e.name}": ${e.error}`);
    }
    process.exit(1);
  }

  console.log('\n✅ FER Protocol Complete.\n');
}

migrateTemplateIdentifiers().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
