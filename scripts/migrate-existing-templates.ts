#!/usr/bin/env tsx
/**
 * Migration Script: Migrate Existing Message Templates to Two-Tier Schema
 *
 * Usage:
 *   npx tsx scripts/migrate-existing-templates.ts
 *   DRY_RUN=true npx tsx scripts/migrate-existing-templates.ts
 *   USE_EMULATOR=true npx tsx scripts/migrate-existing-templates.ts
 *
 * What it does:
 *   Updates all existing `message_templates` documents that lack the new
 *   two-tier schema fields, adding safe defaults:
 *     - scope: 'organization'
 *     - status: 'approved'
 *     - version: 1
 *     - category: 'general'
 *     - templateType: 'custom'
 *
 * Idempotent: Only updates documents that are missing the new fields.
 * Existing field values are never overwritten.
 */

import * as dotenv from 'dotenv';
dotenv.config();

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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

// ---------------------------------------------------------------------------
// Field migration helpers
// ---------------------------------------------------------------------------

/**
 * Builds the update payload for a document that is missing new schema fields.
 * Returns null if the document already has all required fields.
 */
function buildUpdatePayload(
  data: FirebaseFirestore.DocumentData
): Record<string, unknown> | null {
  const updates: Record<string, unknown> = {};

  // 7.2 — scope: 'organization' for all existing templates that lack the field
  if (!data.scope) {
    updates.scope = 'organization';
  }

  // 7.3 — status: 'approved' for templates that lack the field
  if (!data.status) {
    updates.status = 'approved';
  }

  // 7.4 — version: 1 for templates that lack the field
  if (data.version === undefined || data.version === null) {
    updates.version = 1;
  }

  // 7.5 — category: 'general' and templateType: 'custom' as defaults
  if (!data.category) {
    updates.category = 'general';
  }
  if (!data.templateType) {
    updates.templateType = 'custom';
  }

  // Always stamp updatedAt when we touch a document
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = NOW;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function migrateExistingTemplates(): Promise<void> {
  console.log(`\n🔄 Migrating existing message_templates${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Stream all documents in pages to avoid loading everything into memory
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

    // Collect documents that need updating
    const toUpdate: Array<{ ref: FirebaseFirestore.DocumentReference; payload: Record<string, unknown>; name: string }> = [];

    for (const doc of snapshot.docs) {
      stats.total++;
      const data = doc.data();
      const payload = buildUpdatePayload(data);

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
        console.log(`     Fields: ${Object.keys(item.payload).filter(k => k !== 'updatedAt').join(', ')}`);
        stats.updated++;
      }
      continue;
    }

    // Write in a single batch
    const batch = adminDb.batch();
    for (const item of toUpdate) {
      batch.update(item.ref, item.payload);
    }

    try {
      await batch.commit();
      for (const item of toUpdate) {
        console.log(`  ✅ Updated: "${item.name}" (${item.ref.id})`);
        stats.updated++;
      }
    } catch (err) {
      // If the batch fails, fall back to individual updates so we can isolate failures
      console.warn('  ⚠️  Batch commit failed, retrying individually...');
      for (const item of toUpdate) {
        try {
          await item.ref.update(item.payload);
          console.log(`  ✅ Updated: "${item.name}" (${item.ref.id})`);
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

  // Summary
  console.log('\n─────────────────────────────────────────');
  console.log(`📊 Migration Summary${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`   Total documents  : ${stats.total}`);
  console.log(`   Updated          : ${stats.updated}`);
  console.log(`   Skipped (ok)     : ${stats.skipped}`);
  console.log(`   Failed           : ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const e of stats.errors) {
      console.log(`   • [${e.id}] "${e.name}": ${e.error}`);
    }
    process.exit(1);
  }

  console.log('\n✅ Done.\n');
}

migrateExistingTemplates().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
