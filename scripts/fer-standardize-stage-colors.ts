/**
 * @fileoverview FER Protocol: Standardize Pipeline Stage Colors to Neutral & Semantic Palettes
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION:
 * - Normalizes all existing pipeline stages across all workspaces to eliminate rainbow clutter.
 * - Intermediate stages are standardized to neutral slate (#64748B).
 * - Terminal Won stages are normalized to semantic emerald (#10B981).
 * - Terminal Lost stages are normalized to semantic rose (#EF4444).
 * - Adheres strictly to the FER (Fetch, Enrich, Restore) protocol:
 *   1. Fetch: Scans all stages in `onboardingStages` and `stages` collections.
 *   2. Enrich: Determines target color using terminal flags (isWon/isLost) or semantic name inference.
 *   3. Restore: Commits non-destructive updates in safe chunks (<= 350 ops per batch).
 * - Idempotent, safe, and supports --dry-run mode.
 *
 * USAGE:
 *   npx tsx scripts/fer-standardize-stage-colors.ts [--dry-run] [--pipeline-id=<id>]
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Parse command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const pipelineArg = args.find(a => a.startsWith('--pipeline-id='));
const targetPipelineId = pipelineArg ? pipelineArg.split('=')[1] : null;

// Standardized color constants
const DEFAULT_STAGE_COLOR = '#64748B';
const TERMINAL_WON_COLOR = '#10B981';
const TERMINAL_LOST_COLOR = '#EF4444';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
    });
  }
}

const db = getFirestore();

interface StageRecord {
  id: string;
  collectionName: string;
  name: string;
  pipelineId?: string;
  currentColor: string;
  targetColor: string;
  reason: string;
  isWon?: boolean;
  isLost?: boolean;
}

function determineTargetColor(data: {
  name?: string;
  color?: string;
  isWon?: boolean;
  isLost?: boolean;
  terminalType?: string;
}): { targetColor: string; reason: string } {
  const name = (data.name || '').trim().toLowerCase();
  const terminalType = data.terminalType || 'none';

  // 1. Explicit Won Flag or Terminal Type
  if (data.isWon === true || terminalType === 'won') {
    return { targetColor: TERMINAL_WON_COLOR, reason: 'Explicit terminal won flag' };
  }

  // 2. Explicit Lost Flag or Terminal Type
  if (data.isLost === true || terminalType === 'lost') {
    return { targetColor: TERMINAL_LOST_COLOR, reason: 'Explicit terminal lost flag' };
  }

  // 3. Name inference for Won
  if (
    name.includes('won') ||
    name === 'completed' ||
    name === 'completed & active' ||
    name === 'active' ||
    name === 'renewed' ||
    name === 'enrolled'
  ) {
    return { targetColor: TERMINAL_WON_COLOR, reason: `Inferred won terminal from name: "${data.name}"` };
  }

  // 4. Name inference for Lost
  if (
    name.includes('lost') ||
    name === 'churned' ||
    name === 'dropped' ||
    name === 'disqualified' ||
    name === 'cancelled'
  ) {
    return { targetColor: TERMINAL_LOST_COLOR, reason: `Inferred lost terminal from name: "${data.name}"` };
  }

  // 5. Intermediate Stage: Standard Neutral Slate
  return { targetColor: DEFAULT_STAGE_COLOR, reason: 'Intermediate stage neutral standardization' };
}

async function runFerStageColors() {
  console.log('='.repeat(70));
  console.log('🚀 FER PROTOCOL: PIPELINE STAGE COLOR STANDARDIZATION');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (No writes)' : '⚡ LIVE EXECUTION'}`);
  console.log(`Target Pipeline: ${targetPipelineId || 'ALL PIPELINES'}`);
  console.log(`Neutral Intermediate Color: ${DEFAULT_STAGE_COLOR}`);
  console.log(`Semantic Won Color:        ${TERMINAL_WON_COLOR}`);
  console.log(`Semantic Lost Color:       ${TERMINAL_LOST_COLOR}`);
  console.log('='.repeat(70));

  const collectionsToScan = ['onboardingStages', 'stages'];
  const stagesToUpdate: StageRecord[] = [];
  let totalScanned = 0;
  let totalAlreadyClean = 0;

  for (const colName of collectionsToScan) {
    console.log(`\n📂 Scanning collection: "${colName}"...`);
    let q = db.collection(colName) as FirebaseFirestore.Query;
    if (targetPipelineId) {
      q = q.where('pipelineId', '==', targetPipelineId);
    }

    const snap = await q.get();
    console.log(`   Found ${snap.size} documents in "${colName}".`);

    snap.forEach((doc) => {
      totalScanned++;
      const data = doc.data();
      const currentColor = (data.color || '').trim();
      const { targetColor, reason } = determineTargetColor(data);

      const isSameColor = currentColor.toLowerCase() === targetColor.toLowerCase();

      if (isSameColor) {
        totalAlreadyClean++;
      } else {
        stagesToUpdate.push({
          id: doc.id,
          collectionName: colName,
          name: data.name || 'Unnamed Stage',
          pipelineId: data.pipelineId,
          currentColor: currentColor || '(unset)',
          targetColor,
          reason,
          isWon: Boolean(data.isWon),
          isLost: Boolean(data.isLost),
        });
      }
    });
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`📊 AUDIT SUMMARY:`);
  console.log(`   Total stages scanned:       ${totalScanned}`);
  console.log(`   Already standardized:       ${totalAlreadyClean}`);
  console.log(`   Requiring color update:     ${stagesToUpdate.length}`);
  console.log('-'.repeat(70));

  if (stagesToUpdate.length === 0) {
    console.log('✨ All stages are already standardized with neutral/semantic palettes! Zero work needed.');
    return;
  }

  // Display sample of updates
  console.log('\n🔍 Planned Transformations (Sample):');
  stagesToUpdate.slice(0, 15).forEach((s, idx) => {
    console.log(
      `   ${idx + 1}. [${s.collectionName}/${s.id}] "${s.name}" (${s.pipelineId || 'no-pipe'})`
    );
    console.log(
      `      ${s.currentColor} -> ${s.targetColor} (${s.reason})`
    );
  });
  if (stagesToUpdate.length > 15) {
    console.log(`   ... and ${stagesToUpdate.length - 15} more stages.`);
  }

  if (isDryRun) {
    console.log('\n🔍 DRY RUN COMPLETE: No modifications were made to Firestore.');
    return;
  }

  // RESTORE: Commit in batches <= 350 ops (Rule 8)
  console.log('\n💾 RESTORING: Committing updates to Firestore in safe chunks (<= 350 ops)...');
  const CHUNK_SIZE = 350;
  const timestamp = new Date().toISOString();
  let batchesCommitted = 0;
  let recordsUpdated = 0;

  for (let i = 0; i < stagesToUpdate.length; i += CHUNK_SIZE) {
    const chunk = stagesToUpdate.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();

    for (const item of chunk) {
      const docRef = db.collection(item.collectionName).doc(item.id);
      batch.update(docRef, {
        color: item.targetColor,
        updatedAt: timestamp,
      });
    }

    await batch.commit();
    batchesCommitted++;
    recordsUpdated += chunk.length;
    console.log(`   ✅ Committed batch ${batchesCommitted} (${recordsUpdated}/${stagesToUpdate.length} stages restored)`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎉 FER PROTOCOL COMPLETED SUCCESSFULLY!');
  console.log(`   Total stages restored:  ${recordsUpdated}`);
  console.log(`   Batches executed:       ${batchesCommitted}`);
  console.log(`   Timestamp:              ${timestamp}`);
  console.log('='.repeat(70));
}

runFerStageColors().catch((err) => {
  console.error('❌ FER Protocol failed with error:', err);
  process.exit(1);
});
