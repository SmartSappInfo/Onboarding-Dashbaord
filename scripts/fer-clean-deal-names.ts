#!/usr/bin/env tsx
/**
 * Migration Script: FER Protocol - Clean Legacy Deal Names
 *
 * Usage:
 *   npx tsx scripts/fer-clean-deal-names.ts
 *   DRY_RUN=true npx tsx scripts/fer-clean-deal-names.ts
 *   npx tsx scripts/fer-clean-deal-names.ts --workspace=<workspaceId>
 *
 * What it does:
 *   1. Scans all `deals` documents in Firestore that start with "Deal for " / "Deal For ".
 *   2. Batches entity lookups via `adminDb.getAll` to restore full canonical names in seconds.
 *   3. Restores / commits the clean name back to Firestore in safe batches of 400.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables immediately on module load
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const BATCH_SIZE = 400; // Firestore batch limit is 500
const NOW = new Date().toISOString();

interface MigrationStats {
  totalScanned: number;
  totalMatched: number;
  updated: number;
  skipped: number;
  failed: number;
  samples: Array<{ id: string; before: string; after: string }>;
  errors: Array<{ id: string; name: string; error: string }>;
}

async function cleanDealNames(): Promise<void> {
  const args = process.argv.slice(2);
  const workspaceArg = args.find((a) => a.startsWith('--workspace='));
  const targetWorkspaceId = workspaceArg ? workspaceArg.split('=')[1] : undefined;

  console.log(`\n🔄 FER Protocol: Clean Legacy Deal Names${DRY_RUN ? ' (DRY RUN)' : ''}...`);
  if (targetWorkspaceId) {
    console.log(`🎯 Targeted Workspace: ${targetWorkspaceId}`);
  }

  const stats: MigrationStats = {
    totalScanned: 0,
    totalMatched: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    samples: [],
    errors: [],
  };

  let query: FirebaseFirestore.Query = adminDb.collection('deals');
  if (targetWorkspaceId) {
    query = query.where('workspaceId', '==', targetWorkspaceId);
  }

  const snapshot = await query.get();
  stats.totalScanned = snapshot.size;
  console.log(`📊 Total Deals Scanned: ${stats.totalScanned}`);

  // 1. Identify matched deals
  const matchedDocs: Array<{ id: string; currentName: string; entityId?: string; workspaceId?: string }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const currentName = (data.name || '').trim();

    if (/^deal\s+for\s+/i.test(currentName)) {
      matchedDocs.push({
        id: doc.id,
        currentName,
        entityId: data.entityId,
        workspaceId: data.workspaceId || targetWorkspaceId,
      });
    }
  }

  stats.totalMatched = matchedDocs.length;
  console.log(`🎯 Deals Matched with "Deal for" Prefix: ${stats.totalMatched}`);

  if (stats.totalMatched === 0) {
    console.log('\n✅ No deals need updating. All deal names are clean!\n');
    return;
  }

  // 2. Collect unique entity references for batch resolution
  const entityRefs: Array<FirebaseFirestore.DocumentReference> = [];
  const entityKeySet = new Set<string>();

  for (const item of matchedDocs) {
    if (item.entityId && item.workspaceId) {
      const docPath = `workspace_entities/${item.workspaceId}_${item.entityId}`;
      if (!entityKeySet.has(docPath)) {
        entityKeySet.add(docPath);
        entityRefs.push(adminDb.collection('workspace_entities').doc(`${item.workspaceId}_${item.entityId}`));
      }
    }
    if (item.entityId) {
      const docPath = `workspace_entities/${item.entityId}`;
      if (!entityKeySet.has(docPath)) {
        entityKeySet.add(docPath);
        entityRefs.push(adminDb.collection('workspace_entities').doc(item.entityId));
      }
    }
  }

  console.log(`⚡ Batch Resolving ${entityRefs.length} Entity Records...`);

  // 3. Batch fetch entities in chunks of 200
  const entityCache = new Map<string, string>();
  const LOOKUP_CHUNK = 200;

  for (let i = 0; i < entityRefs.length; i += LOOKUP_CHUNK) {
    const chunk = entityRefs.slice(i, i + LOOKUP_CHUNK);
    const snaps = await adminDb.getAll(...chunk);
    for (const snap of snaps) {
      if (snap.exists) {
        const data = snap.data();
        const name = (data?.displayName || data?.name || data?.entityName || '').trim();
        if (name) {
          entityCache.set(snap.id, name);
        }
      }
    }
  }

  // 4. Enrich & Build Update List
  const dealsToUpdate: Array<{ id: string; before: string; after: string }> = [];

  for (const item of matchedDocs) {
    let cleanName = '';

    if (item.entityId && item.workspaceId) {
      cleanName = entityCache.get(`${item.workspaceId}_${item.entityId}`) || '';
    }
    if (!cleanName && item.entityId) {
      cleanName = entityCache.get(item.entityId) || '';
    }

    // Fallback: cleanly strip the "Deal for " prefix and remove any trailing ellipsis/dots
    if (!cleanName) {
      cleanName = item.currentName.replace(/^deal\s+for\s+/i, '').replace(/\.{2,}$/, '').trim();
    }

    if (cleanName && cleanName !== item.currentName) {
      dealsToUpdate.push({
        id: item.id,
        before: item.currentName,
        after: cleanName,
      });

      if (stats.samples.length < 10) {
        stats.samples.push({
          id: item.id,
          before: item.currentName,
          after: cleanName,
        });
      }
    } else {
      stats.skipped++;
    }
  }

  console.log(`📝 Deals Queued for Name Restoration: ${dealsToUpdate.length}`);

  if (stats.samples.length > 0) {
    console.log('\n🔍 Sample Restorations (First 10):');
    stats.samples.forEach((idx_s, idx) => {
      console.log(`  ${idx + 1}. [${idx_s.id}] "${idx_s.before}" -> "${idx_s.after}"`);
    });
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN complete. No Firestore writes were executed.\n');
    return;
  }

  if (dealsToUpdate.length === 0) {
    console.log('\n✅ No deals need updating. All deal names are clean!\n');
    return;
  }

  // 5. Batch commit in safe chunks
  console.log(`\n💾 Committing ${dealsToUpdate.length} deal name updates in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < dealsToUpdate.length; i += BATCH_SIZE) {
    const chunk = dealsToUpdate.slice(i, i + BATCH_SIZE);
    const batch = adminDb.batch();

    for (const item of chunk) {
      const ref = adminDb.collection('deals').doc(item.id);
      batch.update(ref, {
        name: item.after,
        updatedAt: NOW,
      });
    }

    try {
      await batch.commit();
      stats.updated += chunk.length;
      console.log(`  ✅ Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} docs)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, msg);
      stats.failed += chunk.length;
      chunk.forEach((item) => {
        stats.errors.push({ id: item.id, name: item.before, error: msg });
      });
    }
  }

  console.log('\n==========================================');
  console.log('🎉 FER Deal Name Migration Complete!');
  console.log(`  - Total Scanned: ${stats.totalScanned}`);
  console.log(`  - Total Matched: ${stats.totalMatched}`);
  console.log(`  - Updated:       ${stats.updated}`);
  console.log(`  - Skipped:       ${stats.skipped}`);
  console.log(`  - Failed:        ${stats.failed}`);
  console.log('==========================================\n');
}

cleanDealNames()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error during migration:', err);
    process.exit(1);
  });
