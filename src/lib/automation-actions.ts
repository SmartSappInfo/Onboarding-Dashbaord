'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { Automation } from './types';

/**
 * @fileOverview Server-side actions for the Automation Engine.
 */

/**
 * Persists an automation blueprint to Firestore.
 * Handles both new creation and updates.
 */
export async function saveAutomationAction(id: string | null, data: Partial<Automation>, userId: string) {
    try {
        const timestamp = new Date().toISOString();
        const payload = {
            ...data,
            updatedAt: timestamp,
            createdBy: userId
        };

        if (id) {
            await adminDb.collection('automations').doc(id).update(payload);
            revalidatePath('/admin/automations');
            return { success: true, id };
        } else {
            // Ensure workspaceIds exists for new creations (array format)
            const docRef = await adminDb.collection('automations').add({
                ...payload,
                workspaceIds: data.workspaceIds || ['onboarding'],
                createdAt: timestamp,
                isActive: false
            });
            revalidatePath('/admin/automations');
            return { success: true, id: docRef.id };
        }
    } catch (e: any) {
        console.error(">>> [AUTO:SAVE] FAILED:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Purges an automation blueprint and its history from the registry.
 */
export async function deleteAutomationAction(id: string) {
    try {
        await adminDb.collection('automations').doc(id).delete();
        revalidatePath('/admin/automations');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Toggles the operational status of an automation flow.
 */
export async function toggleAutomationStatusAction(id: string, active: boolean) {
    try {
        await adminDb.collection('automations').doc(id).update({ isActive: active });
        revalidatePath('/admin/automations');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}