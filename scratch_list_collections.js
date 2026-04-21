import { adminDb } from './src/lib/firebase-admin.js';

async function listCollections() {
  try {
    const collections = await adminDb.listCollections();
    console.log('Collections:', collections.map(c => c.id).join(', '));
  } catch (err) {
    console.error('Error listing collections:', err);
  }
}

listCollections().catch(console.error);
