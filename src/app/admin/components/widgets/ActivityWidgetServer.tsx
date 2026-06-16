import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { getRecentActivities, getAuthorizedUsers, getActiveWorkspace } from '@/lib/dashboard-server';
import { getEntitiesByIds } from '@/lib/dashboard/dashboard-repository';
import { collectEntityIds } from '@/lib/dashboard/dashboard-domain';

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

    const [activities, users] = await Promise.all([
        getRecentActivities(workspaceId),
        getAuthorizedUsers(workspace.organizationId),
    ]);

    // Resolve ONLY the entities referenced by the (≤50) activities — never the
    // whole collection (previously all 50k were fetched AND serialized to the client).
    const entities = await getEntitiesByIds(collectEntityIds(activities));

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
