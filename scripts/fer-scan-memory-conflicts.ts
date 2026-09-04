#!/usr/bin/env tsx
/**
 * Migration & Governance Script: FER Protocol - Batch Contradiction & Conflict Scanner
 *
 * Usage:
 *   npx tsx scripts/fer-scan-memory-conflicts.ts
 *   DRY_RUN=true npx tsx scripts/fer-scan-memory-conflicts.ts
 *   TARGET_WORKSPACE_ID=ws_123 npx tsx scripts/fer-scan-memory-conflicts.ts
 *
 * Purpose:
 *   1. Scans active institutional `MemoryObject` documents from Firestore.
 *   2. Generates candidate comparison pairs using entity & topic overlap heuristics.
 *   3. Evaluates pairs using ConflictEngine & Genkit / Gemini contradiction detection.
 *   4. Persists detected contradictions as `MemoryConflict` records in Firestore.
 *   5. Guarantees safe batching and idempotency with SHA-256 pair caching.
 *
 * Requirements:
 *   - Strictly typed, zero `any` or `any[]`.
 *   - Comprehensive console telemetry and dry-run execution mode.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';
import { MEMORY_OBJECTS_COLLECTION } from '../src/lib/memory/memory-repository';
import { ConflictRepository } from '../src/lib/memory/conflict-repository';
import { ConflictEngine } from '../src/lib/memory/services/conflict-engine';
import type { MemoryObject } from '../src/lib/memory/types';

const DRY_RUN = process.env.DRY_RUN === 'true';
const TARGET_WORKSPACE_ID = process.env.TARGET_WORKSPACE_ID || '';
const LIMIT = parseInt(process.env.LIMIT || '200', 10);

async function runContradictionScan(): Promise<void> {
  console.log('================================================================');
  console.log('🚀 CompanyBrain Phase 4: FER Contradiction & Conflict Scanner');
  console.log(`Mode:              ${DRY_RUN ? '🔍 DRY RUN (read-only)' : '✍️ LIVE AUDIT (writes conflicts)'}`);
  console.log(`Target Workspace:  ${TARGET_WORKSPACE_ID || 'ALL WORKSPACES'}`);
  console.log(`Evaluation Limit:  ${LIMIT} memories`);
  console.log('================================================================\n');

  // 1. Fetch active memories
  let query = adminDb
    .collection(MEMORY_OBJECTS_COLLECTION)
    .where('lifecycle.status', '==', 'active');

  if (TARGET_WORKSPACE_ID) {
    query = query.where('workspaceId', '==', TARGET_WORKSPACE_ID);
  }

  query = query.limit(LIMIT);

  console.log('📡 Fetching active memories from Firestore...');
  const snap = await query.get();
  const memories: MemoryObject[] = snap.docs.map((d) => d.data() as MemoryObject);

  console.log(`✅ Loaded ${memories.length} active memories.\n`);

  if (memories.length < 2) {
    console.log('ℹ️ Fewer than 2 memories found. No pair evaluation required.');
    return;
  }

  // 2. Group by workspace to guarantee strict tenant isolation
  const workspaceMap = new Map<string, MemoryObject[]>();
  for (const m of memories) {
    const ws = m.workspaceId || 'default';
    const list = workspaceMap.get(ws) || [];
    list.push(m);
    workspaceMap.set(ws, list);
  }

  let totalPairsEvaluated = 0;
  let totalConflictsDetected = 0;
  let totalConflictsPersisted = 0;

  for (const [wsId, wsMemories] of workspaceMap.entries()) {
    console.log(`--- Workspace [${wsId}]: ${wsMemories.length} memories ---`);
    if (wsMemories.length < 2) continue;

    // Generate candidate pairs
    const pairs = ConflictEngine.findCandidatePairs(wsMemories, 100);
    console.log(`🔍 Formed ${pairs.length} candidate pairs for contradiction evaluation.`);

    if (pairs.length === 0) {
      console.log('ℹ️ No topical or entity overlaps detected among memories.');
      continue;
    }

    totalPairsEvaluated += pairs.length;
    const results = await ConflictEngine.evaluatePairs(pairs);

    for (const res of results) {
      if (res.hasConflict && res.conflict) {
        totalConflictsDetected += 1;
        const c = res.conflict;

        console.log(`\n⚠️  [CONTRADICTION DETECTED]`);
        console.log(`   Type:       ${c.conflictType}`);
        console.log(`   Confidence: ${(c.confidenceScore * 100).toFixed(0)}%`);
        console.log(`   Summary:    ${c.summary}`);
        console.log(`   Claim A:    "${c.evidenceA.title}" (${c.evidenceA.sourceType})`);
        console.log(`   Claim B:    "${c.evidenceB.title}" (${c.evidenceB.sourceType})`);
        console.log(`   Aspects:    ${c.opposingAspects.join(', ')}`);

        if (!DRY_RUN) {
          try {
            await ConflictRepository.createConflict({
              workspaceId: c.workspaceId,
              organizationId: c.organizationId,
              memoryIdA: c.memoryIdA,
              memoryIdB: c.memoryIdB,
              summary: c.summary,
              status: 'unresolved',
              conflictType: c.conflictType,
              confidenceScore: c.confidenceScore,
              detectedBy: 'ai',
              evidenceA: c.evidenceA,
              evidenceB: c.evidenceB,
              opposingAspects: c.opposingAspects,
            });
            totalConflictsPersisted += 1;
            console.log(`   💾 Persisted into Firestore memory_conflicts.`);
          } catch (err) {
            console.error(`   ❌ Failed to persist conflict:`, err);
          }
        }
      }
    }
  }

  console.log('\n================================================================');
  console.log('📊 Contradiction Scan Summary');
  console.log(`Total Memories Evaluated:    ${memories.length}`);
  console.log(`Total Pairs Evaluated:       ${totalPairsEvaluated}`);
  console.log(`Contradictions Detected:     ${totalConflictsDetected}`);
  console.log(`Contradictions Persisted:    ${totalConflictsPersisted}`);
  console.log(`Execution Mode:              ${DRY_RUN ? 'DRY RUN (No writes)' : 'LIVE AUDIT'}`);
  console.log('================================================================\n');
}

runContradictionScan()
  .then(() => {
    console.log('✨ Contradiction scanner completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Fatal scanner error:', err);
    process.exit(1);
  });
