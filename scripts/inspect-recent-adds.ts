import { adminDb } from '../src/lib/firebase-admin';

async function inspectRecentAdds() {
  console.log('>>> [INSPECT] Querying tag_added activities since 15:00:00...');
  const snap = await adminDb.collection('activities')
    .where('type', '==', 'tag_added')
    .get();

  const matching: any[] = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (data.timestamp && data.timestamp >= '2026-07-15T15:00:00.000Z') {
      matching.push({
        id: doc.id,
        entityId: data.entityId,
        tagName: data.metadata?.tagName,
        timestamp: data.timestamp,
        metadata: data.metadata,
      });
    }
  });

  matching.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  console.log(`Found ${matching.length} tag_added activities since 15:00:00.`);
  console.log('Matching activities:', JSON.stringify(matching, null, 2));
}

inspectRecentAdds().catch(console.error);
