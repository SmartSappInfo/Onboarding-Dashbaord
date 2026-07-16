import { adminDb } from '../src/lib/firebase-admin';

async function inspectWindow() {
  console.log('>>> [INSPECT] Querying activities since 15:30:00...');
  const snap = await adminDb.collection('activities')
    .where('timestamp', '>=', '2026-07-15T15:30:00.000Z')
    .get();

  const activities: any[] = [];
  snap.forEach((doc) => {
    const data = doc.data();
    activities.push({
      id: doc.id,
      type: data.type,
      entityId: data.entityId,
      displayName: data.displayName,
      tagName: data.metadata?.tagName,
      skipAutomationTrigger: data.metadata?.skipAutomationTrigger,
      timestamp: data.timestamp,
    });
  });

  activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  console.log(`Found ${activities.length} activities since 15:30:00.`);
  console.log('Recent 20 activities:', JSON.stringify(activities.slice(0, 20), null, 2));
}

inspectWindow().catch(console.error);
