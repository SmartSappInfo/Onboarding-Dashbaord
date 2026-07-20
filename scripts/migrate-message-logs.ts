import { adminDb } from '../src/lib/firebase-admin';

/**
 * Executes a zero-downtime migration to backfill `lastStatusCheckAt` and `statusCheckCount`
 * for all existing pending SMS message logs. This is required before the polling
 * cron job can successfully query the compound index.
 */

async function main() {
  const db = adminDb;
  console.log('Starting MessageLog migration for pending SMS...');

  const pendingLogsSnap = await db
    .collection('message_logs')
    .where('channel', '==', 'sms')
    .where('providerStatus', '==', 'pending')
    .get();

  if (pendingLogsSnap.empty) {
    console.log('No pending SMS logs found. Migration complete.');
    process.exit(0);
  }

  console.log(`Found ${pendingLogsSnap.size} pending logs. Backfilling fields...`);

  const bulkWriter = db.bulkWriter();
  let updatedCount = 0;

  for (const doc of pendingLogsSnap.docs) {
    const data = doc.data();
    if (!data.lastStatusCheckAt) {
      // Set to epoch to ensure these are picked up immediately by the cron
      bulkWriter.update(doc.ref, {
        lastStatusCheckAt: '1970-01-01T00:00:00.000Z',
        statusCheckCount: 0,
      });
      updatedCount++;
    }
  }

  await bulkWriter.close();
  console.log(`Successfully migrated ${updatedCount} logs.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
