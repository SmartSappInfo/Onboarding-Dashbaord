'use client';

import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    type Firestore,
    writeBatch
} from 'firebase/firestore';
import type { Task, TaskStatus, TaskPriority, TaskCategory } from './types';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { logActivity } from './activity-logger';

/**
 * Resolves entity information for a task using the contact adapter.
 * Supports dual-write for legacy schools records (Requirement 13.4, 13.5)
 * 
 * @param schoolId - Legacy school ID (if provided)
 * @param workspaceId - Workspace context
 * @returns Object with schoolId, schoolName, entityId, entityType
 */
async function resolveTaskEntityInfo(schoolId: string | null | undefined, workspaceId: string) {
    if (!schoolId) {
        return { schoolId: null, schoolName: null, entityId: null, entityType: null };
    }

    try {
        // Use adapter layer to resolve contact (works with both legacy and migrated records)
        const { resolveContact } = await import('./contact-adapter');
        const contact = await resolveContact(schoolId, workspaceId);
        
        if (contact) {
            return {
                schoolId: schoolId, // Maintain backward compatibility
                schoolName: contact.name,
                entityId: contact.entityId || null,
                entityType: contact.entityType || null,
            };
        }
    } catch (error) {
        console.error('[TASK] Failed to resolve entity info:', error);
    }

    // Fallback: just use schoolId
    return { schoolId, schoolName: null, entityId: null, entityType: null };
}

/**
 * Resolves the navigation path for a task's linked record.
 */
export function getTaskInterlinkUrl(task: Task): string | null {
    if (!task.relatedEntityType || !task.relatedEntityId) return null;
    
    if (task.relatedEntityType === 'SurveyResponse' && task.relatedParentId) {
        return `/admin/surveys/${task.relatedParentId}/results/${task.relatedEntityId}`;
    }
    
    if (task.relatedEntityType === 'Submission' && task.relatedParentId) {
        return `/admin/pdfs/${task.relatedParentId}/submissions/${task.relatedEntityId}`;
    }
    
    if (task.relatedEntityType === 'School') {
        return `/admin/schools/${task.relatedEntityId}`;
    }

    if (task.relatedEntityType === 'Meeting') {
        return `/admin/meetings/${task.relatedEntityId}/edit`;
    }

    return null;
}

/**
 * Creates a new administrative task. (Non-blocking)
 * 
 * Updated for workspace awareness (Requirement 13):
 * - Requires workspaceId to be set on all new tasks
 * - Supports entityId and entityType for unified entity model
 * - Maintains backward compatibility with schoolId (dual-write)
 */
export function createTaskNonBlocking(db: Firestore, task: Omit<Task, 'id' | 'createdAt'>) {
    const tasksCol = collection(db, 'tasks');
    const timestamp = new Date().toISOString();
    
    const taskData = {
        ...task,
        createdAt: timestamp,
        updatedAt: timestamp,
        status: task.status || 'todo',
        reminders: task.reminders || [],
        reminderSent: false,
    };

    return addDoc(tasksCol, taskData).then(docRef => {
        // Log to timeline with workspace awareness (Requirement 13)
        logActivity({
            organizationId: task.organizationId || 'default',
            schoolId: task.schoolId || undefined,
            entityId: task.entityId || undefined,
            entityType: task.entityType || undefined,
            userId: null, 
            workspaceId: task.workspaceId,
            type: 'task_created',
            source: 'system',
            description: `initialized a new task protocol: "${task.title}"`,
            metadata: { taskId: docRef.id, category: task.category }
        });
        return docRef;
    }).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
            path: tasksCol.path,
            operation: 'create',
            requestResourceData: taskData,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Updates an existing task. (Non-blocking)
 */
export function updateTaskNonBlocking(db: Firestore, taskId: string, updates: Partial<Task>) {
    const taskRef = doc(db, 'tasks', taskId);
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

    updateDoc(taskRef, data).then(() => {
        if (isMarkingDone) {
            logActivity({
                organizationId: updates.organizationId || 'default',
                schoolId: updates.schoolId || '',
                userId: null,
                workspaceId: updates.workspaceId ? updates.workspaceId : 'onboarding',
                type: 'task_completed',
                source: 'system',
                description: `successfully resolved task: "${updates.title || 'Task Record'}"`,
                metadata: { taskId }
            });
        }
    }).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
            path: taskRef.path,
            operation: 'update',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Marks a task as complete. (Non-blocking)
 */
export function completeTaskNonBlocking(db: Firestore, taskId: string) {
    updateTaskNonBlocking(db, taskId, {
        status: 'done',
    });
}

/**
 * Bulk updates multiple tasks with shared properties.
 */
export async function bulkUpdateTasks(db: Firestore, taskIds: string[], updates: Partial<Task>) {
    const batch = writeBatch(db);
    const timestamp = new Date().toISOString();
    
    taskIds.forEach(id => {
        const data: any = { ...updates, updatedAt: timestamp };
        if (updates.status === 'done') data.completedAt = timestamp;
        batch.update(doc(db, 'tasks', id), data);
    });
    return batch.commit();
}

/**
 * Bulk deletes multiple tasks.
 */
export async function bulkDeleteTasks(db: Firestore, taskIds: string[]) {
    const batch = writeBatch(db);
    taskIds.forEach(id => {
        batch.delete(doc(db, 'tasks', id));
    });
    return batch.commit();
}

/**
 * Bulk marks multiple tasks as complete.
 */
export async function bulkCompleteTasks(db: Firestore, taskIds: string[]) {
    return bulkUpdateTasks(db, taskIds, { status: 'done' });
}

/**
 * Deletes a task. (Non-blocking)
 */
export function deleteTaskNonBlocking(db: Firestore, taskId: string) {
    const taskRef = doc(db, 'tasks', taskId);
    deleteDoc(taskRef).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
            path: taskRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}
