'use server';

import { adminDb } from './firebase-admin';
import type { Task, TaskStatus, TaskPriority, TaskCategory, EntityType } from './types';
import { logActivity } from './activity-logger';
import { resolveContact } from './contact-adapter';
import { canUser } from './workspace-permissions';

/**
 * Server action to create a task with workspace awareness and entity support.
 * 
 * Implements unified entity architecture (Requirements 3.1, 25.3):
 * - Strictly uses entityId as the primary identifier
 * - Resolves metadata (name, type) via the contact adapter
 * 
 * @param taskData - Task data (without id and createdAt)
 * @returns Created task document reference
 */
export async function createTaskAction(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, userId: string) {
    try {
        // 0. Permission Check
        const permission = await canUser(userId, 'operations', 'tasks', 'create', taskData.workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const timestamp = new Date().toISOString();
        const entityId = taskData.entityId;
        
        // Initialize fields
        let entityName: string | null = taskData.entityName || null;
        let entityType: EntityType | null = taskData.entityType || null;
        
        // Resolve entity information if possible
        if (taskData.workspaceId && entityId) {
            const contact = await resolveContact(entityId, taskData.workspaceId);
            if (contact) {
                entityName = contact.name;
                entityType = contact.entityType || null;
            }
        }
        
        // Build final task document
        const finalTaskData = {
            ...taskData,
            entityId,
            entityName,
            entityType,
            createdAt: timestamp,
            updatedAt: timestamp,
            status: taskData.status || 'todo',
            reminders: taskData.reminders || [],
            reminderSent: false,
        };
        
        // Create task document
        const docRef = await adminDb.collection('tasks').add(finalTaskData);
        
        // Log activity with workspace awareness
        await logActivity({
            organizationId: taskData.organizationId || '',
            workspaceId: taskData.workspaceId,
            entityId: entityId || undefined,
            entityType: entityType || undefined,
            userId: null,
            type: 'task_created',
            source: 'system',
            description: `initialized a new task protocol: "${taskData.title}"`,
            metadata: { taskId: docRef.id, category: taskData.category }
        });
        
        return { success: true, id: docRef.id };
    } catch (error: any) {
        console.error('[TASK] Failed to create task:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Server action to update a task with entity awareness.
 * 
 * @param taskId - Task document ID
 * @param updates - Partial task updates
 * @param userId - User ID for permission check
 * @returns Success status
 */
export async function updateTaskAction(taskId: string, updates: Partial<Task>, userId: string) {
    try {
        // 0. Permission Check
        const permission = await canUser(userId, 'operations', 'tasks', 'edit', updates.workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const timestamp = new Date().toISOString();
        
        const data: any = {
            ...updates,
            updatedAt: timestamp,
        };
        
        const isMarkingDone = updates.status === 'done';
        
        if (isMarkingDone && !updates.completedAt) {
            data.completedAt = timestamp;
        } else if (updates.status && updates.status !== 'done') {
            data.completedAt = null;
        }
        
        await adminDb.collection('tasks').doc(taskId).update(data);
        
        if (isMarkingDone) {
            await logActivity({
                organizationId: updates.organizationId || '',
                workspaceId: updates.workspaceId || '',
                entityId: updates.entityId || undefined,
                entityType: updates.entityType || undefined,
                userId: null,
                type: 'task_completed',
                source: 'system',
                description: `successfully resolved task: "${updates.title || 'Task Record'}"`,
                metadata: { taskId }
            });
        }
        
        return { success: true };
    } catch (error: any) {
        console.error('[TASK] Failed to update task:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Server action to delete a task.
 * 
 * @param taskId - Task document ID
 * @param userId - User ID for permission check
 * @returns Success status
 */
export async function deleteTaskAction(taskId: string, userId: string) {
    try {
        const docSnap = await adminDb.collection('tasks').doc(taskId).get();
        if (!docSnap.exists) throw new Error("Task not found.");
        const workspaceId = docSnap.data()?.workspaceId;

        const permission = await canUser(userId, 'operations', 'tasks', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        await adminDb.collection('tasks').doc(taskId).delete();
        return { success: true };
    } catch (error: any) {
        console.error('[TASK] Failed to delete task:', error);
        return { success: false, error: error.message };
    }
}

/**
 * @param entityId - Unified Entity Identifier (string)
 * @param workspaceId - Workspace context
 * @returns Array of tasks for the contact
*/
export async function getTasksForContact(
    entityId: string,
    workspaceId: string
): Promise<Task[]> {
    try {
        if (!entityId) return [];

        const snapshot = await adminDb
            .collection('tasks')
            .where('workspaceId', '==', workspaceId)
            .where('entityId', '==', entityId)
            .orderBy('dueDate', 'asc')
            .get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Task[];
    } catch (error: any) {
        console.error('[TASK] Failed to query tasks for contact:', error);
        return [];
    }
}

/**
 * Bulk updates multiple tasks.
 */
export async function bulkUpdateTasksAction(taskIds: string[], updates: Partial<Task>, userId: string, workspaceId: string) {
    try {
        const permission = await canUser(userId, 'operations', 'tasks', 'edit', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const batch = adminDb.batch();
        const timestamp = new Date().toISOString();

        taskIds.forEach(id => {
            const data: any = { ...updates, updatedAt: timestamp };
            if (updates.status === 'done') data.completedAt = timestamp;
            batch.update(adminDb.collection('tasks').doc(id), data);
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error('[TASK] Bulk Update Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Bulk deletes multiple tasks.
 */
export async function bulkDeleteTasksAction(taskIds: string[], userId: string, workspaceId: string) {
    try {
        const permission = await canUser(userId, 'operations', 'tasks', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const batch = adminDb.batch();
        taskIds.forEach(id => {
            batch.delete(adminDb.collection('tasks').doc(id));
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error('[TASK] Bulk Delete Error:', error);
        return { success: false, error: error.message };
    }
}
