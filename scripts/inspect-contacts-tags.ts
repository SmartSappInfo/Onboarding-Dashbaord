import { adminDb } from '../src/lib/firebase-admin';

async function inspectContactsTags() {
  const targetTagId = 'bJVxfxXRaNbrMBaPRuFS'; // [Automation] Test Contacts
  const campaignTagId = 'rnvuZGtjuO70YGlUqEup'; // [Campaign] Enrollment Masterclass

  console.log(`>>> [INSPECT] Querying workspace_entities for tag: ${targetTagId}...`);
  const snap1 = await adminDb.collection('workspace_entities')
    .where('workspaceTags', 'array-contains', targetTagId)
    .get();
  console.log(`>>> Found ${snap1.size} workspace_entities with tag ${targetTagId}`);

  console.log(`>>> [INSPECT] Querying workspace_entities for tag: ${campaignTagId}...`);
  const snap2 = await adminDb.collection('workspace_entities')
    .where('workspaceTags', 'array-contains', campaignTagId)
    .get();
  console.log(`>>> Found ${snap2.size} workspace_entities with tag ${campaignTagId}`);

  if (snap1.size > 0) {
    const data = snap1.docs[0].data();
    console.log(`>>> Sample contact for ${targetTagId}:`, docToSummary(snap1.docs[0].id, data));
  }
  if (snap2.size > 0) {
    const data = snap2.docs[0].data();
    console.log(`>>> Sample contact for ${campaignTagId}:`, docToSummary(snap2.docs[0].id, data));
  }
}

function docToSummary(id: string, data: any) {
  return {
    id,
    name: data.name,
    workspaceTags: data.workspaceTags,
    taggedAt: data.taggedAt,
  };
}

inspectContactsTags().catch(console.error);
