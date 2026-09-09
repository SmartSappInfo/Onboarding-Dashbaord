// The Server Action authenticates via session cookie; the CLI has none, so it runs
// the core directly (it already has Admin SDK credentials).
import { runDocumentCtaBackfillCore } from './backfill-document-cta-action';

async function run() {
  console.log('[BACKFILL PROTOCOL] Initializing Document CTA Migration via Admin SDK...');
  
  const result = await runDocumentCtaBackfillCore();

  console.log('================================================--');
  console.log(`STATUS: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`MESSAGE: ${result.message}`);
  console.log(`PROCESSED / INSPECTED DOCUMENT SHARES: ${result.processed}`);
  console.log(`UPDATED DOCUMENT SHARES: ${result.updated}`);
  console.log('================================================--');
}

run().catch((err) => {
  console.error('[BACKFILL PROTOCOL] Fatal error:', err);
  process.exit(1);
});
