import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { backfillDealExpectedCloseDatesAction } from '../src/app/actions/backfill-deal-expected-close';

async function main() {
  console.log('🚀 Starting Deal Expected Close Date Backfill...');
  const result = await backfillDealExpectedCloseDatesAction();
  console.log('✅ Result:', result);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error during backfill:', err);
  process.exit(1);
});
