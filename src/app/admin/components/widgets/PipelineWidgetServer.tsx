import { PipelinePieChart } from '@/components/dashboard/PipelinePieChart';
import { getPipelineStats, getActiveWorkspace } from '@/lib/dashboard-server';

export async function PipelineWidgetServer({ workspaceId }: { workspaceId: string }) {
    const [pipelineData, workspace] = await Promise.all([
        getPipelineStats(workspaceId),
        getActiveWorkspace(workspaceId)
    ]);
    
    const terminology = workspace?.terminology || { singular: 'Entity', plural: 'Entities' };

    // getPipelineStats now returns an object with stages array
    return <PipelinePieChart stages={pipelineData.stages || []} terminology={terminology} />;
}
