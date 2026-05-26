import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { getRecentActivities, getAuthorizedUsers, getWorkspaceEntities, getActiveWorkspace } from '@/lib/dashboard-server';

export async function ActivityWidgetServer({ workspaceId }: { workspaceId: string }) {
    const workspace = await getActiveWorkspace(workspaceId);
    
    if (!workspace?.organizationId) {
        return (
            <RecentActivity 
                activities={[]} 
                users={[]} 
                schools={[]}
                entities={[]}
                terminology={{ singular: 'Entity', plural: 'Entities' }}
            />
        );
    }

    const [activities, users, entities] = await Promise.all([
        getRecentActivities(workspaceId),
        getAuthorizedUsers(workspace.organizationId),
        getWorkspaceEntities(workspaceId)
    ]);
    
    const terminology = workspace.terminology || { singular: 'Entity', plural: 'Entities' };

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
