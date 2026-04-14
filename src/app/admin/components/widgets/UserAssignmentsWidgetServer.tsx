import { UserAssignments } from '@/components/dashboard/UserAssignments';
import { getUserAssignments, getWorkspaceEntities, getActiveWorkspace } from '@/lib/dashboard-server';

export async function UserAssignmentsWidgetServer({ workspaceId }: { workspaceId: string }) {
    const [data, entities, workspace] = await Promise.all([
        getUserAssignments(workspaceId),
        getWorkspaceEntities(workspaceId),
        getActiveWorkspace(workspaceId)
    ]);
    
    const terminology = workspace?.terminology || { singular: 'Entity', plural: 'Entities' };
    const totalStudents = entities.reduce((sum, we) => sum + (we.nominalRoll || 0), 0);

    return (
        <UserAssignments 
            data={data} 
            totalSchools={entities.length} 
            totalStudents={totalStudents}
            terminology={terminology}
        />
    );
}
