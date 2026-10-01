'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import { revalidatePath } from 'next/cache';
import type { EntityType } from './types';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';
import { type CreateEntityResult, EntityInputSchema, createEntityCore, lockWorkspaceScopeCore, updateEntityCore } from './crm/entity-core';


/**
 * @fileOverview Server actions for entity lifecycle management.
 * Handles polymorphic creation and track transitions.
 */

export async function convertToOnboardingAction(
    entityId: string, 
    targetPipelineId: string, 
    userId: string
) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

    try {
        const timestamp = new Date().toISOString();
        
        // This is a bridge function. Depending on the migration state, it targets entity records.
        // For now, looking up via workspace_entities.
        const weSnap = await adminDb.collection('workspace_entities')
            .where('entityId', '==', entityId)
            .limit(1)
            .get();

        if (weSnap.empty) {
            throw new Error("Workspace entity record not found.");
        }

        const we = weSnap.docs[0];
        const weData = we.data();

        // 1. Resolve target pipeline's initial stage
        const stagesSnap = await adminDb.collection('onboardingStages')
            .where('pipelineId', '==', targetPipelineId)
            .orderBy('order', 'asc')
            .limit(1)
            .get();

        if (stagesSnap.empty) throw new Error("Target pipeline has no defined stages.");
        const firstStage = stagesSnap.docs[0].data();

        // 2. Execute Track Transition
        await we.ref.update({
            pipelineId: targetPipelineId,
            stageId: stagesSnap.docs[0].id,
            currentStageName: firstStage.name,
            updatedAt: timestamp
        });

        // 3. Log Conversion Success
        await logActivity({
            entityId: entityId,
            entityType: weData.entityType as EntityType,
            displayName: weData.displayName,
            organizationId: weData.organizationId || 'default',
            userId,
            workspaceId: weData.workspaceId,
            type: 'pipeline_stage_changed',
            source: 'user_action',
            description: `successfully converted "${weData.displayName}" to a new pipeline.`,
            metadata: { 
                conversionDate: timestamp, 
                targetPipeline: targetPipelineId,
            }
        });

        revalidatePath('/admin/entities');
        revalidatePath('/admin/pipeline');
        revalidatePath(`/admin/entities/${entityId}`);

        return { success: true };
    } catch (e: unknown) {
        console.error(">>> [ENTITY:CONVERT] Failed:", getErrorMessage(e));
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Locks the industry scope on a workspace after the first entity is linked.
 *
 * Sets `industryScopeLocked: true` and `industryScopeLockedAt` on the workspace
 * document, invalidates the industry cache, and logs a `workspace_scope_locked`
 * activity.
 *
 * Requirements: 1.4, 2.2, 2.3, 2.6
 */
export async function lockWorkspaceScope(
  workspaceId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  await lockWorkspaceScopeCore(workspaceId, organizationId, userId);
}

/*
 * SECURITY (agents_mcp PR-1 / N1): entity create/update live in `src/lib/crm/entity-core.ts`.
 * These Server Actions are public endpoints: identity comes from the session, the payload is
 * validated with `EntityInputSchema`, and the organization comes from the workspace. Server code
 * (automations, call centre, forms, surveys, imports, API routes) calls the core directly.
 */

/** Creates a new entity in `workspaceId` as the signed-in user (operations/campuses:create). */
export async function createEntityAction(params: {
  data: unknown;
  workspaceId: string;
  entityType: EntityType;
  forceCreate?: boolean;
}): Promise<CreateEntityResult> {
  const { uid } = await requireWorkspace(params.workspaceId);
  const parsed = EntityInputSchema.safeParse(params.data);
  if (!parsed.success) return { success: false, error: 'Invalid entity details.' };
  return createEntityCore({ kind: 'user', uid }, { ...params, data: parsed.data });
}

/** Updates an entity linked to `workspaceId` as the signed-in user (operations/campuses:edit). */
export async function updateEntityAction(params: {
  entityId: string;
  data: unknown;
  workspaceId: string;
}) {
  const { uid } = await requireWorkspace(params.workspaceId);
  const parsed = EntityInputSchema.safeParse(params.data);
  if (!parsed.success) return { success: false, error: 'Invalid entity details.' };
  return updateEntityCore({ kind: 'user', uid }, { ...params, data: parsed.data });
}
