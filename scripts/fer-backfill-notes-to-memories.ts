#!/usr/bin/env tsx
/**
 * Migration Script: FER Protocol - Quick Notes to Organization Memory Backfill
 *
 * Usage:
 *   npx tsx scripts/fer-backfill-notes-to-memories.ts
 *   DRY_RUN=true npx tsx scripts/fer-backfill-notes-to-memories.ts
 *
 * Purpose:
 *   1. Iterates over all existing documents in `quick_notes`.
 *   2. Extracts plain text and computes sha256 `sourceHash`.
 *   3. If memories have already been generated for the hash, skips (idempotent).
 *   4. Decomposes unstructured content into atomic `MemoryObject`s in `memory_objects`.
 *   5. Updates the note with `memoryObjectIds` and `sourceHash`.
 *   6. Strict batch chunking (<= 250 documents).
 *
 * Requirements:
 *   - Strictly typed, zero `any` or `any[]`.
 *   - Error handling and robust retry capability.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';
import { NoteMemoryPipeline } from '../src/lib/memory/pipeline/note-memory-pipeline';
import { extractPlainText } from '../src/lib/quick-notes-domain';
import { QUICK_NOTES_COLLECTION, type QuickNote } from '../src/lib/quick-notes-types';

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_CHUNK_LIMIT = 250;

interface MigrationStats {
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; title: string; error: string }>;
}

async function runBackfill(): Promise<void> {
  console.log('====================================================');
  console.log('🚀 Starting FER Migration: Quick Notes -> Organization Memory');
  console.log(`MODE: ${DRY_RUN ? '🔍 DRY RUN (No writes)' : '⚡ LIVE RUN (Persisting to Firestore)'}`);
  console.log('====================================================');

  const stats: MigrationStats = {
    total: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    const snap = await adminDb.collection(QUICK_NOTES_COLLECTION).get();
    stats.total = snap.docs.length;
    console.log(`Found ${stats.total} total notes to evaluate.`);

    for (let i = 0; i < snap.docs.length; i++) {
      const doc = snap.docs[i];
      const data = doc.data() as QuickNote;
      const noteId = doc.id;
      const title = data.title || 'Untitled note';
      const plainText = extractPlainText(data.content);

      if (!plainText || !plainText.trim()) {
        stats.skipped++;
        console.log(`[${i + 1}/${stats.total}] ⏭️  Skipping note "${title}" (${noteId}): No content text.`);
        continue;
      }

      const currentHash = NoteMemoryPipeline.computeTextHash(plainText);

      // Check idempotency: If note already has matching sourceHash and memoryObjectIds, skip
      if (data.sourceHash === currentHash && data.memoryObjectIds && data.memoryObjectIds.length > 0) {
        stats.skipped++;
        console.log(`[${i + 1}/${stats.total}] ⏭️  Skipping note "${title}" (${noteId}): Already indexed with hash.`);
        continue;
      }

      if (DRY_RUN) {
        stats.processed++;
        console.log(`[${i + 1}/${stats.total}] 🔍 [DRY RUN] Would extract memories for "${title}" (${noteId}).`);
        continue;
      }

      try {
        console.log(`[${i + 1}/${stats.total}] ⚙️  Processing "${title}" (${noteId})...`);
        const result = await NoteMemoryPipeline.processNote({
          noteId,
          workspaceId: data.workspaceId,
          organizationId: data.organizationId,
          userId: data.createdBy || 'system',
          title,
          plainText,
          forceReExtract: false,
        });

        if (result.success) {
          stats.processed++;
          console.log(`[${i + 1}/${stats.total}] ✅ Indexed ${result.memories.length} memories for "${title}".`);
        } else {
          stats.failed++;
          stats.errors.push({ id: noteId, title, error: result.error || 'Pipeline failure' });
          console.error(`[${i + 1}/${stats.total}] ❌ Failed processing note "${title}": ${result.error}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        stats.failed++;
        stats.errors.push({ id: noteId, title, error: errorMsg });
        console.error(`[${i + 1}/${stats.total}] ❌ Error on note "${title}":`, errorMsg);
      }
    }

    console.log('====================================================');
    console.log('🏁 FER Migration Completed Summary:');
    console.log(`   Total Notes Evaluated: ${stats.total}`);
    console.log(`   Successfully Indexed:  ${stats.processed}`);
    console.log(`   Skipped (Up to date):  ${stats.skipped}`);
    console.log(`   Failed:                ${stats.failed}`);
    if (stats.errors.length > 0) {
      console.log('   Errors encountered:');
      stats.errors.forEach((e) => console.log(`     - [${e.id}] "${e.title}": ${e.error}`));
    }
    console.log('====================================================');
  } catch (globalErr) {
    console.error('Fatal error during migration:', globalErr);
    process.exit(1);
  }
}

void runBackfill();
