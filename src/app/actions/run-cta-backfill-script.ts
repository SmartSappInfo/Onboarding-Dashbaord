import { firestore } from '../../firebase/config';
import { backfillDocumentCtaTexts } from '../../lib/media/document-cta-backfill-service';

async function run() {
  console.log('[BACKFILL PROTOCOL] Initializing Document CTA Migration via Client SDK...');
  
  const result = await backfillDocumentCtaTexts(firestore, undefined, (report) => {
    console.log(`[PROGRESS] ${report.message} (Processed: ${report.processed}, Updated: ${report.updated}, Errors: ${report.errors})`);
  });

  console.log('--------------------------------------------------');
  console.log(`STATUS: COMPLETE`);
  console.log(`PROCESSED: ${result.processed} document shares inspected`);
  console.log(`UPDATED: ${result.updated} document shares updated`);
  console.log(`ERRORS: ${result.errors}`);
  console.log('--------------------------------------------------');
}

run().catch((err) => {
  console.error('[BACKFILL PROTOCOL] Fatal error:', err);
  process.exit(1);
});
