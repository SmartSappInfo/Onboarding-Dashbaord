import { adminDb } from '../src/lib/firebase-admin';

async function main() {
    console.log('Querying latest runs...');
    const runsSnap = await adminDb.collection('automation_runs')
        .orderBy('startedAt', 'desc')
        .limit(10)
        .get();

    console.log(`Found ${runsSnap.size} recent runs.`);
    const autoIds = new Set<string>();
    runsSnap.forEach(r => {
        autoIds.add(r.data().automationId);
        console.log(`Run ${r.id}: Status=${r.data().status}, Automation=${r.data().automationId}, CurrentNode=${r.data().currentNodeId}`);
    });

    console.log(`Unique Automation IDs:`, Array.from(autoIds));

    for (const autoId of Array.from(autoIds)) {
         const autoDoc = await adminDb.collection('automations').doc(autoId).get();
         console.log(`Auto ${autoId}: Name=${autoDoc.data()?.name}`);
    }
}

main().catch(console.error);
