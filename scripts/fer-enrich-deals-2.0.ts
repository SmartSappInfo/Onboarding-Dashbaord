/**
 * @fileoverview FER (Fetch, Enrich, Restore) Migration Protocol for Deals 2.0
 *
 * ARCHITECTURAL PURPOSE:
 * Backfills legacy deal records in Firestore with Deals 2.0 attributes:
 * - `stageEnteredAt` (defaults to createdAt if missing)
 * - `stageHistory` (initializes empty array or synthesizes first entry)
 * - `healthStatus` ('healthy' for open, 'closed' for won/lost)
 * - `forecastCategory` ('pipeline' for open, 'closed' for won)
 * - `probability` (50% default for open, 100% for won, 0% for lost)
 *
 * SAFETY & PERFORMANCE PROTOCOLS:
 * - Supports `--dry-run` flag for safe simulation without writes.
 * - Chunks Firestore operations into batches of <= 250 writes.
 * - Includes 50ms pacing between batches to prevent database rate limits.
 *
 * USAGE:
 *   npx ts-node scripts/fer-enrich-deals-2.0.ts --dry-run
 *   npx ts-node scripts/fer-enrich-deals-2.0.ts --apply
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

interface LegacyDealDoc {
  id: string;
  name?: string;
  status?: string;
  createdAt?: string;
  stageId?: string;
  stageName?: string;
  stageEnteredAt?: string;
  stageHistory?: unknown[];
  healthStatus?: string;
  forecastCategory?: string;
  probability?: number;
}

async function runFerMigration() {
  const isDryRun = !process.argv.includes('--apply');
  console.log(`\n======================================================`);
  console.log(`[FER MIGRATION] Deals Platform 2.0 Schema Enrichment`);
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (Simulation - No writes)' : '🚀 LIVE EXECUTION (Writing to Firestore)'}`);
  console.log(`======================================================\n`);

  const dealsSnap = await db.collection('deals').get();
  console.log(`Fetched ${dealsSnap.size} deals from Firestore.`);

  let totalScanned = 0;
  let totalNeedsEnrichment = 0;
  let totalEnriched = 0;

  const now = new Date().toISOString();
  const BATCH_SIZE = 250;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const docSnap of dealsSnap.docs) {
    totalScanned++;
    const deal = { id: docSnap.id, ...docSnap.data() } as LegacyDealDoc;

    const needsStageEnteredAt = !deal.stageEnteredAt;
    const needsStageHistory = !Array.isArray(deal.stageHistory);
    const needsHealthStatus = !deal.healthStatus;
    const needsForecastCategory = !deal.forecastCategory;
    const needsProbability = typeof deal.probability !== 'number';

    if (needsStageEnteredAt || needsStageHistory || needsHealthStatus || needsForecastCategory || needsProbability) {
      totalNeedsEnrichment++;

      const isWon = deal.status === 'won';
      const isLost = deal.status === 'lost';
      const stageEnteredAt = deal.stageEnteredAt || deal.createdAt || now;

      const patch: Record<string, unknown> = {
        updatedAt: now,
      };

      if (needsStageEnteredAt) {
        patch.stageEnteredAt = stageEnteredAt;
      }

      if (needsStageHistory) {
        patch.stageHistory = [
          {
            stageId: deal.stageId || 'default',
            stageName: deal.stageName || 'Initial Stage',
            enteredAt: stageEnteredAt,
            exitedAt: null,
            durationSeconds: 0,
            changedByUserId: 'system_fer_migration',
          }
        ];
      }

      if (needsHealthStatus) {
        patch.healthStatus = (isWon || isLost) ? 'closed' : 'healthy';
      }

      if (needsForecastCategory) {
        patch.forecastCategory = isWon ? 'closed' : 'pipeline';
      }

      if (needsProbability) {
        patch.probability = isWon ? 100 : isLost ? 0 : 50;
      }

      if (isDryRun) {
        if (totalNeedsEnrichment <= 5) {
          console.log(`[DRY RUN] Would enrich deal "${deal.name || deal.id}":`, patch);
        }
      } else {
        batch.update(docSnap.ref, patch);
        opsInBatch++;
        totalEnriched++;

        if (opsInBatch >= BATCH_SIZE) {
          await batch.commit();
          console.log(`Committed batch of ${opsInBatch} deal enrichments.`);
          batch = db.batch();
          opsInBatch = 0;
          await new Promise(r => setTimeout(r, 50));
        }
      }
    }
  }

  if (!isDryRun && opsInBatch > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${opsInBatch} deal enrichments.`);
  }

  console.log(`\n======================================================`);
  console.log(`[FER MIGRATION COMPLETE]`);
  console.log(`Total Deals Scanned: ${totalScanned}`);
  console.log(`Total Requiring Enrichment: ${totalNeedsEnrichment}`);
  console.log(`Total Enriched: ${isDryRun ? 0 : totalEnriched}`);
  console.log(`======================================================\n`);
}

runFerMigration().catch(err => {
  console.error('[FER Migration Failed]:', err);
  process.exit(1);
});
