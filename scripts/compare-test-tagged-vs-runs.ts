import { adminDb } from '../src/lib/firebase-admin';

async function compareTest() {
  const targetTagId = 'bJVxfxXRaNbrMBaPRuFS';
  const automationId = 'wLraN52eC3zBaYuGQfKH';

  console.log('>>> [INSPECT] Querying workspace_entities for test tag...');
  const contactsSnap = await adminDb.collection('workspace_entities')
    .where('workspaceTags', 'array-contains', targetTagId)
    .get();

  const taggedEntityIds = new Set<string>();
  contactsSnap.forEach((doc) => {
    const data = doc.data();
    const entId = data.entityId || doc.id;
    taggedEntityIds.add(entId);
  });
  console.log(`>>> Total tagged test contact entityIds: ${taggedEntityIds.size}`);

  console.log('>>> [INSPECT] Querying automation_runs for test automation...');
  const runsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .get();

  const runEntityIds = new Set<string>();
  runsSnap.forEach((doc) => {
    runEntityIds.add(doc.data().entityId);
  });
  console.log(`>>> Total test run entityIds: ${runEntityIds.size}`);

  const missingFromAutomation: string[] = [];
  taggedEntityIds.forEach((entId) => {
    if (!runEntityIds.has(entId)) {
      missingFromAutomation.push(entId);
    }
  });

  console.log(`>>> Test contacts tagged but NOT in automation: ${missingFromAutomation.length}`);
  if (missingFromAutomation.length > 0) {
    console.log('Sample missing test entityIds:', JSON.stringify(missingFromAutomation.slice(0, 10), null, 2));
  }
}

compareTest().catch(console.error);
