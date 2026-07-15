import { adminDb } from '../src/lib/firebase-admin';

async function inspectLastActivities() {
  console.log('>>> [INSPECT] Querying last 10 activities...');
  const snap = await adminDb.collection('activities')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();

  const activities: any[] = [];
  snap.forEach((doc) => {
    activities.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  console.log('Last 10 activities in Firestore:', JSON.stringify(activities, null, 2));
}

inspectLastActivities().catch(console.error);
