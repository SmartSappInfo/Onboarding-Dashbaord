import { getModuleFootprint, getActiveWorkspace } from '@/lib/dashboard-server';
import { ModuleRadarChart } from '@/components/dashboard/ModuleRadarChart';

export async function ModuleChartWidgetServer({ workspaceId }: { workspaceId: string }) {
    const [data, workspace] = await Promise.all([
        getModuleFootprint(workspaceId),
        getActiveWorkspace(workspaceId)
    ]);
    const terminology = workspace?.terminology || { singular: 'Entity', plural: 'Entities' };
    return <ModuleRadarChart data={data} terminology={terminology} />;
}
