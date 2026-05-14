'use server';

import { adminDb } from '@/lib/firebase-admin';
import { SystemMigrationLog } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

const BATCH_SIZE = 400;

export async function executePurgeFocalPersonsFerAction(userId: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  const migrationId = 'fer_purge_focal_persons';
  const now = new Date().toISOString();

  // 1. Mark as In Progress
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({
    id: migrationId,
    status: 'in_progress',
    lastRunAt: now,
    executedBy: userId,
    summary: 'Execution started...',
  } as SystemMigrationLog, { merge: true });

  const stats = {
    total: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let hasMore = true;

    while (hasMore) {
      let q = adminDb
        .collection('entities')
        .limit(BATCH_SIZE);

      if (lastDoc) {
        q = q.startAfter(lastDoc);
      }

      const snapshot = await q.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      hasMore = snapshot.docs.length === BATCH_SIZE;

      const toUpdate: Array<{ ref: FirebaseFirestore.DocumentReference; payload: Record<string, unknown> }> = [];

      for (const doc of snapshot.docs) {
        stats.total++;
        const data = doc.data();
        
        const hasFocalPersonFields = 
          data.focalPerson !== undefined || 
          data.focalPersons !== undefined || 
          data.contactPersons !== undefined;

        if (hasFocalPersonFields) {
          // SAFEGUARD: Ensure entityContacts exists and is populated
          if (Array.isArray(data.entityContacts) && data.entityContacts.length > 0) {
            toUpdate.push({
              ref: doc.ref,
              payload: {
                focalPerson: FieldValue.delete(),
                focalPersons: FieldValue.delete(),
                contactPersons: FieldValue.delete(),
                updatedAt: now
              }
            });
          } else {
            stats.skipped++;
            console.warn(`[FER Purge] Skipped Entity ${doc.id} - Has legacy contact fields but NO entityContacts!`);
          }
        }
      }

      if (toUpdate.length > 0) {
        const batch = adminDb.batch();
        for (const item of toUpdate) {
          batch.update(item.ref, item.payload);
        }
        await batch.commit();
        stats.updated += toUpdate.length;
      }
    }

    // 2. Mark as Completed
    const summaryMsg = `Scanned ${stats.total}. Purged ${stats.updated}. Skipped ${stats.skipped}.`;
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
    console.error(`[FER Purge Focal Persons] Fatal error:`, error);
    stats.failed++;
    stats.errors.push(error.message);

    // 3. Mark as Failed
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
