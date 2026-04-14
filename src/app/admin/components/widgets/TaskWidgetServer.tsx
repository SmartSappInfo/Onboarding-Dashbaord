import { adminDb } from '@/lib/firebase-admin';
import { TaskWidget } from '@/components/dashboard/TaskWidget';
import type { Task } from '@/lib/types';
import { getActiveWorkspace } from '@/lib/dashboard-server';

export async function TaskWidgetServer({ workspaceId }: { workspaceId: string }) {
    // 1. Fetch tasks on server
    const snap = await adminDb.collection('tasks')
        .where('workspaceId', '==', workspaceId)
        .where('status', '!=', 'done')
        .orderBy('status')
        .orderBy('dueDate', 'asc')
        .limit(5)
        .get();

    const tasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));

    // 2. Fetch terminology (cached)
    const workspace = await getActiveWorkspace(workspaceId);
    const terminology = workspace?.terminology || { singular: 'Entity', plural: 'Entities' };

    // 3. Render Client Component with initial data
    return <TaskWidget initialTasks={tasks} terminology={terminology} />;
}
