import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Automation Diagnostic Route (/api/diagnostic)
 * ---------------------------------------------
 * Parameterless GET route handlers are statically rendered during `next build` by default in Next.js.
 * Enforces `dynamic = 'force-dynamic'` and `revalidate = 0` to prevent CI build-time evaluation
 * attempting to query Firestore without active cloud credentials.
 *
 * SECURITY: previously unauthenticated while dumping `automation_runs` / `automation_jobs`
 * via `adminDb`. Now restricted to platform system admins (audit F3).
 *
 * NOTE: this route queries a hardcoded automation ID and has no callers in the codebase —
 * it appears to be a debugging leftover. Consider deleting it outright rather than
 * maintaining it.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateApiRequest(request, { requireSystemAdmin: true });
        if (!auth.success) return auth.errorResponse;

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
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown diagnostic error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
