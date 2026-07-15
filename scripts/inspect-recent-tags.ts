import { adminDb } from '../src/lib/firebase-admin';

async function inspectTags() {
  console.log('>>> [INSPECT] Querying tags for prospect workspace...');
  const snap = await adminDb.collection('tags')
    .where('workspaceId', '==', 'prospect')
    .get();

  const tags: any[] = [];
  snap.forEach((doc) => {
    tags.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  console.log('Tags in prospect workspace:', JSON.stringify(tags, null, 2));
}

inspectTags().catch(console.error);
