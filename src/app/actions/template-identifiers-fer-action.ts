'use server';

import { adminDb } from '@/lib/firebase-admin';
import { SystemMigrationLog } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

const BATCH_SIZE = 400;

const slugify = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

function buildUpdatePayload(
  data: FirebaseFirestore.DocumentData,
  docId: string,
  now: string
): Record<string, unknown> | null {
  const updates: Record<string, unknown> = {};

  if (!data.templateType || data.templateType.trim() === '') {
    const rawName = data.name || `untitled_template_${docId}`;
    const generatedSlug = slugify(rawName);
    updates.templateType = generatedSlug || `fallback_key_${docId}`;
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = now;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

export async function executeTemplateIdentifiersFerAction(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints. This one performs an
  // irreversible, cross-tenant field deletion, and previously accepted the executing
  // user's id as an argument — so any caller could run it and attribute it to anyone.
  // Identity and permission are now both resolved server-side from the session.
  const actor = await authorizeBackofficeSession('operations', 'execute');

  const migrationId = 'fer_template_identifiers';
  const now = new Date().toISOString();

  // 1. Mark as In Progress
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({
    id: migrationId,
    status: 'in_progress',
    lastRunAt: now,
    executedBy: actor.userId,
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
        .collection('message_templates')
        .orderBy('__name__')
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
        const payload = buildUpdatePayload(doc.data(), doc.id, now);
        if (payload) {
          toUpdate.push({ ref: doc.ref, payload });
        } else {
          stats.skipped++;
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
    const summaryMsg = `Scanned ${stats.total}. Enriched ${stats.updated}. Skipped ${stats.skipped}.`;
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

  } catch (error: unknown) {
    console.error(`[FER Template Identifiers] Fatal error:`, error);
    stats.failed++;
    stats.errors.push(getErrorMessage(error));

    // 3. Mark as Failed
    await migrationRef.set({
      status: 'failed',
      lastRunAt: now,
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
