import { ModuleRadarChart } from '@/components/dashboard/ModuleRadarChart';
import { getModuleFootprint } from '@/lib/dashboard-server';

export async function ModuleChartWidgetServer({ workspaceId }: { workspaceId: string }) {
    const data = await getModuleFootprint(workspaceId);
    return <ModuleRadarChart data={data} />;
}
