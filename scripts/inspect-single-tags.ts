import { adminDb } from '../src/lib/firebase-admin';

async function inspectSingleTags() {
  console.log('>>> [INSPECT] Querying tag_added activities where skipAutomationTrigger is not true...');
  const snap = await adminDb.collection('activities')
    .where('type', '==', 'tag_added')
    .limit(100)
    .get();

  const matching: any[] = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (data.metadata?.skipAutomationTrigger !== true) {
      matching.push({
        id: doc.id,
        entityId: data.entityId,
        tagName: data.metadata?.tagName,
        timestamp: data.timestamp,
        metadata: data.metadata,
      });
    }
  });

  // Sort by timestamp
  matching.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  console.log(`Found ${matching.length} matching tag_added activities.`);
  console.log('Recent matching activities:', JSON.stringify(matching.slice(0, 10), null, 2));
}

inspectSingleTags().catch(console.error);
