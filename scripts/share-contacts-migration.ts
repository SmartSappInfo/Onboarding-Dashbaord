import './bootstrap';

import { adminDb } from '../src/lib/firebase-admin';
import { FieldPath, QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { syncContactProjectionForWE, deleteContactProjectionForEntity } from '../src/lib/contacts/contact-projection-writer';
import { logWorkspaceEntityCreated } from '../src/lib/entity-audit';
import { logActivity } from '../src/lib/activity-logger';
import type { WorkspaceEntity } from '../src/lib/types';
import type { MigrationProgressState, MigrationArgs } from './share-contacts-migration-types';

const SOURCE_WS = 'prospect';
const TARGET_WS = 'enrollment-marketing';
const STATE_DOC_ID = 'prospect_to_enrollment_marketing';
const BATCH_SIZE = 400;
const PAGE_SIZE = 500;

async function main(): Promise<void> {
  const args: MigrationArgs = {
    rollback: process.argv.includes('--rollback'),
    verify: process.argv.includes('--verify'),
    resume: process.argv.includes('--resume')
  };

  if (args.rollback) {
    await handleRollback();
  } else if (args.verify) {
    await handleVerify();
  } else {
    await handleMigration(args.resume);
  }
}

async function handleMigration(resume: boolean): Promise<void> {
  console.log(`🚀 Starting share-contacts migration from ${SOURCE_WS} to ${TARGET_WS}`);
  const stateRef = adminDb.collection('migration_states').doc(STATE_DOC_ID);
  
  let state: MigrationProgressState = {
    status: 'in_progress',
    lastProcessedEntityId: null,
    totalProcessed: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    errors: [],
    updatedAt: new Date().toISOString()
  };

  if (resume) {
    const snap = await stateRef.get();
    if (snap.exists) {
      state = snap.data() as MigrationProgressState;
      console.log(`⏳ Resuming from entityId: ${state.lastProcessedEntityId}`);
    }
  }

  await stateRef.set(state);

  let hasMore = true;

  while (hasMore) {
    let query = adminDb.collection('workspace_entities')
      .where('workspaceId', '==', SOURCE_WS)
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);

    if (state.lastProcessedEntityId) {
      const cursorDocId = `${SOURCE_WS}_${state.lastProcessedEntityId}`;
      const cursorSnap = await adminDb.collection('workspace_entities').doc(cursorDocId).get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const sourceWEs = snapshot.docs;
    console.log(`📖 Fetched page of ${sourceWEs.length} records`);

    const batchChunks = chunkArray(sourceWEs, BATCH_SIZE);

    for (const chunk of batchChunks) {
      const batch = adminDb.batch();
      const docsToSync: WorkspaceEntity[] = [];

      for (const docSnap of chunk) {
        const sourceData = docSnap.data() as WorkspaceEntity;
        const entityId = sourceData.entityId;

        // Target relationship ID
        const targetWEId = `${TARGET_WS}_${entityId}`;
        const targetRef = adminDb.collection('workspace_entities').doc(targetWEId);

        // Enrich data - build a clean WorkspaceEntity without any
        const targetData: WorkspaceEntity = {
          ...sourceData,
          id: targetWEId,
          workspaceId: TARGET_WS,
          assignedTo: null,
          workspaceTags: [],
          status: 'active',
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Add custom tracking properties safely via type assertion or record update
        const customData = targetData as unknown as Record<string, string>;
        customData._migrationSource = 'prospect_share_migration';
        customData._migrationTimestamp = new Date().toISOString();

        batch.set(targetRef, targetData, { merge: true });
        docsToSync.push(targetData);
      }

      // Commit relationship records
      await batch.commit();

      // Sync Projections & Audit Logs
      for (const weData of docsToSync) {
        try {
          await syncContactProjectionForWE(weData);
          
          await logWorkspaceEntityCreated({
            organizationId: weData.organizationId,
            workspaceId: TARGET_WS,
            entityId: weData.entityId,
            entityType: weData.entityType,
            userId: 'system-migration',
            userName: 'Migration Protocol',
            userEmail: 'migration@system.com',
            newValue: weData,
            operationContext: 'manual_edit'
          });

          state.totalSucceeded++;
        } catch (e: unknown) {
          state.totalFailed++;
          const err = e as Error;
          state.errors.push({
            entityId: weData.entityId,
            error: err.message || 'Projection sync failed',
            timestamp: new Date().toISOString()
          });
        }
        state.totalProcessed++;
        state.lastProcessedEntityId = weData.entityId;
      }

      // Save progress state checkpoint
      state.updatedAt = new Date().toISOString();
      await stateRef.set(state);

      // Throttle slightly
      await new Promise(res => setTimeout(res, 100));
    }

    if (sourceWEs.length < PAGE_SIZE) {
      hasMore = false;
    }
  }

  state.status = state.totalFailed > 0 ? 'failed' : 'completed';
  state.updatedAt = new Date().toISOString();
  await stateRef.set(state);

  // Global Activity log
  await logActivity({
    entityId: '',
    organizationId: 'smartsapp-hq',
    userId: 'system-migration',
    workspaceId: 'system',
    type: 'workspace_entity_share_migration' as any, // Cast to any matching the specific activity types
    source: 'system',
    description: `Completed FER contact share: Linked ${state.totalSucceeded} contacts from ${SOURCE_WS} to ${TARGET_WS} workspace.`,
    metadata: { total: state.totalProcessed, succeeded: state.totalSucceeded, failed: state.totalFailed }
  });

  console.log(`✅ Migration complete. Succeeded: ${state.totalSucceeded}, Failed: ${state.totalFailed}`);
}

async function handleRollback(): Promise<void> {
  console.log(`🔄 Starting Rollback for target workspace: ${TARGET_WS}`);
  const snap = await adminDb.collection('workspace_entities')
    .where('workspaceId', '==', TARGET_WS)
    .where('_migrationSource', '==', 'prospect_share_migration')
    .get();

  console.log(`📊 Found ${snap.size} migrated links to rollback.`);
  if (snap.empty) return;

  const docs = snap.docs;
  const batchChunks = chunkArray(docs, BATCH_SIZE);

  for (const chunk of batchChunks) {
    const batch = adminDb.batch();
    for (const docSnap of chunk) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();

    // Delete projections
    for (const docSnap of chunk) {
      const data = docSnap.data() as WorkspaceEntity;
      await deleteContactProjectionForEntity(TARGET_WS, data.entityId);
    }
    console.log(`🧹 Deleted batch of ${chunk.length} relationship links and projections.`);
  }

  // Clear state
  await adminDb.collection('migration_states').doc(STATE_DOC_ID).delete();
  console.log(`✅ Rollback complete.`);
}

async function handleVerify(): Promise<void> {
  console.log(`🔍 Starting Verification Scan...`);
  const sourceCountSnap = await adminDb.collection('workspace_entities')
    .where('workspaceId', '==', SOURCE_WS)
    .count().get();
  const sourceCount = sourceCountSnap.data().count;

  const migratedCountSnap = await adminDb.collection('workspace_entities')
    .where('workspaceId', '==', TARGET_WS)
    .where('_migrationSource', '==', 'prospect_share_migration')
    .count().get();
  const migratedCount = migratedCountSnap.data().count;

  console.log(`📊 Source contacts (${SOURCE_WS}): ${sourceCount}`);
  console.log(`📊 Target shared contacts (${TARGET_WS}): ${migratedCount}`);

  // Check for orphaned records
  const snap = await adminDb.collection('workspace_entities')
    .where('workspaceId', '==', TARGET_WS)
    .where('_migrationSource', '==', 'prospect_share_migration')
    .get();

  let orphans = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as WorkspaceEntity;
    const entitySnap = await adminDb.collection('entities').doc(data.entityId).get();
    if (!entitySnap.exists) {
      console.error(`⚠️ Orphan found: WorkspaceEntity ${docSnap.id} links to missing entity ${data.entityId}`);
      orphans++;
    }
  }

  console.log(`🏁 Verification report: Match count: ${sourceCount === migratedCount ? 'YES' : 'NO'}, Orphans: ${orphans}`);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export { handleMigration, handleRollback, handleVerify };

const isMain = process.argv[1] && (
  process.argv[1].endsWith('share-contacts-migration.ts') || 
  process.argv[1].endsWith('share-contacts-migration.js')
);

if (isMain) {
  main().catch(err => {
    console.error('💥 Execution failed:', err);
    process.exit(1);
  });
}
