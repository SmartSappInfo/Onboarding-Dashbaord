import { adminDb } from '../src/lib/firebase-admin';

async function findAutomations() {
  console.log('>>> [INSPECT] Querying all automations in database...');
  const snap = await adminDb.collection('automations').get();

  const automations: any[] = [];
  snap.forEach((doc) => {
    const data = doc.data();
    automations.push({
      id: doc.id,
      name: data.name,
      isActive: data.isActive,
      triggers: data.triggers || [],
      triggerTypes: data.triggerTypes || [],
    });
  });

  console.log(`Found ${automations.length} automations:`);
  console.log(JSON.stringify(automations, null, 2));
}

findAutomations().catch(console.error);
