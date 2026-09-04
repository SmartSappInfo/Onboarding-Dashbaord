#!/usr/bin/env tsx
/**
 * Migration Script: FER Protocol - Synchronize Firestore Memories to Qdrant Vector Engine
 *
 * Usage:
 *   npx tsx scripts/fer-sync-memories-to-qdrant.ts
 *   DRY_RUN=true npx tsx scripts/fer-sync-memories-to-qdrant.ts
 *   FORCE_REINDEX=true npx tsx scripts/fer-sync-memories-to-qdrant.ts
 *   TARGET_WORKSPACE_ID=ws_123 npx tsx scripts/fer-sync-memories-to-qdrant.ts
 *
 * Purpose:
 *   1. Iterates over all institutional `MemoryObject` documents in `memory_objects`.
 *   2. Checks whether memory is already indexed (`lifecycle.status === 'indexed'`).
 *   3. If not indexed (or if FORCE_REINDEX is active), semantic-chunks and generates
 *      768-dimensional embeddings using `EmbeddingService`.
 *   4. Upserts typed vector points with isolation filters (`workspaceId`, `organizationId`) to Qdrant.
 *   5. Marks `lifecycle.status` as 'indexed' upon success.
 *   6. Strict batch chunking and rate limiting guardrails.
 *
 * Requirements:
 *   - Strictly typed, zero `any` or `any[]`.
 *   - Robust error reporting and resumption capabilities.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';
import { QdrantIndexer } from '../src/lib/memory/qdrant/qdrant-indexer';
import { MEMORY_OBJECTS_COLLECTION } from '../src/lib/memory/memory-repository';
import type { MemoryObject } from '../src/lib/memory/types';

const DRY_RUN = process.env.DRY_RUN === 'true';
const FORCE_REINDEX = process.env.FORCE_REINDEX === 'true';
const TARGET_WORKSPACE_ID = process.env.TARGET_WORKSPACE_ID || '';
const TARGET_ORG_ID = process.env.TARGET_ORG_ID || '';
const RATE_LIMIT_DELAY_MS = 60;

interface SyncStats {
  totalEvaluated: number;
  indexed: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; title: string; error: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMemorySync(): Promise<void> {
  console.log('====================================================');
  console.log('🚀 Starting FER Memory Sync: Firestore -> Qdrant Vector Engine');
  console.log(`MODE: ${DRY_RUN ? '🔍 DRY RUN (Telemetry only)' : '⚡ LIVE RUN (Upserting to Qdrant & Firestore)'}`);
  if (FORCE_REINDEX) console.log('⚠️  FORCE_REINDEX active: Will re-index already indexed memories.');
  if (TARGET_WORKSPACE_ID) console.log(`🎯 Filtering by Workspace ID: ${TARGET_WORKSPACE_ID}`);
  if (TARGET_ORG_ID) console.log(`🎯 Filtering by Organization ID: ${TARGET_ORG_ID}`);
  console.log('====================================================');

  const stats: SyncStats = {
    totalEvaluated: 0,
    indexed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    let query: FirebaseFirestore.Query = adminDb.collection(MEMORY_OBJECTS_COLLECTION);
    if (TARGET_WORKSPACE_ID) {
      query = query.where('workspaceId', '==', TARGET_WORKSPACE_ID);
    }
    if (TARGET_ORG_ID) {
      query = query.where('organizationId', '==', TARGET_ORG_ID);
    }

    const snap = await query.get();
    stats.totalEvaluated = snap.docs.length;
    console.log(`Found ${stats.totalEvaluated} total memories in scope.`);

    for (let i = 0; i < snap.docs.length; i++) {
      const doc = snap.docs[i];
      const memory = { id: doc.id, ...doc.data() } as MemoryObject;
      const title = memory.title || 'Untitled memory';

      if (!memory.content || !memory.content.trim()) {
        stats.skipped++;
        console.log(`[${i + 1}/${stats.totalEvaluated}] ⏭️  Skipping memory "${title}" (${memory.id}): Empty content.`);
        continue;
      }

      // Check indexing status
      const isAlreadyIndexed = memory.lifecycle?.status === 'indexed';
      if (isAlreadyIndexed && !FORCE_REINDEX) {
        stats.skipped++;
        console.log(`[${i + 1}/${stats.totalEvaluated}] ⏭️  Skipping memory "${title}" (${memory.id}): Already indexed.`);
        continue;
      }

      if (DRY_RUN) {
        stats.indexed++;
        console.log(`[${i + 1}/${stats.totalEvaluated}] 🔍 [DRY RUN] Would chunk & index "${title}" (${memory.id}).`);
        continue;
      }

      try {
        console.log(`[${i + 1}/${stats.totalEvaluated}] ⚙️  Indexing "${title}" (${memory.id})...`);
        const ok = await QdrantIndexer.indexMemory(memory);

        if (ok) {
          stats.indexed++;
          console.log(`[${i + 1}/${stats.totalEvaluated}] ✅ Indexed memory "${title}" (${memory.id})`);
        } else {
          stats.failed++;
          stats.errors.push({
            id: memory.id,
            title,
            error: 'QdrantIndexer.indexMemory returned false.',
          });
          console.error(`[${i + 1}/${stats.totalEvaluated}] ❌ Indexing failed for memory "${title}" (${memory.id})`);
        }

        // Throttle to respect embedding rate limits
        if (RATE_LIMIT_DELAY_MS > 0) {
          await sleep(RATE_LIMIT_DELAY_MS);
        }
      } catch (err) {
        stats.failed++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        stats.errors.push({ id: memory.id, title, error: errorMessage });
        console.error(`[${i + 1}/${stats.totalEvaluated}] ❌ Exception indexing memory "${title}" (${memory.id}):`, errorMessage);
      }
    }
  } catch (err) {
    console.error('Fatal failure reading memory collection:', err);
    process.exit(1);
  }

  console.log('====================================================');
  console.log('🏁 FER Memory Sync Completed Summary:');
  console.log(`   Total Memories Evaluated: ${stats.totalEvaluated}`);
  console.log(`   Successfully Indexed:     ${stats.indexed}`);
  console.log(`   Skipped (Already synced): ${stats.skipped}`);
  console.log(`   Failed:                   ${stats.failed}`);
  if (stats.errors.length > 0) {
    console.log('--- Errors ---');
    stats.errors.slice(0, 10).forEach((e) => {
      console.log(`• [${e.id}] ${e.title}: ${e.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`... and ${stats.errors.length - 10} more errors.`);
    }
  }
  console.log('====================================================');
}

runMemorySync()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Unhandled fatal exception during sync:', err);
    process.exit(1);
  });
