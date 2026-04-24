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
 * Task 15.3: Validates that referenced templates exist and are approved.
 */
export async function saveAutomationAction(id: string | null, data: Partial<Automation>, userId: string) {
    try {
        // Task 15.3: Validate templates before saving
        await validateAutomationTemplates(data);

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
 * Task 15.3: Validates that all templates referenced in automation actions exist and are approved.
 */
async function validateAutomationTemplates(automation: Partial<Automation>): Promise<void> {
    if (!automation.nodes) return;

    const actionNodes = automation.nodes.filter((node: any) => node.type === 'actionNode');
    
    for (const node of actionNodes) {
        const actionType = node.data?.actionType;
        const config = node.data?.config || {};

        if (actionType === 'SEND_MESSAGE') {
            // Validate legacy templateId if present
            if (config.templateId) {
                const templateSnap = await adminDb
                    .collection('message_templates')
                    .doc(config.templateId)
                    .get();

                if (!templateSnap.exists) {
                    throw new Error(`Template ${config.templateId} not found in node "${node.data?.label || node.id}"`);
                }

                const template = templateSnap.data();
                if (template?.status !== 'approved') {
                    throw new Error(`Template "${template?.name || config.templateId}" is not approved (status: ${template?.status}) in node "${node.data?.label || node.id}"`);
                }
            }

            // Validate category/type if present
            if (config.templateCategory && config.templateType) {
                // Check if at least one approved template exists for this category/type
                const templatesSnap = await adminDb
                    .collection('message_templates')
                    .where('category', '==', config.templateCategory)
                    .where('templateType', '==', config.templateType)
                    .where('status', '==', 'approved')
                    .where('isActive', '==', true)
                    .limit(1)
                    .get();

                if (templatesSnap.empty) {
                    throw new Error(`No approved template found for category "${config.templateCategory}" and type "${config.templateType}" in node "${node.data?.label || node.id}"`);
                }
            }

            // Ensure at least one template reference method is provided
            if (!config.templateId && (!config.templateCategory || !config.templateType)) {
                throw new Error(`Send message action in node "${node.data?.label || node.id}" must specify either templateId or both templateCategory and templateType`);
            }
        }
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