'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { SystemMigrationLog } from '@/lib/types';

const BATCH_SIZE = 400;

export async function executeStripLifecycleStatusFerAction(userId: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  const migrationId = 'fer_strip_lifecycle_status';
  const now = new Date().toISOString();

  // 1. Mark as In Progress
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({
    id: migrationId,
    status: 'in_progress',
    lastRunAt: now,
    executedBy: userId,
    summary: 'Strip lifecycleStatus execution started...',
  } as SystemMigrationLog, { merge: true });

  const stats = {
    entitiesScanned: 0,
    entitiesStripped: 0,
    workspaceEntitiesScanned: 0,
    workspaceEntitiesStripped: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // 2. Scan Entities
    const entitiesSnapshot = await adminDb.collection('entities').get();
    stats.entitiesScanned = entitiesSnapshot.size;

    const entitiesToUpdate: FirebaseFirestore.DocumentReference[] = [];
    for (const doc of entitiesSnapshot.docs) {
      const data = doc.data();
      if ('lifecycleStatus' in data) {
        entitiesToUpdate.push(doc.ref);
      }
    }

    // Process entities updates in chunks of BATCH_SIZE
    for (let i = 0; i < entitiesToUpdate.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = entitiesToUpdate.slice(i, i + BATCH_SIZE);

      for (const ref of chunk) {
        batch.update(ref, {
          lifecycleStatus: FieldValue.delete(),
          updatedAt: now,
        });
        stats.entitiesStripped++;
      }

      await batch.commit();
    }

    // 3. Scan Workspace Entities
    const workspaceEntitiesSnapshot = await adminDb.collection('workspace_entities').get();
    stats.workspaceEntitiesScanned = workspaceEntitiesSnapshot.size;

    const workspaceEntitiesToUpdate: FirebaseFirestore.DocumentReference[] = [];
    for (const doc of workspaceEntitiesSnapshot.docs) {
      const data = doc.data();
      if ('lifecycleStatus' in data) {
        workspaceEntitiesToUpdate.push(doc.ref);
      }
    }

    // Process workspace entities updates in chunks of BATCH_SIZE
    for (let i = 0; i < workspaceEntitiesToUpdate.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = workspaceEntitiesToUpdate.slice(i, i + BATCH_SIZE);

      for (const ref of chunk) {
        batch.update(ref, {
          lifecycleStatus: FieldValue.delete(),
          updatedAt: now,
        });
        stats.workspaceEntitiesStripped++;
      }

      await batch.commit();
    }

    // 4. Mark as Completed
    const summaryMsg = `Successfully stripped lifecycleStatus from ${stats.entitiesStripped} entities and ${stats.workspaceEntitiesStripped} workspace entities.`;

    await migrationRef.set({
      status: 'completed',
      lastRunAt: now,
      summary: summaryMsg,
      details: stats,
    } as Partial<SystemMigrationLog>, { merge: true });

    return {
      success: true,
      message: summaryMsg,
      details: stats,
    };
  } catch (error: any) {
    console.error(`[FER Strip Lifecycle Status] Fatal error:`, error);
    stats.failed++;
    stats.errors.push(error.message);

    // 5. Mark as Failed
    await migrationRef.set({
      status: 'failed',
      lastRunAt: now,
      summary: `Failed: ${error.message}`,
      details: stats,
    } as Partial<SystemMigrationLog>, { merge: true });

    return {
      success: false,
      message: error.message || 'Fatal error during migration',
      details: stats,
    };
  }
}
