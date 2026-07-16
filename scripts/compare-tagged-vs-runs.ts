import { adminDb } from '../src/lib/firebase-admin';

async function compare() {
  const campaignTagId = 'rnvuZGtjuO70YGlUqEup';
  const automationId = 'MCs1nHdHK7AgcffzX6w0';

  console.log('>>> [INSPECT] Querying workspace_entities for campaign tag...');
  const contactsSnap = await adminDb.collection('workspace_entities')
    .where('workspaceTags', 'array-contains', campaignTagId)
    .get();
  
  const taggedEntityIds = new Set<string>();
  contactsSnap.forEach((doc) => {
    const data = doc.data();
    // Use entityId if present, else fallback to doc ID
    const entId = data.entityId || doc.id;
    taggedEntityIds.add(entId);
  });
  console.log(`>>> Total tagged contact entityIds: ${taggedEntityIds.size}`);

  console.log('>>> [INSPECT] Querying automation_runs for campaign automation...');
  const runsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .get();

  const runEntityIds = new Set<string>();
  runsSnap.forEach((doc) => {
    runEntityIds.add(doc.data().entityId);
  });
  console.log(`>>> Total run entityIds: ${runEntityIds.size}`);

  // Find tagged contacts without automation runs
  const missingFromAutomation: string[] = [];
  taggedEntityIds.forEach((entId) => {
    if (!runEntityIds.has(entId)) {
      missingFromAutomation.push(entId);
    }
  });

  console.log(`>>> Contacts tagged but NOT in automation: ${missingFromAutomation.length}`);
  if (missingFromAutomation.length > 0) {
    console.log('Sample missing entityIds:', JSON.stringify(missingFromAutomation.slice(0, 10), null, 2));
  }
}

compare().catch(console.error);
