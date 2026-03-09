'use client';

import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    serverTimestamp,
    deleteField,
    type Firestore,
    writeBatch
} from 'firebase/firestore';
import type { Task, TaskStatus, TaskPriority, TaskCategory } from './types';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

/**
 * Creates a new administrative task. (Non-blocking)
 */
export function createTaskNonBlocking(db: Firestore, task: Omit<Task, 'id' | 'createdAt'>) {
    const tasksCol = collection(db, 'tasks');
    const taskData = {
        ...task,
        createdAt: new Date().toISOString(),
        status: task.status || 'pending',
        reminderSent: false,
    };

    return addDoc(tasksCol, taskData).catch(async (error) => {
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
    
    // Filter out undefined values to prevent Firestore crashes
    const cleanedUpdates = Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [k, v === undefined ? deleteField() : v])
    );

    const data = {
        ...cleanedUpdates,
        updatedAt: new Date().toISOString(),
    };

    updateDoc(taskRef, data).catch(async (error) => {
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
        status: 'completed',
        completedAt: new Date().toISOString(),
    });
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
    const batch = writeBatch(db);
    const timestamp = new Date().toISOString();
    taskIds.forEach(id => {
        batch.update(doc(db, 'tasks', id), {
            status: 'completed',
            completedAt: timestamp,
            updatedAt: timestamp
        });
    });
    return batch.commit();
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
