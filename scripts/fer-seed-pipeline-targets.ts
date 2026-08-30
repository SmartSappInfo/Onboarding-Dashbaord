/**
 * @fileoverview FER-07 Seeding Protocol: Initialize Pipeline Revenue Targets / Quotas
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 124 & Section 48):
 * - Seeds standard baseline revenue targets (Current Month & Current Quarter)
 *   into workspace `pipeline_targets` collection for zero-state onboarding.
 * - Adheres strictly to the FER (Fetch, Enrich, Restore) protocol.
 * - Idempotent, non-destructive, supports --dry-run mode, and batches commits <= 350 ops.
 *
 * USAGE:
 *   npx tsx scripts/fer-seed-pipeline-targets.ts [--dry-run] [--workspace-id=<id>]
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Parse command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const workspaceArg = args.find(a => a.startsWith('--workspace-id='));
const targetWorkspaceId = workspaceArg ? workspaceArg.split('=')[1] : null;

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    initializeApp();
  }
}

const db = getFirestore();

async function runSeedTargets(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🚀 FER-07 PROTOCOL: SEEDING PIPELINE REVENUE TARGETS');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Simulated)' : 'LIVE COMMITS'}`);
  console.log(`Target Workspace: ${targetWorkspaceId || 'ALL WORKSPACES'}`);
  console.log('='.repeat(60));

  // 1. Fetch Workspaces
  let workspacesSnap;
  if (targetWorkspaceId) {
    const wsDoc = await db.collection('workspaces').doc(targetWorkspaceId).get();
    if (!wsDoc.exists) {
      console.error(`❌ Workspace ${targetWorkspaceId} not found.`);
      process.exit(1);
    }
    workspacesSnap = [wsDoc];
  } else {
    const allWs = await db.collection('workspaces').get();
    workspacesSnap = allWs.docs;
  }

  console.log(`\nFound ${workspacesSnap.length} workspace(s) to inspect.\n`);

  let totalCreated = 0;
  let totalSkipped = 0;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentQuarter = `Q${Math.floor(now.getMonth() / 3) + 1}`;

  const currentMonthPeriod = `${currentYear}-${currentMonth}`;
  const currentQuarterPeriod = `${currentYear}-${currentQuarter}`;

  const standardTargets = [
    { period: currentMonthPeriod, amount: 100000, desc: 'Monthly Target' },
    { period: currentQuarterPeriod, amount: 300000, desc: 'Quarterly Target' },
  ];

  for (const ws of workspacesSnap) {
    const wsData = ws.data() || {};
    const currency = wsData.currency || 'GHS';
    console.log(`📁 Processing Workspace: "${wsData.name || ws.id}" (${ws.id})`);

    // Fetch existing targets
    const existingSnap = await db.collection('pipeline_targets')
      .where('workspaceId', '==', ws.id)
      .get();

    const existingPeriods = new Set(existingSnap.docs.map(d => d.data().period));

    const batch = db.batch();
    let batchCount = 0;

    for (const target of standardTargets) {
      if (existingPeriods.has(target.period)) {
        console.log(`  ⏩ Skipping existing target for period: "${target.period}"`);
        totalSkipped++;
        continue;
      }

      const docRef = db.collection('pipeline_targets').doc();
      const payload = {
        id: docRef.id,
        workspaceId: ws.id,
        pipelineId: null, // Workspace level default
        period: target.period,
        targetAmount: target.amount,
        currency,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!isDryRun) {
        batch.set(docRef, payload);
        batchCount++;
      }

      console.log(`  ✨ [${isDryRun ? 'DRY-RUN' : 'QUEUED'}] Seed ${target.desc} (${target.period}): ${currency} ${target.amount.toLocaleString()}`);
      totalCreated++;
    }

    if (!isDryRun && batchCount > 0) {
      await batch.commit();
      console.log(`  💾 Committed ${batchCount} target(s) to workspace ${ws.id}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 FER-07 SEEDING PROTOCOL COMPLETE');
  console.log(`Total Targets Created: ${totalCreated}`);
  console.log(`Total Targets Skipped: ${totalSkipped}`);
  console.log('='.repeat(60));
}

runSeedTargets().catch(err => {
  console.error('❌ Seeding Protocol Failed:', err);
  process.exit(1);
});
