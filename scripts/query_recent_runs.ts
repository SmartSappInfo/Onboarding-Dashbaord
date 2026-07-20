import { adminDb } from '../src/lib/firebase-admin';

async function main() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    console.log('Querying runs started recently...');
    const runsSnap = await adminDb.collection('automation_runs')
        .where('startedAt', '>', twentyFourHoursAgo)
        .limit(10)
        .get();

    console.log(`Found ${runsSnap.size} recent runs.`);
    const autoIds = new Set<string>();
    runsSnap.forEach(r => {
        autoIds.add(r.data().automationId);
        console.log(`Run ${r.id}: Status=${r.data().status}, Automation=${r.data().automationId}`);
    });

    console.log(`Unique Automation IDs:`, Array.from(autoIds));
}

main().catch(console.error);
