import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { getRecentActivities, getAuthorizedUsers, getWorkspaceEntities, getActiveWorkspace } from '@/lib/dashboard-server';

export async function ActivityWidgetServer({ workspaceId }: { workspaceId: string }) {
    const [activities, users, entities, workspace] = await Promise.all([
        getRecentActivities(workspaceId),
        getAuthorizedUsers(),
        getWorkspaceEntities(workspaceId),
        getActiveWorkspace(workspaceId)
    ]);
    
    const terminology = workspace?.terminology || { singular: 'Entity', plural: 'Entities' };

    return (
        <RecentActivity 
            activities={activities} 
            users={users} 
            schools={[]} // Legacy schools handled as entities now
            entities={entities}
            terminology={terminology}
        />
    );
}
