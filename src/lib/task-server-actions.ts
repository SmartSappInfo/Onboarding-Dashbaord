'use server';

import { adminDb } from './firebase-admin';
import type { Task, TaskStatus, TaskPriority, TaskCategory, EntityType } from './types';
import { logActivity } from './activity-logger';
import { resolveContact } from './contact-adapter';

/**
 * Server action to create a task with workspace awareness and entity support.
 * 
 * Implements Requirement 13:
 * - 13.1: Includes entityId and entityType fields
 * - 13.2: Requires workspaceId to be set
 * - 13.4: Supports dual-write for legacy schools records
 * - 13.5: Populates both schoolId (legacy) and entityId (new)
 * 
 * @param taskData - Task data (without id and createdAt)
 * @returns Created task document reference
 */
export async function createTaskAction(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
        const timestamp = new Date().toISOString();
        
        // Resolve entity information using adapter (Requirement 13.4, 13.5)
        let entityId: string | null = taskData.entityId || null;
        let entityType: EntityType | null = taskData.entityType || null;
        let schoolName: string | null = taskData.schoolName || null;
        
        // If schoolId is provided, use adapter to resolve entity info (dual-write support)
        if (taskData.schoolId && taskData.workspaceId) {
            const contact = await resolveContact(taskData.schoolId, taskData.workspaceId);
            if (contact) {
                schoolName = contact.name;
                entityId = contact.entityId || null;
                entityType = contact.entityType || null;
            }
        }
        
        // Build final task document with all fields
        const finalTaskData = {
            ...taskData,
            schoolName,
            entityId,
            entityType,
            createdAt: timestamp,
            updatedAt: timestamp,
            status: taskData.status || 'todo',
            reminders: taskData.reminders || [],
            reminderSent: false,
        };
        
        // Create task document
        const docRef = await adminDb.collection('tasks').add(finalTaskData);
        
        // Log activity with workspace awareness (Requirement 13)
        await logActivity({
            organizationId: taskData.organizationId || '',
            workspaceId: taskData.workspaceId,
            schoolId: taskData.schoolId || undefined,
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
                schoolId: updates.schoolId || undefined,
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
