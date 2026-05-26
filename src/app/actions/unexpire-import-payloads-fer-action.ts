'use server';

import { adminDb } from '@/lib/firebase-admin';
import { SystemMigrationLog } from '@/lib/types';

/**
 * FER Protocol: Un-expires import payloads.
 * Sets rawFieldsCleared to false and resets startedAt to now, extending their TTL.
 */
export async function executeUnexpireImportPayloadsFerAction(userId: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  const migrationId = 'fer_unexpire_import_payloads';
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Mark as In Progress
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({
    id: migrationId,
    status: 'in_progress',
    lastRunAt: nowIso,
    executedBy: userId,
    summary: 'Execution started...',
  } as SystemMigrationLog, { merge: true });

  const stats = {
    totalScanned: 0,
    totalUnexpired: 0,
    errors: [] as string[],
  };

  try {
    // Query import logs that are marked as cleared (expired)
    const logsSnap = await adminDb.collection('import_logs')
      .where('rawFieldsCleared', '==', true)
      .get();

    if (logsSnap.empty) {
      const summaryMsg = 'No expired import payloads found to un-expire.';
      await migrationRef.set({
        status: 'completed',
        lastRunAt: nowIso,
        summary: summaryMsg,
        details: stats,
      } as Partial<SystemMigrationLog>, { merge: true });

      return {
        success: true,
        message: summaryMsg,
        details: stats,
      };
    }

    const batch = adminDb.batch();
    let batchWriteCount = 0;

    for (const doc of logsSnap.docs) {
      stats.totalScanned++;
      
      // Update rawFieldsCleared back to false
      // Also update startedAt to the current timestamp to extend their expiration (prevent immediate re-expiration)
      batch.update(doc.ref, {
        rawFieldsCleared: false,
        startedAt: now, // Extending TTL by resetting startedAt to now
        unexpiredAt: nowIso,
      });

      stats.totalUnexpired++;
      batchWriteCount++;

      if (batchWriteCount >= 450) {
        await batch.commit();
        batchWriteCount = 0;
      }
    }

    if (batchWriteCount > 0) {
      await batch.commit();
    }

    const summaryMsg = `Successfully un-expired ${stats.totalUnexpired} import payloads and extended their TTL.`;
    await migrationRef.set({
      status: 'completed',
      lastRunAt: nowIso,
      summary: summaryMsg,
      details: stats,
    } as Partial<SystemMigrationLog>, { merge: true });

    return {
      success: true,
      message: summaryMsg,
      details: stats,
    };

  } catch (error: any) {
    console.error(`[FER Un-expire Import Payloads] Fatal error:`, error);
    stats.errors.push(error.message);

    await migrationRef.set({
      status: 'failed',
      lastRunAt: nowIso,
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
