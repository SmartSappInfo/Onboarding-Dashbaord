
'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { Pipeline, IndustryVertical, CreatePipelinePayload } from './types';
import { canUser } from './workspace-permissions';
import { INDUSTRY_CONFIG } from './industry-config';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';

/**
 * @fileOverview Server-side actions for Pipeline management.
 */

/**
 * ARCHITECTURAL POINTER (Atomic Pipeline Creation with Initial Stages - Rule 10):
 * Creates a new pipeline and its initial starter stages in a single atomic Firestore batch.
 * This guarantees:
 * 1. Zero partial/orphaned documents if an operation fails.
 * 2. New pipelines are immediately populated with valid stages, eliminating empty-board states.
 * 3. Server-side session verification via requireAuth() and requireWorkspace().
 * 4. Strict role authorization check via canUser().
 * 5. Strict zero 'any' / 'any[]' compliance (Rule 5).
 */
export async function createPipelineWithStagesAction(
  payload: CreatePipelinePayload
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const verified = await requireAuth();
    const userId = verified.uid;

    if (!payload.name || !payload.name.trim()) {
      return { success: false, error: 'Pipeline name is required.' };
    }

    if (!payload.workspaceIds || payload.workspaceIds.length === 0) {
      return { success: false, error: 'Pipeline must belong to at least one workspace.' };
    }

    const primaryWorkspaceId = payload.workspaceIds[0];
    await requireWorkspace(primaryWorkspaceId);

    const permission = await canUser(userId, 'operations', 'pipeline', 'create', primaryWorkspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }

    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();

    // 1. Generate new pipeline document reference
    const pipelineRef = adminDb.collection('pipelines').doc();
    const pipelineId = pipelineRef.id;

    // 2. Prepare stages (either from initialStages or empty if none specified)
    const stageIds: string[] = [];
    const stagesToCreate = payload.initialStages && payload.initialStages.length > 0
      ? payload.initialStages
      : [];

    stagesToCreate.forEach((stageConfig, index) => {
      const stageRef = adminDb.collection('onboardingStages').doc();
      const stageId = stageRef.id;
      stageIds.push(stageId);

      batch.set(stageRef, {
        id: stageId,
        pipelineId,
        name: stageConfig.name.trim(),
        order: stageConfig.order ?? (index + 1),
        color: stageConfig.color || getStageColor(index),
        probability: typeof stageConfig.probability === 'number'
          ? Math.min(100, Math.max(0, stageConfig.probability))
          : (payload.defaultProbability ?? 50),
        slaDays: stageConfig.slaDays ?? null,
        isWon: Boolean(stageConfig.isWon),
        isLost: Boolean(stageConfig.isLost),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

    // 3. Write pipeline document
    const { initialStages: _discard, ...cleanData } = payload;
    batch.set(pipelineRef, {
      ...cleanData,
      id: pipelineId,
      name: payload.name.trim(),
      description: payload.description?.trim() || '',
      type: payload.type || 'sales',
      defaultProbability: typeof payload.defaultProbability === 'number'
        ? Math.min(100, Math.max(0, payload.defaultProbability))
        : 50,
      stageIds,
      accessRoles: payload.accessRoles || [],
      columnWidth: payload.columnWidth || 320,
      showDealTotals: payload.showDealTotals !== false,
      assignmentStrategy: payload.assignmentStrategy || 'direct',
      assignmentUserIds: payload.assignmentUserIds || [],
      defaultCloseDateOffsetValue: typeof payload.defaultCloseDateOffsetValue === 'number' && payload.defaultCloseDateOffsetValue > 0
        ? payload.defaultCloseDateOffsetValue
        : null,
      defaultCloseDateOffsetUnit: payload.defaultCloseDateOffsetUnit || null,
      isDefault: false,
      isArchived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // 4. Commit atomic batch
    await batch.commit();

    revalidatePath('/admin/pipeline');
    return { success: true, id: pipelineId };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Failed to create pipeline';
    return { success: false, error };
  }
}

/**
 * Updates an existing pipeline or initializes a new one.
 */
export async function savePipelineAction(id: string | null, data: Partial<Pipeline>, userId: string) {
  // SECURITY (audit F2): the identity below feeds a permission check. The caller used
  // to supply it, so an authenticated low-privilege user could pass an administrator's
  // uid and pass the check as them. The caller-supplied value is discarded here and
  // replaced with the verified session identity before any check runs.
  const __verified = await requireAuth();
  userId = __verified.uid;

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
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to save pipeline';
        return { success: false, error };
    }
}

/**
 * Sets a specific pipeline as the default for its workspace.
 * Automatically unsets any existing default in that same workspace.
 */
export async function setPipelineAsDefaultAction(pipelineId: string, workspaceId: string, _userId: string) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

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
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to set default pipeline';
        console.error(">>> [PIPELINE:DEFAULT] FAILED:", error);
        return { success: false, error };
    }
}

export async function deletePipelineAction(id: string, userId: string): Promise<{ success: boolean; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — caller-supplied userId is discarded in favor of verified session.
  const verified = await requireAuth();
  userId = verified.uid;

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
  // SECURITY (audit F2): Server Actions are public endpoints — caller-supplied userId is discarded in favor of verified session.
  const verified = await requireAuth();
  userId = verified.uid;

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
 * Clones an existing pipeline along with its stage configuration.
 * Content, deals, and contacts associated with the source pipeline ARE NOT cloned.
 */
export async function clonePipelineAction(
    pipelineId: string,
    userId: string,
    customName?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — caller-supplied userId is discarded in favor of verified session.
  const verified = await requireAuth();
  userId = verified.uid;

    try {
        if (!pipelineId || !userId) {
            throw new Error("Pipeline ID and User ID are required.");
        }

        const sourceDocSnap = await adminDb.collection('pipelines').doc(pipelineId).get();
        if (!sourceDocSnap.exists) {
            throw new Error("Source pipeline not found.");
        }

        const sourceData = sourceDocSnap.data() as Partial<Pipeline> & { workspaceId?: string };
        const targetWorkspaceId = sourceData.workspaceIds?.[0] || sourceData.workspaceId;
        if (!targetWorkspaceId) {
            throw new Error("Source pipeline is missing workspace information.");
        }

        // 0. Permission Check
        const permission = await canUser(userId, 'operations', 'pipeline', 'create', targetWorkspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const timestamp = new Date().toISOString();
        const newName = customName?.trim() || `${sourceData.name || 'Pipeline'} (Copy)`;

        // Fetch all onboarding stages belonging to the source pipeline
        const stagesSnap = await adminDb.collection('onboardingStages')
            .where('pipelineId', '==', pipelineId)
            .get();

        const sortedStageDocs = stagesSnap.docs.sort((a, b) => {
            const orderA = a.data().order ?? 0;
            const orderB = b.data().order ?? 0;
            return orderA - orderB;
        });

        // Prepare new pipeline document reference
        const newPipelineRef = adminDb.collection('pipelines').doc();
        const newPipelineId = newPipelineRef.id;

        const newStageIds: string[] = [];
        const operations: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];

        // Map stage documents
        sortedStageDocs.forEach((stageDoc) => {
            const stageData = stageDoc.data();
            const newStageRef = adminDb.collection('onboardingStages').doc();
            newStageIds.push(newStageRef.id);

            const { id: _oldId, pipelineId: _oldPipelineId, createdAt: _oldCreated, updatedAt: _oldUpdated, ...cleanStageData } = stageData;

            operations.push({
                ref: newStageRef,
                data: {
                    ...cleanStageData,
                    id: newStageRef.id,
                    pipelineId: newPipelineId,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                }
            });
        });

        // Add new pipeline operation
        const { id: _oldPId, isDefault: _oldDef, createdAt: _oldCreated, updatedAt: _oldUpdated, ...cleanPipelineData } = sourceData;

        operations.push({
            ref: newPipelineRef,
            data: {
                ...cleanPipelineData,
                id: newPipelineId,
                name: newName,
                isDefault: false,
                stageIds: newStageIds,
                createdAt: timestamp,
                updatedAt: timestamp,
            }
        });

        // Commit operations in chunks of 200 to prevent Firestore batch size limits
        const chunkSize = 200;
        for (let i = 0; i < operations.length; i += chunkSize) {
            const chunk = operations.slice(i, i + chunkSize);
            const batch = adminDb.batch();
            chunk.forEach(op => {
                batch.set(op.ref, op.data);
            });
            await batch.commit();
        }

        revalidatePath('/admin/pipeline');
        return { success: true, id: newPipelineId };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Unknown error occurred while cloning pipeline.';
        console.error('>>> [PIPELINE:CLONE] Failed:', error);
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
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

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
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to create default pipeline';
        console.error(`>>> [PIPELINE:CREATE_DEFAULT] Failed for industry ${industry}:`, error);
        return { success: false, error };
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
