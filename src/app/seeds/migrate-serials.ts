import * as dotenv from 'dotenv';
// Load environment variables before importing any firebase admin packages
dotenv.config({ path: '.env.local' });

async function runMigration() {
  console.log('--- Starting Contact and Page Serial Seeding Migration ---');

  // Dynamically import dependencies after environment configuration is loaded
  const { adminDb } = await import('../../lib/firebase-admin');
  const { getNextSerial } = await import('../../lib/services/serial-allocator');

  let operationCount = 0;
  let batch = adminDb.batch();

  // Helper to commit batches safely
  const commitBatchIfNeeded = async (force = false) => {
    if (operationCount > 0 && (operationCount % 500 === 0 || force)) {
      console.log(`Committing batch of ${operationCount} modifications...`);
      await batch.commit();
      batch = adminDb.batch();
      if (force) {
        console.log('Final batch committed.');
      }
    }
  };

  // 1. Migrate Contacts
  console.log('Fetching contacts requiring serial numbers...');
  // Query all contacts in the database
  const contactsSnap = await adminDb.collection('contacts').get();

  console.log(`Found ${contactsSnap.size} total contacts to check.`);

  for (const doc of contactsSnap.docs) {
    const data = doc.data();
    if (data.contact_serial === undefined || data.contact_serial === null) {
      const serial = await getNextSerial('contacts');
      batch.update(doc.ref, { contact_serial: serial });
      operationCount++;
      await commitBatchIfNeeded();
    }
  }

  // 2. Migrate Pages (Surveys, Forms, Booking Pages, Media Shares)
  const collectionsToMigrate = ['surveys', 'forms', 'booking_pages', 'media_shares'];

  for (const colName of collectionsToMigrate) {
    console.log(`Checking collection "${colName}" for page serials...`);
    const pageSnap = await adminDb.collection(colName).get();
    console.log(`Found ${pageSnap.size} documents in "${colName}".`);

    for (const doc of pageSnap.docs) {
      const data = doc.data();
      if (data.page_serial === undefined || data.page_serial === null) {
        const serial = await getNextSerial('pages');
        batch.update(doc.ref, { page_serial: serial });
        operationCount++;
        await commitBatchIfNeeded();
      }
    }
  }

  // Commit any remaining updates
  await commitBatchIfNeeded(true);
  console.log('--- Migration Seeding Complete ---');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed with critical error:', err);
  process.exit(1);
});
