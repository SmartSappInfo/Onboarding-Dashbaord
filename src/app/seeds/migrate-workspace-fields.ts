import * as dotenv from 'dotenv';
// Load environment variables before importing any firebase admin packages
dotenv.config({ path: '.env.local' });

async function run() {
  console.log('Starting workspace fields restructuring seeding migration...');
  // Import the migration core, not the Server Action: the action now authenticates its
  // caller from the session cookie (audit F2), and there is no session on the CLI.
  const { seedAllWorkspacesFields } = await import('../../lib/migrations/seed-all-workspaces-fields');
  const result = await seedAllWorkspacesFields('system_cli_migration');
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

run().catch((err) => {
  console.error('Critical migration error:', err);
  process.exit(1);
});
