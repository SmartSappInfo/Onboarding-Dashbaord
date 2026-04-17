
'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { Pipeline } from './types';
import { canUser } from './workspace-permissions';

/**
 * @fileOverview Server-side actions for Pipeline management.
 */

/**
 * Updates an existing pipeline or initializes a new one.
 */
export async function savePipelineAction(id: string | null, data: Partial<Pipeline>, userId: string) {
    try {
        // 0. Permission Check
        const permission = await canUser(userId, 'operations', 'pipeline', id ? 'edit' : 'create', data.workspaceIds?.[0]);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const timestamp = new Date().toISOString();
        const payload = {
            ...data,
            updatedAt: timestamp
        };

        if (id) {
            await adminDb.collection('pipelines').doc(id).update(payload);
            revalidatePath('/admin/pipeline');
            return { success: true, id };
        } else {
            const docRef = await adminDb.collection('pipelines').add({
                ...payload,
                createdAt: timestamp,
                isDefault: false
            });
            revalidatePath('/admin/pipeline');
            return { success: true, id: docRef.id };
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Sets a specific pipeline as the default for its workspace.
 * Automatically unsets any existing default in that same workspace.
 */
export async function setPipelineAsDefaultAction(pipelineId: string, workspaceId: string, userId: string) {
    try {
        const db = adminDb;
        const batch = db.batch();
        const timestamp = new Date().toISOString();

        // 1. Locate all other pipelines in this workspace that are currently default
        const existingDefaultsSnap = await db.collection('pipelines')
            .where('workspaceId', '==', workspaceId)
            .where('isDefault', '==', true)
            .get();

        existingDefaultsSnap.forEach(doc => {
            if (doc.id !== pipelineId) {
                batch.update(doc.ref, { isDefault: false, updatedAt: timestamp });
            }
        });

        // 2. Set the target pipeline as default
        batch.update(db.collection('pipelines').doc(pipelineId), { 
            isDefault: true, 
            updatedAt: timestamp 
        });

        await batch.commit();
        revalidatePath('/admin/pipeline');
        return { success: true };
    } catch (e: any) {
        console.error(">>> [PIPELINE:DEFAULT] FAILED:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Purges a pipeline blueprint.
 */
export async function deletePipelineAction(id: string, userId: string) {
    try {
        const docSnap = await adminDb.collection('pipelines').doc(id).get();
        if (!docSnap.exists) throw new Error("Pipeline not found.");
        const workspaceId = docSnap.data()?.workspaceId;

        // 0. Permission Check
        const permission = await canUser(userId, 'operations', 'pipeline', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        await adminDb.collection('pipelines').doc(id).delete();
        revalidatePath('/admin/pipeline');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
