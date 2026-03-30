/**
 * Cleanup Migration Logs Script
 * 
 * Scheduled script to clean up old migration logs based on retention policy
 * 
 * Requirement 30.5: Retain migration logs for 90 days
 * 
 * Usage:
 *   pnpm tsx scripts/cleanup-migration-logs.ts [--retention-days=90]
 */

import { cleanupOldMigrationLogs } from '../src/lib/migration-monitoring';

async function main() {
  console.log('Starting migration log cleanup...');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const retentionDaysArg = args.find(arg => arg.startsWith('--retention-days='));
  const retentionDays = retentionDaysArg
    ? parseInt(retentionDaysArg.split('=')[1])
    : 90;

  if (isNaN(retentionDays) || retentionDays < 1) {
    console.error('Invalid retention days. Must be a positive number.');
    process.exit(1);
  }

  console.log(`Retention period: ${retentionDays} days`);
  
  try {
    const result = await cleanupOldMigrationLogs(retentionDays);
    
    if (!result.success) {
      console.error('Cleanup failed:', result.error);
      process.exit(1);
    }
    
    console.log(`✓ Cleanup completed successfully`);
    console.log(`  Deleted ${result.deletedCount} old log entries`);
    console.log(`  Retention period: ${retentionDays} days`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('Cleanup error:', error.message);
    process.exit(1);
  }
}

main();
