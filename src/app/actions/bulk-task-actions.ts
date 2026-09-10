'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Task, WorkspaceEntity } from '@/lib/types';
import { getErrorMessage } from '@/lib/errors/report-error';

interface BulkTaskCreationData {
  entityIds: string[];
  workspaceId: string;
  organizationId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  dueDaysOffset: number; // offset days from now
}

/**
 * Unguarded core, for callers that have ALREADY established authority.
 *
 * `message-status-automations.ts` invokes this from the automation engine, which
 * runs without a user session and so cannot satisfy a session guard.
 */
export async function bulkCreateTasksActionCore(data: BulkTaskCreationData) {
  try {
    const {
      entityIds,
      workspaceId,
      organizationId,
      title,
      description,
      priority,
      category,
      dueDaysOffset,
    } = data;

    if (entityIds.length === 0) {
      return { success: true, count: 0 };
    }

    const now = new Date();
    const timestamp = now.toISOString();
    
    // Calculate dueDate
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDaysOffset);
    const dueDateString = dueDate.toISOString();

    const processedResults: string[] = [];
    const chunkLimit = 450; // Safety limit under 500

    for (let i = 0; i < entityIds.length; i += chunkLimit) {
      const chunk = entityIds.slice(i, i + chunkLimit);
      const batch = adminDb.batch();

      // Fetch entities to retrieve dynamic details (entityName and entityType)
      const entityRefs = chunk.map(id =>
        adminDb.collection('workspace_entities').doc(`${workspaceId}_${id}`)
      );
      
      const entitySnapshots = await adminDb.getAll(...entityRefs);

      entitySnapshots.forEach(snap => {
        if (!snap.exists) return;
        const entity = snap.data() as WorkspaceEntity;

        const taskRef = adminDb.collection('tasks').doc();
        const taskData: Omit<Task, 'id'> = {
          workspaceId,
          organizationId,
          entityId: entity.entityId,
          entityName: entity.displayName || null,
          entityType: entity.entityType || null,
          title,
          description: description || '',
          priority,
          status: 'todo',
          category: category as any,
          dueDate: dueDateString,
          createdAt: timestamp,
          updatedAt: timestamp,
          assignedTo: entity.assignedTo?.userId || "",
          reminders: [],
          reminderSent: false,
        };

        batch.set(taskRef, taskData);
        processedResults.push(taskRef.id);
      });

      await batch.commit();
    }

    return {
      success: true,
      count: processedResults.length,
      message: `Successfully initiated ${processedResults.length} administrative tasks.`
    };
  } catch (error: unknown) {
    console.error('[bulkCreateTasksAction] Error:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Server Action entry point — a public HTTP endpoint, so it authenticates its caller
 * (audit F2). Bulk creation across many entities is exactly the kind of thing that
 * should never run for an anonymous caller.
 */
export async function bulkCreateTasksAction(data: BulkTaskCreationData) {
  const { requireAuth } = await import('@/lib/auth/require-auth');
  await requireAuth();
  return bulkCreateTasksActionCore(data);
}
