import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    try {
        console.log('Querying jobs for automation fKusL81zGttPq1025ZLA...');
        const runsSnap = await adminDb.collection('automation_runs')
            .where('automationId', '==', 'fKusL81zGttPq1025ZLA')
            .get();

        let completed = 0, running = 0, failed = 0;
        const currentNodes: Record<string, number> = {};
        
        runsSnap.forEach(r => {
            const data = r.data();
            if (data.status === 'completed') completed++;
            else if (data.status === 'running') running++;
            else if (data.status === 'failed') failed++;
            
            if (data.status === 'running') {
                const node = data.currentNodeId || 'unknown';
                currentNodes[node] = (currentNodes[node] || 0) + 1;
            }
        });

        const jobsSnap = await adminDb.collection('automation_jobs')
            .where('automationId', '==', 'fKusL81zGttPq1025ZLA')
            .get();

        const jobsByNode: Record<string, number> = {};
        const jobsByStatus: Record<string, number> = {};
        jobsSnap.forEach(j => {
            const data = j.data();
            jobsByNode[data.targetNodeId] = (jobsByNode[data.targetNodeId] || 0) + 1;
            jobsByStatus[data.status] = (jobsByStatus[data.status] || 0) + 1;
        });

        return NextResponse.json({
            runs: { completed, running, failed, currentNodes },
            jobs: { byNode: jobsByNode, byStatus: jobsByStatus }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
