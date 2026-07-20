import { adminDb } from '../src/lib/firebase-admin';

async function main() {
    const snaps = await adminDb.collection('automations').get();
    
    snaps.forEach(doc => {
        const data = doc.data();
        if (data.name && data.name.includes('Enroll')) {
            console.log(`ID: ${doc.id}, Name: ${data.name}`);
        }
    });

    const jobsSnaps = await adminDb.collection('automation_jobs').limit(5).get();
    console.log('Sample Jobs Automation IDs:');
    jobsSnaps.forEach(j => {
        console.log(j.data().automationId);
    });
}

main().catch(console.error);
