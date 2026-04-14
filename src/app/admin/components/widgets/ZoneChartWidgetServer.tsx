import { ZoneDistribution } from '@/components/dashboard/ZoneDistribution';
import { getZoneDistribution, getActiveWorkspace } from '@/lib/dashboard-server';

export async function ZoneChartWidgetServer({ workspaceId }: { workspaceId: string }) {
    const [data, workspace] = await Promise.all([
        getZoneDistribution(workspaceId),
        getActiveWorkspace(workspaceId)
    ]);
    
    const terminology = workspace?.terminology || { singular: 'Entity', plural: 'Entities' };

    return <ZoneDistribution data={data} terminology={terminology} />;
}
