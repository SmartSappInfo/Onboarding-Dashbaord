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
        // Log to timeline
        logActivity({
            schoolId: task.schoolId || '',
            userId: null, 
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

    // Logic: Capture completedAt if status moves to 'done'
    if (isMarkingDone && !updates.completedAt) {
        data.completedAt = timestamp;
    } else if (updates.status && updates.status !== 'done') {
        data.completedAt = null; // Reopened
    }

    updateDoc(taskRef, data).then(() => {
        if (isMarkingDone) {
            // Log resolution
            logActivity({
                schoolId: updates.schoolId || '',
                userId: null,
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
