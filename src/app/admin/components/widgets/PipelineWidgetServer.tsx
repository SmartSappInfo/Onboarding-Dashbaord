import { PipelinePieChart } from '@/components/dashboard/PipelinePieChart';
import { getPipelineStats, getActiveWorkspace } from '@/lib/dashboard-server';

export async function PipelineWidgetServer({ workspaceId }: { workspaceId: string }) {
    const [stages, workspace] = await Promise.all([
        getPipelineStats(workspaceId),
        getActiveWorkspace(workspaceId)
    ]);
    
    const terminology = workspace?.terminology || { singular: 'Entity', plural: 'Entities' };

    return <PipelinePieChart stages={stages} terminology={terminology} />;
}
