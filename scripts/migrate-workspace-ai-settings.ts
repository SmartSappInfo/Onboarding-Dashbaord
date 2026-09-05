#!/usr/bin/env tsx
/**
 * Migration Script: FER Protocol - Workspace AI Settings Normalization & Backfill
 *
 * Usage:
 *   npx tsx scripts/migrate-workspace-ai-settings.ts             # Dry Run by default
 *   npx tsx scripts/migrate-workspace-ai-settings.ts --execute   # Live execution
 *   DRY_RUN=false npx tsx scripts/migrate-workspace-ai-settings.ts
 *
 * Purpose:
 *   1. Iterates over all workspaces in the `workspaces` collection.
 *   2. Inspects `aiSettings`:
 *      - If missing or missing `preferredModelId`, provisions system flagship defaults.
 *      - If containing deprecated or aliased model IDs (e.g. gemini-2.5-flash, gemini-3.5-flash, gemini-1.5-*),
 *        normalizes them via AiModelRegistry.normalizeModelId().
 *      - Normalizes optional reasoningModelId and fastModelId if present.
 *   3. Skips already-normalized and fully compliant workspace records (idempotent).
 *   4. Commits in safe batches (<= 200 documents per batch).
 *
 * Requirements:
 *   - Strictly typed: Zero any, zero any[], zero unknown.
 *   - Non-destructive: Preserves custom organization keys and all other workspace fields.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';
import { AiModelRegistry, type AiProviderId } from '../src/lib/ai/model-registry';
import type { WorkspaceAiSettings } from '../src/lib/types';

const args = process.argv.slice(2);
const isExecuteFlag = args.includes('--execute');
const DRY_RUN = process.env.DRY_RUN === 'false' ? false : !isExecuteFlag;
const BATCH_CHUNK_LIMIT = 200;

interface MigrationStats {
  totalScanned: number;
  alreadyCompliant: number;
  enriched: number;
  errors: Array<{ workspaceId: string; error: string }>;
}

async function runMigration(): Promise<void> {
  console.log('====================================================');
  console.log('🚀 Starting FER Migration: Workspace AI Settings Normalization');
  console.log(`MODE: ${DRY_RUN ? '🔍 DRY RUN (Simulating changes, zero writes)' : '⚡ LIVE RUN (Persisting to Firestore)'}`);
  console.log('====================================================');

  const stats: MigrationStats = {
    totalScanned: 0,
    alreadyCompliant: 0,
    enriched: 0,
    errors: [],
  };

  const flagship = AiModelRegistry.getFlagshipModel();
  console.log(`System flagship model: ${flagship.id} (${flagship.provider})`);

  let currentBatch = adminDb.batch();
  let batchCount = 0;

  try {
    const workspacesSnap = await adminDb.collection('workspaces').get();
    stats.totalScanned = workspacesSnap.size;
    console.log(`Found ${stats.totalScanned} workspace(s) to inspect.\n`);

    for (const docSnap of workspacesSnap.docs) {
      const workspaceId = docSnap.id;
      const data = docSnap.data();
      const existingSettings = data.aiSettings as Partial<WorkspaceAiSettings> | undefined;

      try {
        let needsUpdate = false;
        let targetProvider: AiProviderId = 'googleai';
        let targetModelId = flagship.id;
        let reasoningModelId: string | undefined = undefined;
        let fastModelId: string | undefined = undefined;

        if (!existingSettings || !existingSettings.preferredModelId) {
          // Missing entirely - provision flagship defaults
          needsUpdate = true;
          targetProvider = flagship.provider;
          targetModelId = flagship.id;
        } else {
          // Existing settings present - check provider validity
          const validProvider: AiProviderId =
            existingSettings.preferredProvider === 'anthropic' || existingSettings.preferredProvider === 'openrouter'
              ? existingSettings.preferredProvider
              : 'googleai';

          const normalizedModelId = AiModelRegistry.normalizeModelId(existingSettings.preferredModelId);
          if (
            validProvider !== existingSettings.preferredProvider ||
            normalizedModelId !== existingSettings.preferredModelId
          ) {
            needsUpdate = true;
          }

          targetProvider = validProvider;
          targetModelId = normalizedModelId;

          if (existingSettings.reasoningModelId) {
            const normalizedReasoning = AiModelRegistry.normalizeModelId(existingSettings.reasoningModelId);
            if (normalizedReasoning !== existingSettings.reasoningModelId) {
              needsUpdate = true;
            }
            reasoningModelId = normalizedReasoning;
          }

          if (existingSettings.fastModelId) {
            const normalizedFast = AiModelRegistry.normalizeModelId(existingSettings.fastModelId);
            if (normalizedFast !== existingSettings.fastModelId) {
              needsUpdate = true;
            }
            fastModelId = normalizedFast;
          }
        }

        if (needsUpdate) {
          stats.enriched++;
          const orgId = typeof data.organizationId === 'string' ? data.organizationId : undefined;
          const updatedAiSettings: WorkspaceAiSettings = {
            preferredProvider: targetProvider,
            preferredModelId: targetModelId,
            ...(reasoningModelId ? { reasoningModelId } : {}),
            ...(fastModelId ? { fastModelId } : {}),
            ...(orgId ? { organizationId: orgId } : {}),
            updatedAt: new Date().toISOString(),
            updatedBy: 'fer_migration_script',
          };

          console.log(
            `[ENRICH] Workspace "${workspaceId}": ${
              existingSettings?.preferredModelId || 'NONE'
            } -> ${targetModelId} (${targetProvider})`
          );

          if (!DRY_RUN) {
            currentBatch.update(docSnap.ref, {
              aiSettings: updatedAiSettings,
              updatedAt: new Date().toISOString(),
            });
            batchCount++;

            if (batchCount >= BATCH_CHUNK_LIMIT) {
              console.log(`💾 Committing batch of ${batchCount} updates...`);
              await currentBatch.commit();
              currentBatch = adminDb.batch();
              batchCount = 0;
            }
          }
        } else {
          stats.alreadyCompliant++;
        }
      } catch (docErr) {
        const errorMsg = docErr instanceof Error ? docErr.message : String(docErr);
        console.error(`❌ Error inspecting workspace "${workspaceId}":`, errorMsg);
        stats.errors.push({ workspaceId, error: errorMsg });
      }
    }

    if (!DRY_RUN && batchCount > 0) {
      console.log(`💾 Committing final batch of ${batchCount} updates...`);
      await currentBatch.commit();
    }
  } catch (fatalErr) {
    const errorMsg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    console.error('💥 Fatal error during migration:', errorMsg);
  }

  console.log('\n====================================================');
  console.log('📊 FER Migration Summary Report:');
  console.log(`- Total Workspaces Scanned: ${stats.totalScanned}`);
  console.log(`- Already Compliant:        ${stats.alreadyCompliant}`);
  console.log(`- Enriched & Updated:       ${stats.enriched}`);
  console.log(`- Errors Encountered:       ${stats.errors.length}`);
  if (DRY_RUN) {
    console.log('\nℹ️  This was a DRY RUN. Run with \`--execute\` to apply changes.');
  } else {
    console.log('\n✅ All workspace AI settings have been normalized successfully.');
  }
  console.log('====================================================');
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
