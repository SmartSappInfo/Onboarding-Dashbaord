import { adminDb } from '../src/lib/firebase-admin';

async function main() {
    console.log('Querying jobs for automation MCs1nHdHK7AgcffzX6w0...');
    const runsSnap = await adminDb.collection('automation_runs')
        .where('automationId', '==', 'MCs1nHdHK7AgcffzX6w0')
        .get();

    console.log(`Found ${runsSnap.size} runs.`);
    let completed = 0, running = 0, failed = 0;
    
    runsSnap.forEach(r => {
        const data = r.data();
        if (data.status === 'completed') completed++;
        else if (data.status === 'running') running++;
        else if (data.status === 'failed') failed++;
    });

    console.log(`Runs: ${completed} completed, ${running} running, ${failed} failed`);

    const jobsSnap = await adminDb.collection('automation_jobs')
        .where('automationId', '==', 'MCs1nHdHK7AgcffzX6w0')
        .get();

    console.log(`Found ${jobsSnap.size} jobs.`);
    const jobsByNode: Record<string, number> = {};
    const jobsByStatus: Record<string, number> = {};
    jobsSnap.forEach(j => {
        const data = j.data();
        jobsByNode[data.targetNodeId] = (jobsByNode[data.targetNodeId] || 0) + 1;
        jobsByStatus[data.status] = (jobsByStatus[data.status] || 0) + 1;
    });

    console.log('Jobs by Node:', jobsByNode);
    console.log('Jobs by Status:', jobsByStatus);
}

main().catch(console.error);
