'use client';

import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    serverTimestamp,
    type Firestore 
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
    const data = {
        ...updates,
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
