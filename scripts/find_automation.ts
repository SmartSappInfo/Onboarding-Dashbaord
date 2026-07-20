import { adminDb } from '../src/lib/firebase-admin';

async function main() {
    const snaps = await adminDb.collection('automations').where('name', '==', '[Sequence] Enrollment Masterclass Automation').get();
    if (snaps.empty) {
        console.log('No automation found with that name');
        
        // try partial search
        const all = await adminDb.collection('automations').get();
        all.forEach(d => {
            if (d.data().name.includes('Masterclass')) {
                console.log(d.id, d.data().name);
            }
        });
        return;
    }

    snaps.forEach(snap => {
        console.log(`Found automation: ${snap.id} - ${snap.data().name}`);
    });
}

main().catch(console.error);
