import { adminDb } from '../src/lib/firebase-admin';

async function main() {
  const snapshot = await adminDb.collection('message_logs')
    .where('channel', '==', 'sms')
    .limit(10)
    .get();

  console.log(`Found ${snapshot.size} recent SMS message logs.`);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Log ID: ${doc.id}, providerId: ${data.providerId}, status: ${data.status}, providerStatus: ${data.providerStatus}`);
  });
}

main().catch(console.error);
