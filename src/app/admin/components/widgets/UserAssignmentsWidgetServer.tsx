import { UserAssignments } from '@/components/dashboard/UserAssignments';
import { getUserAssignments, getActiveWorkspace } from '@/lib/dashboard-server';
import { countActiveEntities, sumActiveCapacity } from '@/lib/dashboard/dashboard-repository';

export async function UserAssignmentsWidgetServer({ workspaceId }: { workspaceId: string }) {
    // Totals come from server-side aggregations (count/sum) instead of fetching
    // every entity just to length/reduce them.
    const [data, totalEntities, totalCapacity, workspace] = await Promise.all([
        getUserAssignments(workspaceId),
        countActiveEntities(workspaceId),
        sumActiveCapacity(workspaceId),
        getActiveWorkspace(workspaceId),
    ]);

    const terminology = workspace?.terminology || { singular: 'Entity', plural: 'Entities' };

    return (
        <UserAssignments
            data={data}
            totalSchools={totalEntities}
            totalCapacity={totalCapacity}
            terminology={terminology}
        />
    );
}
