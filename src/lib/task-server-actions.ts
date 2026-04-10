'use server';

import { adminDb } from './firebase-admin';
import type { Task, TaskStatus, TaskPriority, TaskCategory, EntityType } from './types';
import { logActivity } from './activity-logger';
import { resolveContact } from './contact-adapter';

/**
 * Server action to create a task with workspace awareness and entity support.
 * 
 * Implements dual-write pattern (Requirements 3.1, 25.3):
 * - Accepts both entityId and entityId parameters
 * - When only entityId provided: Resolves entityId from contact adapter
 * - When only entityId provided: Resolves entityId from contact adapter (if migrated)
 * - When both provided: Uses both as-is
 * - Always sets entityType based on resolved contact type
 * 
 * @param taskData - Task data (without id and createdAt)
 * @returns Created task document reference
 */
export async function createTaskAction(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
        const timestamp = new Date().toISOString();
        
        // Initialize fields for dual-write
        let entityName: string | null = taskData.entityName || null;
        let entityType: EntityType | null = taskData.entityType || null;
        
        // Dual-write resolution logic (Requirements 3.1, 25.3)
        if (taskData.workspaceId) {
            // Resolving entityId logic
            if (entityId) {
                const contact = await resolveContact({ entityId }, taskData.workspaceId);
                if (contact) {
                    entityId = contact.schoolData?.id || null;
                    entityName = contact.name;
                    entityType = contact.entityType || null;
                }
            }
            }
            }
        }
        
        // Build final task document with dual-write fields
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
 * @returns Success status
 */
export async function updateTaskAction(taskId: string, updates: Partial<Task>) {
    try {
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
 * @returns Success status
 */
export async function deleteTaskAction(taskId: string) {
    try {
        await adminDb.collection('tasks').doc(taskId).delete();
        return { success: true };
    } catch (error: any) {
        console.error('[TASK] Failed to delete task:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Query tasks for a contact with fallback pattern (Requirements 3.4, 3.5, 22.1, 22.3)
 * 
 * Accepts either entityId or entityId as identifier:
 * - Prefers entityId when both provided
 * - Falls back to entityId for legacy records
 * - Returns all matching tasks for the contact
 * 
 * @param identifier - Contact identifier (entityId or entityId)
 * @param workspaceId - Workspace context
 * @returns Array of tasks for the contact
 */
export async function getTasksForContact(
    identifier: { entityId?: string },
    workspaceId: string
): Promise<Task[]> {
    try {
        let tasksQuery;
        
        // Prefer entityId when both provided (Requirement 3.4, 3.5)
        if (identifier.entityId) {
            tasksQuery = adminDb
                .collection('tasks')
                .where('workspaceId', '==', workspaceId)
                .where('entityId', '==', identifier.entityId)
                .orderBy('dueDate', 'asc');
        } else {
            return [];
        }
        
        const snapshot = await tasksQuery.get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Task[];
    } catch (error: any) {
        console.error('[TASK] Failed to query tasks for contact:', error);
        return [];
    }
}
