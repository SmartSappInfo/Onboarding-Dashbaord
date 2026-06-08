'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { SystemMigrationLog } from '@/lib/types';

const BATCH_SIZE = 400;

export async function executeStripAccountStatusFerAction(userId: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  const migrationId = 'fer_strip_account_status';
  const now = new Date().toISOString();

  // 1. Mark as In Progress
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({
    id: migrationId,
    status: 'in_progress',
    lastRunAt: now,
    executedBy: userId,
    summary: 'Strip accountStatus execution started...',
  } as SystemMigrationLog, { merge: true });

  const stats = {
    entitiesScanned: 0,
    entitiesStripped: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // We only need to check SaaS entities
    const entitiesSnapshot = await adminDb
      .collection('entities')
      .where('industry', '==', 'SaaS')
      .get();

    stats.entitiesScanned = entitiesSnapshot.size;

    const toUpdate: { ref: FirebaseFirestore.DocumentReference; data: any }[] = [];

    for (const doc of entitiesSnapshot.docs) {
      const data = doc.data();
      if (data.industryData && 'accountStatus' in data.industryData) {
        toUpdate.push({ ref: doc.ref, data: data.industryData });
      }
    }

    // Process updates in chunks of BATCH_SIZE
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = toUpdate.slice(i, i + BATCH_SIZE);

      for (const item of chunk) {
        batch.update(item.ref, {
          'industryData.accountStatus': FieldValue.delete(),
          updatedAt: now,
        });
        stats.entitiesStripped++;
      }

      await batch.commit();
    }

    // 2. Mark as Completed
    const summaryMsg = `Successfully stripped accountStatus from ${stats.entitiesStripped} of ${stats.entitiesScanned} SaaS entities.`;

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
    console.error(`[FER Strip Account Status] Fatal error:`, error);
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
