'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Task, WorkspaceEntity } from '@/lib/types';

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

export async function bulkCreateTasksAction(data: BulkTaskCreationData) {
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
  } catch (error: any) {
    console.error('[bulkCreateTasksAction] Error:', error);
    return { success: false, error: error.message };
  }
}
