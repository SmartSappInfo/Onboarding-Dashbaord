import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables immediately on module load
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { runSenderProfileCleansing } from '../src/lib/migrations/cleanse-foreign-sender-profiles';

async function main() {
  const isApply = process.argv.includes('--apply');
  const mode = isApply ? 'apply' : 'dry-run';
  console.log(`\n==============================================`);
  console.log(`Running Sender Profile Cleansing in [${mode.toUpperCase()}] mode`);
  console.log(`==============================================\n`);

  const summary = await runSenderProfileCleansing(mode);

  console.log(`Total Profiles Scanned:    ${summary.scannedCount}`);
  console.log(`Contaminated Detected:     ${summary.contaminatedCount}`);
  console.log(`Deleted:                   ${summary.deletedCount}`);
  console.log(`Skipped (In Active Use):   ${summary.skippedInUseCount}`);
  console.log(`\nDetailed Items:`);
  console.table(summary.items);

  if (mode === 'dry-run' && summary.contaminatedCount > 0) {
    console.log(`\n💡 To apply changes and delete contaminated profiles, run:`);
    console.log(`   npx tsx scripts/cleanse-foreign-sender-profiles-runner.ts --apply\n`);
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
