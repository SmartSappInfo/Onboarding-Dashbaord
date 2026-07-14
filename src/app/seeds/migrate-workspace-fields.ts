import * as dotenv from 'dotenv';
// Load environment variables before importing any firebase admin packages
dotenv.config({ path: '.env.local' });

async function run() {
  console.log('Starting workspace fields restructuring seeding migration...');
  const { executeSeedAllWorkspacesFieldsFerAction } = await import('../actions/seed-all-workspaces-fields-fer-action');
  const result = await executeSeedAllWorkspacesFieldsFerAction('system_cli_migration');
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

run().catch((err) => {
  console.error('Critical migration error:', err);
  process.exit(1);
});
