
'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { Workspace } from './types';

/**
 * @fileOverview Server-side actions for Workspace Management.
 */

/**
 * Creates or updates a Workspace.
 */
export async function saveWorkspaceAction(id: string | null, data: Partial<Workspace>, userId: string) {
    try {
        const timestamp = new Date().toISOString();
        const slug = data.name?.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        const payload = {
            ...data,
            slug,
            updatedAt: timestamp,
        };

        if (id) {
            await adminDb.collection('workspaces').doc(id).update(payload);
            revalidatePath('/admin/settings');
            return { success: true, id };
        } else {
            const newId = slug || `workspace_${Date.now()}`;
            const docRef = adminDb.collection('workspaces').doc(newId);
            
            // Check for collision
            const existing = await docRef.get();
            if (existing.exists) throw new Error("A workspace with this name already exists.");

            await docRef.set({
                ...payload,
                id: newId,
                status: 'active',
                createdAt: timestamp
            });

            await logActivity({
                schoolId: '',
                userId,
                workspaceId: 'system',
                type: 'school_created',
                source: 'user_action',
                description: `architected new workspace: "${data.name}"`
            });

            revalidatePath('/admin/settings');
            return { success: true, id: newId };
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Attempts to delete a workspace. 
 */
export async function deleteWorkspaceAction(id: string, userId: string) {
    try {
        const db = adminDb;
        
        // Audit associated data
        const schoolsCount = (await db.collection('schools').where('workspaceId', '==', id).limit(1).get()).size;
        const tasksCount = (await db.collection('tasks').where('workspaceId', '==', id).limit(1).get()).size;
        const pipelinesCount = (await db.collection('pipelines').where('workspaceId', '==', id).limit(1).get()).size;
        const activitiesCount = (await db.collection('activities').where('workspaceId', '==', id).limit(1).get()).size;

        const associations = [];
        if (schoolsCount > 0) associations.push("Schools");
        if (tasksCount > 0) associations.push("CRM Tasks");
        if (pipelinesCount > 0) associations.push("Pipelines/Workflows");
        if (activitiesCount > 0) associations.push("Activity Logs");

        if (associations.length > 0) {
            return { 
                success: false, 
                error: `Deletion rejected. Workspace has active associations in: ${associations.join(', ')}.`,
                canArchive: true 
            };
        }

        await db.collection('workspaces').doc(id).delete();
        revalidatePath('/admin/settings');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Archives a workspace.
 */
export async function archiveWorkspaceAction(id: string, archive: boolean) {
    try {
        await adminDb.collection('workspaces').doc(id).update({
            status: archive ? 'archived' : 'active',
            updatedAt: new Date().toISOString()
        });
        revalidatePath('/admin/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
