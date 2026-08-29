/**
 * FER Migration Script: FER-04 Deal Recurring Revenue Metrics Backfill
 *
 * ARCHITECTURAL POINTER (Rule 10 & Rule 8):
 * - Reads all deals with existing line items and computes normalized recurring revenue
 *   metrics (MRR, ARR, ACV, TCV, OneTimeValue, RecurringValue).
 * - Enforces batch chunking strictly <= 400 operations per commit to prevent Firestore batch limit exhaustion.
 * - Supports dry-run execution mode to inspect affected records safely before mutating production state.
 *
 * Usage:
 *   npx tsx scripts/fer-enrich-deal-recurring-metrics.ts [--dry-run]
 */

import { adminDb } from '../src/lib/firebase-admin';
import { calculateLineItemsTotals } from '../src/lib/deals/deal-health-engine';
import type { Deal } from '../src/lib/types';

const BATCH_SIZE = 350; // Strict margin under 500-op limit (Rule 8)

async function runEnrichment() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`🚀 Starting FER-04 Deal Recurring Revenue Enrichment (DryRun: ${isDryRun})...\n`);

  const dealsSnap = await adminDb.collection('deals').get();
  console.log(`📊 Found ${dealsSnap.size} total deal records in database.`);

  let enrichedCount = 0;
  let skippedCount = 0;
  let batch = adminDb.batch();
  let opsInCurrentBatch = 0;

  for (const doc of dealsSnap.docs) {
    const deal = doc.data() as Deal;

    if (!Array.isArray(deal.lineItems) || deal.lineItems.length === 0) {
      skippedCount++;
      continue;
    }

    const termMonths = deal.contractTermMonths || 12;
    const totals = calculateLineItemsTotals(deal.lineItems, termMonths);

    const hasChanged = 
      deal.mrr !== totals.mrr ||
      deal.arr !== totals.arr ||
      deal.acv !== totals.acv ||
      deal.tcv !== totals.tcv ||
      deal.oneTimeValue !== totals.oneTimeValue ||
      deal.recurringValue !== totals.recurringValue;

    if (!hasChanged && deal.mrr !== undefined) {
      skippedCount++;
      continue;
    }

    enrichedCount++;
    console.log(`  [Deal ${doc.id}] "${deal.name}": Value=${totals.grandTotal}, MRR=${totals.mrr}, ARR=${totals.arr}, TCV=${totals.tcv}`);

    if (!isDryRun) {
      batch.update(doc.ref, {
        mrr: totals.mrr,
        arr: totals.arr,
        acv: totals.acv,
        tcv: totals.tcv,
        oneTimeValue: totals.oneTimeValue,
        recurringValue: totals.recurringValue,
        contractTermMonths: totals.contractTermMonths,
        updatedAt: new Date().toISOString(),
      });

      opsInCurrentBatch++;

      if (opsInCurrentBatch >= BATCH_SIZE) {
        await batch.commit();
        console.log(`  💾 Committed batch of ${opsInCurrentBatch} deal updates.`);
        batch = adminDb.batch();
        opsInCurrentBatch = 0;
      }
    }
  }

  if (!isDryRun && opsInCurrentBatch > 0) {
    await batch.commit();
    console.log(`  💾 Committed final batch of ${opsInCurrentBatch} deal updates.`);
  }

  console.log('\n=========================================');
  console.log(`✅ FER-04 Enrichment Complete!`);
  console.log(`   - Enriched Deals: ${enrichedCount}`);
  console.log(`   - Unchanged / Skipped: ${skippedCount}`);
  console.log('=========================================\n');
}

runEnrichment()
  .catch(err => {
    console.error('❌ FER-04 Enrichment Failed:', err);
    process.exit(1);
  });
