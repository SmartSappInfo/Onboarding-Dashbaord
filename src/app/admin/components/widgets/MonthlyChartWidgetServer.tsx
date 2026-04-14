import { MonthlySchoolsChart } from '@/components/dashboard/MonthlySchoolsChart';
import { getMonthlyTrend, getActiveWorkspace } from '@/lib/dashboard-server';

export async function MonthlyChartWidgetServer({ workspaceId }: { workspaceId: string }) {
    const [data, workspace] = await Promise.all([
        getMonthlyTrend(workspaceId),
        getActiveWorkspace(workspaceId)
    ]);
    
    const terminology = workspace?.terminology || { singular: 'Entity', plural: 'Entities' };

    return <MonthlySchoolsChart data={data} terminology={terminology} />;
}
