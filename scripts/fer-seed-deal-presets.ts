/**
 * @fileoverview FER-06 Seeding Protocol: Initialize Deal Saved View System Presets
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 123):
 * - Seeds standard deal system presets (My Deals, Closing This Month, At Risk, Stalled, High Value)
 *   into workspace `deal_saved_views` collection for zero-state onboarding.
 * - Adheres strictly to the FER (Fetch, Enrich, Restore) protocol.
 * - Idempotent, non-destructive, supports --dry-run mode, and batches commits <= 350 ops.
 *
 * USAGE:
 *   npx tsx scripts/fer-seed-deal-presets.ts [--dry-run] [--workspace-id=<id>]
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { SYSTEM_SAVED_VIEW_PRESETS } from '../src/lib/deals/deal-saved-views';

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
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
    });
  }
}

const db = getFirestore();

async function runSeedPresets() {
  console.log('='.repeat(60));
  console.log('🚀 FER-06: DEAL SAVED VIEWS PRESET SEEDING PROTOCOL');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (No writes)' : '⚡ LIVE EXECUTION'}`);
  console.log(`Target Workspace: ${targetWorkspaceId || 'ALL WORKSPACES'}`);
  console.log('='.repeat(60));

  // 1. Fetch Workspaces
  let workspaces: Array<{ id: string; name?: string }> = [];
  if (targetWorkspaceId) {
    workspaces = [{ id: targetWorkspaceId }];
  } else {
    const wsSnap = await db.collection('workspaces').get();
    workspaces = wsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  if (workspaces.length === 0) {
    console.log('⚠️ No workspaces found to seed.');
    return;
  }

  console.log(`📁 Found ${workspaces.length} workspace(s) to process.\n`);

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const ws of workspaces) {
    console.log(`--- Processing Workspace: ${ws.name || ws.id} (${ws.id}) ---`);

    // Fetch existing views for workspace
    const viewsSnap = await db
      .collection('deal_saved_views')
      .where('workspaceId', '==', ws.id)
      .get();

    const existingNames = new Set(viewsSnap.docs.map(d => d.data().name?.toLowerCase()));

    const batch = db.batch();
    let batchCount = 0;

    for (const preset of SYSTEM_SAVED_VIEW_PRESETS) {
      if (existingNames.has(preset.name.toLowerCase())) {
        console.log(`  ⏩ Skipping existing view: "${preset.name}"`);
        totalSkipped++;
        continue;
      }

      const docRef = db.collection('deal_saved_views').doc();
      const payload = {
        name: preset.name,
        description: preset.description || '',
        icon: preset.icon || 'Bookmark',
        color: preset.color || '#3b82f6',
        workspaceId: ws.id,
        userId: 'system',
        isShared: true,
        isDefault: preset.id === 'preset_all_deals',
        filters: preset.filters,
        columns: preset.columns || [],
        density: preset.density || 'standard',
        viewMode: preset.viewMode || 'board',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!isDryRun) {
        batch.set(docRef, payload);
        batchCount++;
      }

      console.log(`  ✨ [${isDryRun ? 'DRY-RUN' : 'QUEUED'}] Seed Preset: "${preset.name}"`);
      totalCreated++;
    }

    if (!isDryRun && batchCount > 0) {
      await batch.commit();
      console.log(`  💾 Committed ${batchCount} preset(s) to workspace ${ws.id}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 FER-06 SEEDING PROTOCOL COMPLETE');
  console.log(`Total Presets Created: ${totalCreated}`);
  console.log(`Total Presets Skipped: ${totalSkipped}`);
  console.log('='.repeat(60));
}

runSeedPresets().catch(err => {
  console.error('❌ Seeding Protocol Failed:', err);
  process.exit(1);
});
