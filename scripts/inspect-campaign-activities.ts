import { adminDb } from '../src/lib/firebase-admin';

async function inspectCampaignActivities() {
  console.log('>>> [INSPECT] Querying activities for tag "rnvuZGtjuO70YGlUqEup"...');
  const snap = await adminDb.collection('activities')
    .where('metadata.tagId', '==', 'rnvuZGtjuO70YGlUqEup')
    .limit(100)
    .get();

  const activities: any[] = [];
  snap.forEach((doc) => {
    activities.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  // Sort in memory
  activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  console.log('Recent 10 activities with tag "rnvuZGtjuO70YGlUqEup":', JSON.stringify(activities.slice(0, 10), null, 2));
}

inspectCampaignActivities().catch(console.error);
