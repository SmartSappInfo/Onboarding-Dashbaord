'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { SystemMigrationLog, EntityContact, WorkspaceEntity } from '@/lib/types';

const BATCH_SIZE = 400;

interface EnrichStats {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function enrichWorkspaceEntitiesContactsAction(userId: string): Promise<{
  success: boolean;
  message: string;
  details: EnrichStats;
}> {
  const migrationId = 'fer_enrich_workspace_entities_contacts';
  const now = new Date().toISOString();

  // 1. Mark as In Progress
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({
    id: migrationId,
    status: 'in_progress',
    lastRunAt: now,
    executedBy: userId,
    summary: 'Enrichment started...',
  } as SystemMigrationLog, { merge: true });

  const stats: EnrichStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let hasMore = true;

    while (hasMore) {
      let q = adminDb
        .collection('workspace_entities')
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
        const data = doc.data() as WorkspaceEntity;
        
        const contacts = (data.entityContacts || []) as EntityContact[];
        if (contacts.length === 0) {
          stats.skipped++;
          continue;
        }

        const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];
        const computedEmail = primaryContact?.email || '';
        const computedPhone = primaryContact?.phone || '';
        const computedName = primaryContact?.name || '';

        const needsEmailSync = !data.primaryEmail && computedEmail;
        const needsPhoneSync = !data.primaryPhone && computedPhone;
        const needsNameSync = !data.primaryContactName && computedName;

        if (needsEmailSync || needsPhoneSync || needsNameSync) {
          const payload: Record<string, unknown> = {
            updatedAt: now,
          };
          if (needsEmailSync) payload.primaryEmail = computedEmail;
          if (needsPhoneSync) payload.primaryPhone = computedPhone;
          if (needsNameSync) payload.primaryContactName = computedName;

          toUpdate.push({
            ref: doc.ref,
            payload,
          });
        } else {
          stats.skipped++;
        }
      }

      if (toUpdate.length > 0) {
        const batch = adminDb.batch();
        for (const updateItem of toUpdate) {
          batch.update(updateItem.ref, updateItem.payload);
          stats.updated++;
        }
        await batch.commit();
      }
    }

    // 2. Mark as Completed
    const finalLog: SystemMigrationLog = {
      id: migrationId,
      status: 'completed',
      lastRunAt: now,
      executedBy: userId,
      summary: `Successfully processed ${stats.total} workspace entities. Updated: ${stats.updated}, Skipped: ${stats.skipped}`,
    };
    await migrationRef.set(finalLog, { merge: true });

    return {
      success: true,
      message: `Enrichment completed. Processed: ${stats.total}, Updated: ${stats.updated}`,
      details: stats,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    stats.failed++;
    stats.errors.push(errorMsg);

    // Mark as Failed
    await migrationRef.set({
      id: migrationId,
      status: 'failed',
      lastRunAt: now,
      executedBy: userId,
      summary: `Failed: ${errorMsg}`,
    } as SystemMigrationLog, { merge: true });

    return {
      success: false,
      message: `Enrichment failed: ${errorMsg}`,
      details: stats,
    };
  }
}
