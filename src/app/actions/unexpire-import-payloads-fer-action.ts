'use server';

import { adminDb } from '@/lib/firebase-admin';
import { SystemMigrationLog } from '@/lib/types';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

/**
 * FER Protocol: Un-expires import payloads.
 * Sets rawFieldsCleared to false and resets startedAt to now, extending their TTL.
 */
export async function executeUnexpireImportPayloadsFerAction(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints. This one performs an
  // irreversible, cross-tenant field deletion, and previously accepted the executing
  // user's id as an argument — so any caller could run it and attribute it to anyone.
  // Identity and permission are now both resolved server-side from the session.
  const actor = await authorizeBackofficeSession('operations', 'execute');

  const migrationId = 'fer_unexpire_import_payloads';
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Mark as In Progress
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({
    id: migrationId,
    status: 'in_progress',
    lastRunAt: nowIso,
    executedBy: actor.userId,
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

  } catch (error: unknown) {
    console.error(`[FER Un-expire Import Payloads] Fatal error:`, error);
    stats.errors.push(getErrorMessage(error));

    await migrationRef.set({
      status: 'failed',
      lastRunAt: nowIso,
      summary: `Failed: ${getErrorMessage(error)}`,
      details: stats,
    } as Partial<SystemMigrationLog>, { merge: true });

    return {
      success: false,
      message: getErrorMessage(error) || 'Fatal error during migration',
      details: stats,
    };
  }
}
