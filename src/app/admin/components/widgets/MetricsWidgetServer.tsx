import { MetricsRow } from '@/components/dashboard/MetricsRow';
import { getMetricStats, getActiveWorkspace } from '@/lib/dashboard-server';

export async function MetricsWidgetServer({ workspaceId }: { workspaceId: string }) {
    const [stats, workspace] = await Promise.all([
        getMetricStats(workspaceId),
        getActiveWorkspace(workspaceId)
    ]);

    const terminology = workspace?.terminology || { singular: 'Entity', plural: 'Entities' };

    // Map stats to the format expected by MetricsRow
    // Note: MetricsRow expects totalSchools, but we use totalEntities
    const data = {
        totalSchools: stats.totalEntities,
        upcomingMeetings: stats.upcomingMeetings,
        publishedSurveys: stats.publishedSurveys,
        totalResponses: 0, // Placeholder
    };

    return (
        <div className="lg:col-span-4">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricsRow data={data} />
            </div>
        </div>
    );
}
