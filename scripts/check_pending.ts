import { adminDb } from '../src/lib/firebase-admin';

async function main() {
    const doc = await adminDb.collection('automations').doc('MCs1nHdHK7AgcffzX6w0').get();
    const data = doc.data();
    if (!data) return;
    
    console.log('Nodes:');
    data.nodes.forEach((n: any) => {
        if (n.type === 'delayNode') {
            console.log(`- ${n.id}: Label="${n.data?.label}", config=${JSON.stringify(n.data?.config)}`);
        }
    });

    console.log('\nPending Jobs by Node:');
    const jobsSnap = await adminDb.collection('automation_jobs')
        .where('automationId', '==', 'MCs1nHdHK7AgcffzX6w0')
        .where('status', '==', 'pending')
        .get();

    const pendingByNode: Record<string, number> = {};
    jobsSnap.forEach(j => {
        const d = j.data();
        pendingByNode[d.targetNodeId] = (pendingByNode[d.targetNodeId] || 0) + 1;
    });
    console.log(pendingByNode);
}

main().catch(console.error);
