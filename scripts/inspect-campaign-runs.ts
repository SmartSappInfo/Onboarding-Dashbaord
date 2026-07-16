import { adminDb } from '../src/lib/firebase-admin';

async function inspectCampaignRuns() {
  const automationId = 'MCs1nHdHK7AgcffzX6w0';
  console.log(`>>> [INSPECT] Querying runs for campaign automation: ${automationId}...`);
  const snap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .get();

  console.log(`>>> Found ${snap.size} runs for campaign automation ${automationId}`);
}

inspectCampaignRuns().catch(console.error);
