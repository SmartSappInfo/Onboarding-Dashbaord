
'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { Pipeline, IndustryVertical } from './types';
import { canUser } from './workspace-permissions';
import { INDUSTRY_CONFIG } from './industry-config';

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

export async function deletePipelineAction(id: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const docSnap = await adminDb.collection('pipelines').doc(id).get();
        if (!docSnap.exists) throw new Error("Pipeline not found.");
        const workspaceId = docSnap.data()?.workspaceIds?.[0] || docSnap.data()?.workspaceId;
        if (!workspaceId) throw new Error("Pipeline document is corrupt: missing workspaceId.");

        // 0. Permission Check
        const permission = await canUser(userId, 'operations', 'pipeline', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        // Check for active leads (open deals) in this pipeline
        const activeDealsSnap = await adminDb.collection('deals')
            .where('pipelineId', '==', id)
            .where('status', '==', 'open')
            .limit(1)
            .get();

        if (!activeDealsSnap.empty) {
            return { success: false, error: 'Cannot delete pipeline with active leads.' };
        }

        // Fetch all stages and deals (closed) to delete
        const [stagesSnap, closedDealsSnap] = await Promise.all([
            adminDb.collection('onboardingStages').where('pipelineId', '==', id).get(),
            adminDb.collection('deals').where('pipelineId', '==', id).get()
        ]);

        const refsToDelete = [
            adminDb.collection('pipelines').doc(id),
            ...stagesSnap.docs.map(doc => doc.ref),
            ...closedDealsSnap.docs.map(doc => doc.ref)
        ];

        // Batch delete in chunks of 400
        const chunkSize = 400;
        for (let i = 0; i < refsToDelete.length; i += chunkSize) {
            const chunk = refsToDelete.slice(i, i + chunkSize);
            const batch = adminDb.batch();
            chunk.forEach(ref => {
                batch.delete(ref);
            });
            await batch.commit();
        }

        revalidatePath('/admin/pipeline');
        return { success: true };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, error };
    }
}

/**
 * Archives or restores a pipeline blueprint.
 */
export async function archivePipelineAction(id: string, isArchived: boolean, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const docSnap = await adminDb.collection('pipelines').doc(id).get();
        if (!docSnap.exists) throw new Error("Pipeline not found.");
        const workspaceId = docSnap.data()?.workspaceIds?.[0] || docSnap.data()?.workspaceId;
        if (!workspaceId) throw new Error("Pipeline document is corrupt: missing workspaceId.");

        // 0. Permission Check (Archive maps to edit permission)
        const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        await adminDb.collection('pipelines').doc(id).update({
            isArchived,
            updatedAt: new Date().toISOString()
        });
        
        revalidatePath('/admin/pipeline');
        return { success: true };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, error };
    }
}

/**
 * Creates a default pipeline for a workspace based on its industry vertical.
 * Uses the pipeline template from INDUSTRY_CONFIG for the specified industry.
 * 
 * This function is automatically called when a new workspace is created.
 * 
 * @param workspaceId - The workspace ID to create the pipeline for
 * @param industry - The industry vertical (SaaS, SchoolEnrollment, Law, Marketing, RealEstate, Consultancy)
 * @returns Promise with success status and pipeline ID
 * 
 * Requirements: 14.1–14.10
 */
export async function createDefaultPipelineForIndustry(
    workspaceId: string,
    industry: IndustryVertical
): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const db = adminDb;
        const timestamp = new Date().toISOString();

        // Get the pipeline template for this industry
        const industryContext = INDUSTRY_CONFIG[industry];
        if (!industryContext) {
            throw new Error(`Invalid industry vertical: ${industry}`);
        }

        const template = industryContext.pipelineTemplate;

        // Create stage documents first
        const stageIds: string[] = [];
        const stagePromises = template.stages.map(async (stageName, index) => {
            const stageRef = db.collection('stages').doc();
            const stageId = stageRef.id;
            stageIds.push(stageId);

            await stageRef.set({
                id: stageId,
                name: stageName,
                order: index + 1,
                color: getStageColor(index),
                createdAt: timestamp,
                updatedAt: timestamp
            });

            return stageId;
        });

        await Promise.all(stagePromises);

        // Create the pipeline document
        const pipelineRef = db.collection('pipelines').doc();
        const pipelineId = pipelineRef.id;

        await pipelineRef.set({
            id: pipelineId,
            name: template.name,
            description: `Default ${industry} pipeline`,
            workspaceIds: [workspaceId],
            stageIds,
            accessRoles: [],
            isDefault: true,
            createdAt: timestamp,
            updatedAt: timestamp
        });

        return { success: true, id: pipelineId };
    } catch (e: any) {
        console.error(`>>> [PIPELINE:CREATE_DEFAULT] Failed for industry ${industry}:`, e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Helper function to assign colors to pipeline stages based on their order.
 * Provides a consistent color scheme across all industry pipelines.
 */
function getStageColor(index: number): string {
    const colors = [
        '#6B7280', // gray - initial stages (Lead, Enquiry, Intake)
        '#3B82F6', // blue - qualification stages (Trial, Application, Conflict Check)
        '#F59E0B', // amber - in-progress stages (Onboarding, Review, Planning)
        '#10B981', // green - active/success stages (Active, Accepted, Execution)
        '#8B5CF6', // purple - advanced stages (Renewal, Enrolled, Delivery)
        '#EF4444', // red - terminal stages (Churned, Closed, Outcome)
    ];
    return colors[index % colors.length];
}
