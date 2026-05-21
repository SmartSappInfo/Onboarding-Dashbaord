import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDuplicateRowsAction } from './src/lib/bulk-upload-actions';

if (getApps().length === 0) {
  initializeApp({
    credential: cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH!))
  });
}

async function test() {
  const db = getFirestore();
  const logsSnap = await db.collection('import_logs').where('status', 'in', ['processing', 'partially_completed', 'completed']).limit(5).get();
  for (const doc of logsSnap.docs) {
    try {
      console.log(`Testing logId: ${doc.id}`);
      const dups = await getDuplicateRowsAction(doc.id);
      console.log(`Success, got ${dups.length} dups.`);
    } catch (e: any) {
      console.error(`Error on ${doc.id}: ${e.message}`);
    }
  }
}

test();
