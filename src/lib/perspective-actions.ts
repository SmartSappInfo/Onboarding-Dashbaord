
'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { Perspective } from './types';

/**
 * @fileOverview Server-side actions for Perspective Management.
 * Handles CRUD for institutional tracks with strict data-association checks.
 */

/**
 * Creates or updates a Perspective.
 */
export async function savePerspectiveAction(id: string | null, data: Partial<Perspective>, userId: string) {
    try {
        const timestamp = new Date().toISOString();
        const slug = data.name?.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        const payload = {
            ...data,
            slug,
            updatedAt: timestamp,
        };

        if (id) {
            await adminDb.collection('perspectives').doc(id).update(payload);
            revalidatePath('/admin/settings');
            return { success: true, id };
        } else {
            const newId = slug || `perspective_${Date.now()}`;
            const docRef = adminDb.collection('perspectives').doc(newId);
            
            // Check for collision
            const existing = await docRef.get();
            if (existing.exists) throw new Error("A perspective with this name already exists.");

            await docRef.set({
                ...payload,
                id: newId,
                status: 'active',
                createdAt: timestamp
            });

            await logActivity({
                schoolId: '',
                userId,
                perspectiveId: 'system',
                type: 'school_created', // Reuse generic type
                source: 'user_action',
                description: `architected new perspective: "${data.name}"`
            });

            revalidatePath('/admin/settings');
            return { success: true, id: newId };
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Attempts to delete a perspective. 
 * Rejects if data (Schools, Tasks, Pipelines) is associated with it.
 */
export async function deletePerspectiveAction(id: string, userId: string) {
    try {
        const db = adminDb;
        
        // 1. Audit Phase: Check all associated collections
        const schoolsCount = (await db.collection('schools').where('perspectiveId', '==', id).limit(1).get()).size;
        const tasksCount = (await db.collection('tasks').where('perspectiveId', '==', id).limit(1).get()).size;
        const pipelinesCount = (await db.collection('pipelines').where('perspectiveId', '==', id).limit(1).get()).size;
        const activitiesCount = (await db.collection('activities').where('perspectiveId', '==', id).limit(1).get()).size;

        const associations = [];
        if (schoolsCount > 0) associations.push("Schools");
        if (tasksCount > 0) associations.push("CRM Tasks");
        if (pipelinesCount > 0) associations.push("Pipelines/Workflows");
        if (activitiesCount > 0) associations.push("Activity Logs");

        if (associations.length > 0) {
            return { 
                success: false, 
                error: `Deletion rejected. Perspective has active associations in: ${associations.join(', ')}.`,
                canArchive: true // Suggest archiving instead
            };
        }

        // 2. Execute Purge
        await db.collection('perspectives').doc(id).delete();
        revalidatePath('/admin/settings');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Archives a perspective to remove it from selection while preserving data links.
 */
export async function archivePerspectiveAction(id: string, archive: boolean) {
    try {
        await adminDb.collection('perspectives').doc(id).update({
            status: archive ? 'archived' : 'active',
            updatedAt: new Date().toISOString()
        });
        revalidatePath('/admin/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
