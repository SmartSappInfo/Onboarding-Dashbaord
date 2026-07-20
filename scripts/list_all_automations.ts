import { adminDb } from '../src/lib/firebase-admin';

async function main() {
    console.log('Fetching all automations...');
    const snaps = await adminDb.collection('automations').get();
    
    snaps.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, Name: ${data.name}`);
    });
}

main().catch(console.error);
