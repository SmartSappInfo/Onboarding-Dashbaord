import { adminDb } from '../src/lib/firebase-admin';

async function main() {
    const snap = await adminDb.collection('automations').doc('fKusL81zGttPq1025ZLA').get();
    if (!snap.exists) {
        console.log('Not found by ID, trying query...');
        const snaps = await adminDb.collection('automations').where('name', '==', '[Sequence] Enrollment Masterclass Automation').get();
        if (snaps.empty) {
            console.log('Not found by query');
            return;
        }
        console.dir(snaps.docs[0].data().nodes, {depth: null});
    } else {
        console.dir(snap.data()?.nodes, {depth: null});
    }
}

main().catch(console.error);
