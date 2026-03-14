
'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { Automation, AutomationRun } from './types';

/**
 * @fileOverview Server-side actions for the Automation Engine.
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
            const docRef = await adminDb.collection('automations').add({
                ...payload,
                createdAt: timestamp,
                isActive: false
            });
            revalidatePath('/admin/automations');
            return { success: true, id: docRef.id };
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteAutomationAction(id: string) {
    try {
        await adminDb.collection('automations').doc(id).delete();
        revalidatePath('/admin/automations');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function toggleAutomationStatusAction(id: string, active: boolean) {
    try {
        await adminDb.collection('automations').doc(id).update({ isActive: active });
        revalidatePath('/admin/automations');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function logAutomationRunAction(automationId: string, name: string, triggerData: any) {
    try {
        const docRef = await adminDb.collection('automation_runs').add({
            automationId,
            automationName: name,
            triggerData,
            status: 'running',
            startedAt: new Date().toISOString()
        });
        return { success: true, runId: docRef.id };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateAutomationRunStatusAction(runId: string, status: 'completed' | 'failed', error?: string) {
    try {
        await adminDb.collection('automation_runs').doc(runId).update({
            status,
            finishedAt: new Date().toISOString(),
            error
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
