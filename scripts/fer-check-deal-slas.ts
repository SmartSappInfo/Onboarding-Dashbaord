/**
 * FER Protocol Script: FER-05 Deal Stage SLA Breach & Stagnation Check
 *
 * ARCHITECTURAL POINTER (Rule 10 & Rule 8):
 * - Evaluates open deals across all workspaces against stage SLAs.
 * - Enforces batch chunking <= 350 operations per commit.
 * - Provides dry-run inspection mode.
 *
 * Usage:
 *   npx tsx scripts/fer-check-deal-slas.ts [--dry-run]
 */

import { adminDb } from '../src/lib/firebase-admin';
import { evaluateWorkspaceDealSlasAction } from '../src/lib/deals/deal-sla-monitor';

async function runSlaCheck() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`🚀 Starting FER-05 Deal SLA Evaluation (DryRun: ${isDryRun})...\n`);

  const workspacesSnap = await adminDb.collection('workspaces').get();
  console.log(`📊 Found ${workspacesSnap.size} total workspaces to check.`);

  let totalChecked = 0;
  let totalBreached = 0;
  let totalStalled = 0;
  let totalAlerted = 0;

  for (const doc of workspacesSnap.docs) {
    const wsId = doc.id;
    const wsName = doc.data().name || wsId;

    if (isDryRun) {
      console.log(`  [DryRun] Would evaluate workspace "${wsName}" (${wsId})`);
      continue;
    }

    const res = await evaluateWorkspaceDealSlasAction(wsId);
    if (res.success) {
      totalChecked += res.totalEvaluated;
      totalBreached += res.breachedCount;
      totalStalled += res.stalledCount;
      totalAlerted += res.alertedCount;

      if (res.breachedCount > 0 || res.stalledCount > 0) {
        console.log(`  [Workspace "${wsName}"] Evaluated: ${res.totalEvaluated}, Breached: ${res.breachedCount}, Stalled: ${res.stalledCount}, Alerted: ${res.alertedCount}`);
      }
    } else {
      console.warn(`  ⚠️ Failed to check workspace "${wsName}": ${res.error}`);
    }
  }

  console.log('\n=========================================');
  console.log(`✅ FER-05 SLA Check Complete!`);
  console.log(`   - Deals Evaluated: ${totalChecked}`);
  console.log(`   - SLA Breached:    ${totalBreached}`);
  console.log(`   - Stalled Deals:   ${totalStalled}`);
  console.log(`   - Alerts Emitted:  ${totalAlerted}`);
  console.log('=========================================\n');
}

runSlaCheck().catch(err => {
  console.error('❌ FER-05 SLA Check Failed:', err);
  process.exit(1);
});
