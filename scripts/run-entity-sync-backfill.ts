/**
 * CLI Runner for Entity and Workspace Reconciliation & Backfill.
 * 
 * Usage:
 *   npx tsx scripts/run-entity-sync-backfill.ts --dry-run
 *   npx tsx scripts/run-entity-sync-backfill.ts --live
 */

import './bootstrap';
import { reconcileEntitiesAndWorkspaces } from '../src/lib/entities/backfill-entity-sync';

async function main() {
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');
  const isDryRun = !isLive || args.includes('--dry-run');

  const cursorIndex = args.indexOf('--cursor');
  let cursor: string | null = cursorIndex !== -1 && args[cursorIndex + 1] ? args[cursorIndex + 1] : null;

  const pageIndex = args.indexOf('--page');
  let pageNumber = pageIndex !== -1 && args[pageIndex + 1] ? parseInt(args[pageIndex + 1], 10) : 1;

  console.log(`=======================================================`);
  console.log(`[ENTITY SYNC RECONCILIATION] Mode: ${isDryRun ? 'DRY RUN (Preview Only)' : 'LIVE EXECUTION'}`);
  console.log(`Starting at Page: ${pageNumber} | Cursor: ${cursor || 'start'}`);
  console.log(`=======================================================\n`);

  let totalProcessed = 0;
  let totalDrifted = 0;
  let totalHealed = 0;
  let totalWorkspacesHealed = 0;

  do {
    console.log(`Scanning page ${pageNumber}... (cursor: ${cursor || 'start'})`);
    const result = await reconcileEntitiesAndWorkspaces({
      limit: 100,
      afterId: cursor || undefined,
      dryRun: isDryRun,
      skipAuth: true,
    });

    totalProcessed += result.processedEntities;
    totalDrifted += result.driftedEntitiesCount;
    totalHealed += result.healedEntitiesCount;
    totalWorkspacesHealed += result.healedWorkspaceEntitiesCount;

    console.log(`Page ${pageNumber} complete: ${result.processedEntities} scanned, ${result.driftReports.length} drifted, ${result.healedEntitiesCount} healed.`);

    if (result.driftReports.length > 0) {
      console.log(`Found ${result.driftReports.length} drifted workspace projection(s) on page ${pageNumber}:`);
      for (const report of result.driftReports) {
        console.log(`  - Entity: ${report.entityId} -> Workspace: ${report.workspaceId}`);
        console.log(`    Drifted fields: ${report.driftFields.join(', ')}`);
        for (const [field, diff] of Object.entries(report.differences)) {
          console.log(`      • ${field}: entity="${JSON.stringify(diff.entityVal)}" vs ws="${JSON.stringify(diff.workspaceVal)}"`);
        }
      }
    }

    if (result.errors.length > 0) {
      console.error(`Errors on page ${pageNumber}:`, result.errors);
    }

    cursor = result.nextCursor;
    pageNumber++;
  } while (cursor);

  console.log(`\n=======================================================`);
  console.log(`RECONCILIATION SUMMARY:`);
  console.log(`  Total Entities Scanned: ${totalProcessed}`);
  console.log(`  Entities with Drift:    ${totalDrifted}`);
  if (!isDryRun) {
    console.log(`  Entities Healed:        ${totalHealed}`);
    console.log(`  Workspaces Healed:      ${totalWorkspacesHealed}`);
  }
  console.log(`=======================================================`);
}

main().catch((err) => {
  console.error('[ENTITY SYNC RECONCILIATION] Fatal error:', err);
  process.exit(1);
});
