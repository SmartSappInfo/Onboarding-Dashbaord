import { adminDb } from '../../firebase-admin';
import {
    type CrmActor,
    createDealCore,
    loadAuthorizedDeal,
    updateDealOwnerCore,
    updateDealStageCore,
    updateDealStatusCore,
    updateDealValueCore,
} from '../../crm/deal-core';
import type { ExecutionContext } from '../execution-types';
import { FieldsVariablesService } from '../../services/fields-variables-service-impl';
import { transferDealCore } from '../../deals/deal-transfer-core';
import type { TransferDealAutomationConfig } from '../../types';

export interface DealAutomationActionConfig {
    workspaceId?: string;
    pipelineId?: string;
    stageId?: string;
    name?: string;
    value?: string | number;
    status?: 'open' | 'won' | 'lost';
    assignmentStrategy?: 'direct' | 'round-robin' | 'value-based' | 'unassigned';
    eligibleUserIds?: string[];
}

/**
 * The automation engine acts on deals as a trusted service, pinned to one workspace: the deal
 * core refuses any deal stored outside it (agents_mcp PR-1 / N1). A `dealId` in the trigger
 * payload can therefore never reach another tenant's deal.
 */
function automationActor(workspaceId: string): CrmActor {
    return { kind: 'service', service: 'automations', workspaceId };
}

/**
 * Resolves the target deal ID for a given automation context, and the workspace the automation
 * acts in. Prioritizes dealId in trigger payload, falling back to the active open deal of the entity.
 */
async function resolveTargetDeal(
    config: DealAutomationActionConfig,
    context: ExecutionContext
): Promise<{ dealId: string; actor: CrmActor } | null> {
    const { resolveWorkspaceGuid } = await import('../workspace-resolver');
    const { workspaceId: targetWorkspaceId } = await resolveWorkspaceGuid(config.workspaceId || context.workspaceId);
    const actor = automationActor(targetWorkspaceId);

    if (context.payload && typeof context.payload.dealId === 'string' && context.payload.dealId) {
        return { dealId: context.payload.dealId, actor };
    }
    
    if (!context.entityId) return null;
    
    let query = adminDb.collection('deals')
        .where('entityId', '==', context.entityId)
        .where('workspaceId', '==', targetWorkspaceId)
        .where('status', '==', 'open');
        
    if (config.pipelineId) {
        query = query.where('pipelineId', '==', config.pipelineId);
    }
    
    const snap = await query.orderBy('updatedAt', 'desc').limit(1).get();
    if (!snap.empty) {
        return { dealId: snap.docs[0].id, actor };
    }
    
    return null;
}

/**
 * Automation Handler: CREATE_DEAL
 * 
 * SECURITY BOUNDARY:
 * Resolves the canonical target Workspace GUID via `resolveWorkspaceGuid` to ensure deal entity links,
 * pipeline queries, and template variable replacements strictly use valid Workspace GUIDs.
 */
export async function handleCreateDeal(config: DealAutomationActionConfig, context: ExecutionContext) {
    if (!context.entityId) throw new Error("Entity context missing for deal creation");
    
    const { resolveWorkspaceGuid } = await import('../workspace-resolver');
    const { workspaceId: targetWorkspaceId } = await resolveWorkspaceGuid(config.workspaceId || context.workspaceId);

    // Auto-link entity to target workspace if needed
    if (targetWorkspaceId !== context.workspaceId) {
        const entityLinkRef = adminDb.collection('workspace_entities').doc(`${targetWorkspaceId}_${context.entityId}`);
        const entityLinkSnap = await entityLinkRef.get();
        if (!entityLinkSnap.exists) {
            const { linkEntityToWorkspaceCore } = await import('../../crm/workspace-entity-core');
            const linkResult = await linkEntityToWorkspaceCore(automationActor(targetWorkspaceId), {
                entityId: context.entityId,
                workspaceId: targetWorkspaceId,
                userId: 'system-automation',
                userName: 'Automation Engine',
                userEmail: 'automation@smartsapp.com'
            });
            if (!linkResult.success) {
                throw new Error(`Failed to automatically link entity to target workspace ${targetWorkspaceId}: ${linkResult.error}`);
            }
        }
    }
    
    let pipelineId = config.pipelineId;
    if (!pipelineId) {
        const pipelinesSnap = await adminDb.collection('pipelines')
            .where('workspaceIds', 'array-contains', targetWorkspaceId)
            .limit(1)
            .get();
        if (!pipelinesSnap.empty) {
            pipelineId = pipelinesSnap.docs[0].id;
        } else {
            throw new Error("No pipeline found in workspace to create a deal.");
        }
    }
    
    // Resolve dynamic variables in title (default to clean entity name)
    let dealName = config.name || "{{entity_name}}";
    if (dealName.includes('{{entityName}}')) {
        dealName = dealName.replace('{{entityName}}', '{{entity_name}}');
    }
    
    if (dealName.includes('{{')) {
        dealName = await FieldsVariablesService.resolveTemplateVariables(dealName, {
            workspaceId: targetWorkspaceId,
            entityId: context.entityId,
            extraVars: context.payload as Record<string, string | number | boolean | undefined | null>
        });
    }

    // ARCHITECTURAL POINTER:
    // Strip any legacy 'Deal for ' / 'Deal For ' prefix from automated deal titles
    if (/^deal\s+for\s+/i.test(dealName.trim())) {
        dealName = dealName.trim().replace(/^deal\s+for\s+/i, '').trim();
    }

    const value = config.value ? Number(config.value) : 0;
    
    const result = await createDealCore(automationActor(targetWorkspaceId), {
        entityId: context.entityId,
        workspaceId: targetWorkspaceId,
        organizationId: context.organizationId || 'default',
        pipelineId,
        stageId: config.stageId || undefined,
        name: dealName,
        value,
        assignmentStrategy: config.assignmentStrategy || 'direct',
        eligibleUserIds: config.eligibleUserIds || []
    });
    
    if (result.error) throw new Error(result.error);
    return result;
}

/**
 * Automation Handler: UPDATE_DEAL_STAGE
 */
export async function handleUpdateDealStage(config: DealAutomationActionConfig, context: ExecutionContext) {
    if (!config.stageId) throw new Error("Target stageId is required for update deal stage action");
    
    const target = await resolveTargetDeal(config, context);
    if (!target) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for stage update.");
        return;
    }
    const { dealId, actor } = target;
    
    // Loop / Recursion protection: check if deal is already at that stage
    const dealSnap = await adminDb.collection('deals').doc(dealId).get();
    if (dealSnap.exists && dealSnap.data()?.stageId === config.stageId) {
        console.log(`>>> [DEAL:AUTO] Stage is already "${config.stageId}". Skipping to prevent loop.`);
        return;
    }
    
    const result = await updateDealStageCore(actor, dealId, config.stageId);
    if (!result.success) throw new Error(result.error);
}

/**
 * Automation Handler: UPDATE_DEAL_VALUE
 */
export async function handleUpdateDealValue(config: DealAutomationActionConfig, context: ExecutionContext) {
    if (config.value === undefined || config.value === null) {
        throw new Error("Value is required for update deal value action");
    }
    
    const target = await resolveTargetDeal(config, context);
    if (!target) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for value update.");
        return;
    }
    const { dealId, actor } = target;
    
    let targetValue = 0;
    const valueStr = String(config.value).trim();
    
    if (valueStr.startsWith('+') || valueStr.startsWith('-')) {
        // Relative adjustment
        const dealSnap = await adminDb.collection('deals').doc(dealId).get();
        const currentVal = dealSnap.exists ? Number(dealSnap.data()?.value || 0) : 0;
        const delta = Number(valueStr);
        targetValue = currentVal + delta;
    } else {
        // Absolute adjustment
        targetValue = Number(valueStr);
    }
    
    const result = await updateDealValueCore(actor, dealId, targetValue);
    if (!result.success) throw new Error(result.error);
}

/**
 * Automation Handler: UPDATE_DEAL_STATUS
 */
export async function handleUpdateDealStatus(config: DealAutomationActionConfig, context: ExecutionContext) {
    if (!config.status) throw new Error("Status is required for update deal status action");
    
    const target = await resolveTargetDeal(config, context);
    if (!target) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for status update.");
        return;
    }
    const { dealId, actor } = target;
    
    const status = config.status as 'open' | 'won' | 'lost';
    if (!['open', 'won', 'lost'].includes(status)) {
        throw new Error(`Invalid status: ${status}`);
    }
    
    // Loop / Recursion protection: check if deal is already at that status
    const dealSnap = await adminDb.collection('deals').doc(dealId).get();
    if (dealSnap.exists && dealSnap.data()?.status === status) {
        console.log(`>>> [DEAL:AUTO] Status is already "${status}". Skipping to prevent loop.`);
        return;
    }
    
    const result = await updateDealStatusCore(actor, dealId, status);
    if (!result.success) throw new Error(result.error);
}

/**
 * Automation Handler: ASSIGN_DEAL_OWNER
 */
export async function handleAssignDealOwner(config: DealAutomationActionConfig & { userId?: string; userName?: string; userEmail?: string }, context: ExecutionContext) {
    const target = await resolveTargetDeal(config, context);
    if (!target) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for owner assignment.");
        return;
    }
    const { dealId, actor } = target;

    let targetUserId = config.userId || null;
    let targetUserName = config.userName || null;
    let targetUserEmail = config.userEmail || null;

    // Handle round-robin if specified
    if (config.assignmentStrategy === 'round-robin' && Array.isArray(config.eligibleUserIds) && config.eligibleUserIds.length > 0) {
        const randomIndex = Math.floor(Math.random() * config.eligibleUserIds.length);
        targetUserId = config.eligibleUserIds[randomIndex];
    }

    const result = await updateDealOwnerCore(actor, dealId, targetUserId, targetUserName, targetUserEmail);
    if (!result.success) throw new Error(result.error);
}

/**
 * Automation Handler: UPDATE_DEAL_PROBABILITY
 */
export async function handleUpdateDealProbability(config: DealAutomationActionConfig & { probability?: number }, context: ExecutionContext) {
    if (config.probability === undefined || config.probability === null) {
        throw new Error("Probability is required for update deal probability action");
    }

    const target = await resolveTargetDeal(config, context);
    if (!target) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for probability update.");
        return;
    }
    const { dealId, actor } = target;

    // The deal must live in the automation's workspace (a payload dealId is not trusted).
    const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
    if (!loaded.ok) throw new Error(loaded.error);

    const probability = Math.max(0, Math.min(100, Number(config.probability)));
    await loaded.ref.update({
        probability,
        isProbabilityManual: true,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Automation Handler: CREATE_DEAL_TASK
 */
export async function handleCreateDealTask(config: { title?: string; description?: string; dueDate?: string; priority?: string; assigneeId?: string; workspaceId?: string }, context: ExecutionContext) {
    if (!config.title) throw new Error("Task title is required");

    const target = await resolveTargetDeal(config as DealAutomationActionConfig, context);
    // Link the task to the deal only when that deal lives in the automation's workspace.
    const linked = target ? await loadAuthorizedDeal(target.actor, target.dealId, 'edit') : null;
    const dealId = target && linked?.ok ? target.dealId : null;
    const { resolveWorkspaceGuid } = await import('../workspace-resolver');
    const { workspaceId: targetWorkspaceId } = await resolveWorkspaceGuid(config.workspaceId || context.workspaceId);

    let taskTitle = config.title;
    if (taskTitle.includes('{{')) {
        taskTitle = await FieldsVariablesService.resolveTemplateVariables(taskTitle, {
            workspaceId: targetWorkspaceId,
            entityId: context.entityId,
            extraVars: context.payload as Record<string, string | number | boolean | undefined | null>,
        });
    }

    const taskRef = adminDb.collection('tasks').doc();
    await taskRef.set({
        id: taskRef.id,
        workspaceId: targetWorkspaceId,
        organizationId: context.organizationId || 'default',
        entityId: context.entityId || null,
        dealId: dealId || null,
        title: taskTitle,
        description: config.description || '',
        status: 'pending',
        priority: config.priority || 'medium',
        dueDate: config.dueDate || null,
        assignedToId: config.assigneeId || null,
        createdBy: 'automation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Automation Handler: ADD_DEAL_NOTE
 */
export async function handleAddDealNote(config: { content?: string; workspaceId?: string }, context: ExecutionContext) {
    if (!config.content) throw new Error("Note content is required");

    const target = await resolveTargetDeal(config as DealAutomationActionConfig, context);
    if (!target) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for adding deal note.");
        return;
    }
    const { dealId, actor } = target;
    const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
    if (!loaded.ok) throw new Error(loaded.error);

    const { resolveWorkspaceGuid } = await import('../workspace-resolver');
    const { workspaceId: targetWorkspaceId } = await resolveWorkspaceGuid(config.workspaceId || context.workspaceId);

    let content = config.content;
    if (content.includes('{{')) {
        content = await FieldsVariablesService.resolveTemplateVariables(content, {
            workspaceId: targetWorkspaceId,
            entityId: context.entityId,
            extraVars: context.payload as Record<string, string | number | boolean | undefined | null>,
        });
    }

    const noteRef = adminDb.collection('deal_notes').doc();
    await noteRef.set({
        id: noteRef.id,
        dealId,
        workspaceId: targetWorkspaceId,
        organizationId: context.organizationId || 'default',
        entityId: context.entityId || null,
        content,
        authorName: 'Automation Engine',
        authorEmail: 'automation@smartsapp.com',
        authorId: 'system-automation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Automation Handler: TRANSFER_DEAL
 * 
 * Transfers or duplicates an active deal across workspaces, pipelines, and stages.
 * 
 * RESOLUTION FLOW:
 * 1. Checks if context.payload.dealId is present and matches source filters.
 * 2. Fallback: queries open deal for context.entityId in the effective source workspace matching filters.
 * 3. Graceful bypass: If no qualifying deal is found, returns { success: true, skipped: true, reason: 'no_qualifying_deal_found' }.
 * 4. Identical placement guard: If moving and deal is already at target, returns { success: true, skipped: true, reason: 'already_at_destination' }.
 * 5. Resolves assignee strategy ('preserve_or_unassigned', 'specific_user', 'unassigned').
 * 6. Interpolates double-brace template variables in newName and summary via FieldsVariablesService.
 * 7. Calls canonical `transferDealCore(actor, transferInput)` with idempotency key.
 */
export async function handleTransferDeal(
    rawConfig: Partial<TransferDealAutomationConfig> | Record<string, unknown>,
    context: ExecutionContext
): Promise<{
    success: boolean;
    dealId?: string;
    mode?: 'move' | 'copy';
    targetWorkspaceId?: string;
    targetPipelineId?: string;
    targetStageId?: string;
    skipped?: boolean;
    reason?: string;
    message?: string;
}> {
    const config: TransferDealAutomationConfig = {
        mode: (rawConfig.mode as 'move' | 'copy') || 'move',
        sourceWorkspaceId: rawConfig.sourceWorkspaceId as string | undefined,
        sourcePipelineId: rawConfig.sourcePipelineId as string | undefined,
        sourceStageId: rawConfig.sourceStageId as string | undefined,
        targetWorkspaceId: String(rawConfig.targetWorkspaceId || context.workspaceId),
        targetWorkspaceName: rawConfig.targetWorkspaceName as string | undefined,
        targetPipelineId: String(rawConfig.targetPipelineId || ''),
        targetPipelineName: rawConfig.targetPipelineName as string | undefined,
        targetStageId: String(rawConfig.targetStageId || ''),
        targetStageName: rawConfig.targetStageName as string | undefined,
        assignmentMode: (rawConfig.assignmentMode as 'preserve_or_unassigned' | 'specific_user' | 'unassigned') || 'preserve_or_unassigned',
        targetUserId: rawConfig.targetUserId as string | null | undefined,
        targetUserName: rawConfig.targetUserName as string | null | undefined,
        targetUserEmail: rawConfig.targetUserEmail as string | null | undefined,
        newName: rawConfig.newName as string | undefined,
        summary: rawConfig.summary as string | undefined,
        copyLineItems: rawConfig.copyLineItems !== false,
        copyContacts: rawConfig.copyContacts !== false,
        copyCustomFields: rawConfig.copyCustomFields !== false,
    };

    const { resolveWorkspaceGuid } = await import('../workspace-resolver');
    
    // Determine effective source workspace
    const rawSourceWs = (!config.sourceWorkspaceId || config.sourceWorkspaceId === '__current__')
        ? context.workspaceId
        : config.sourceWorkspaceId;
    const { workspaceId: effectiveSourceWorkspaceId } = await resolveWorkspaceGuid(rawSourceWs);
    
    // Determine effective target workspace
    const { workspaceId: effectiveTargetWorkspaceId } = await resolveWorkspaceGuid(config.targetWorkspaceId);

    // 1. Resolve source deal
    let qualifyingDealId: string | null = null;
    let qualifyingDealData: Record<string, unknown> | null = null;

    if (context.payload && typeof context.payload.dealId === 'string' && context.payload.dealId) {
        const dealSnap = await adminDb.collection('deals').doc(context.payload.dealId).get();
        if (dealSnap.exists) {
            const data = dealSnap.data() as Record<string, unknown> | undefined;
            const matchesWorkspace = !config.sourceWorkspaceId || config.sourceWorkspaceId === '__current__' || data?.workspaceId === effectiveSourceWorkspaceId;
            const matchesPipeline = !config.sourcePipelineId || config.sourcePipelineId === '__all__' || data?.pipelineId === config.sourcePipelineId;
            const matchesStage = !config.sourceStageId || config.sourceStageId === '__all__' || data?.stageId === config.sourceStageId;

            if (matchesWorkspace && matchesPipeline && matchesStage) {
                qualifyingDealId = dealSnap.id;
                qualifyingDealData = data || null;
            }
        }
    }

    if (!qualifyingDealId && context.entityId) {
        let query: FirebaseFirestore.Query = adminDb.collection('deals')
            .where('entityId', '==', context.entityId)
            .where('workspaceId', '==', effectiveSourceWorkspaceId)
            .where('status', '==', 'open');

        if (config.sourcePipelineId && config.sourcePipelineId !== '__all__') {
            query = query.where('pipelineId', '==', config.sourcePipelineId);
        }
        if (config.sourceStageId && config.sourceStageId !== '__all__') {
            query = query.where('stageId', '==', config.sourceStageId);
        }

        const snap = await query.orderBy('updatedAt', 'desc').limit(1).get();
        if (!snap.empty) {
            qualifyingDealId = snap.docs[0].id;
            qualifyingDealData = snap.docs[0].data() as Record<string, unknown>;
        }
    }

    // Graceful skip if no qualifying deal found
    if (!qualifyingDealId) {
        return {
            success: true,
            skipped: true,
            reason: 'no_qualifying_deal_found',
            message: 'No qualifying deal found matching the source workspace, pipeline, and stage filters.',
        };
    }

    // Infinite recursion guard: moving deal to identical location
    if (config.mode === 'move') {
        const isSameWorkspace = qualifyingDealData?.workspaceId === effectiveTargetWorkspaceId;
        const isSamePipeline = qualifyingDealData?.pipelineId === config.targetPipelineId;
        const isSameStage = qualifyingDealData?.stageId === config.targetStageId;

        if (isSameWorkspace && isSamePipeline && isSameStage) {
            return {
                success: true,
                skipped: true,
                reason: 'already_at_destination',
                message: 'Deal is already present in the target workspace, pipeline, and stage.',
            };
        }
    }

    // 2. Resolve Assignee Strategy
    let resolvedAssignee: { userId: string | null; name: string | null; email: string | null } | null | undefined = undefined;
    if (config.assignmentMode === 'specific_user') {
        resolvedAssignee = {
            userId: config.targetUserId || null,
            name: config.targetUserName || null,
            email: config.targetUserEmail || null,
        };
    } else if (config.assignmentMode === 'unassigned') {
        resolvedAssignee = null;
    } else {
        // 'preserve_or_unassigned' or undefined: undefined signals transferDealCore to preserve if staying in same workspace, else null
        resolvedAssignee = undefined;
    }

    // 3. Resolve Template Tokens in newName and summary (Rule: Fields & Variables Single Source of Truth)
    let resolvedNewName = config.newName;
    if (resolvedNewName && resolvedNewName.includes('{{')) {
        resolvedNewName = await FieldsVariablesService.resolveTemplateVariables(resolvedNewName, {
            workspaceId: effectiveTargetWorkspaceId,
            entityId: context.entityId,
            extraVars: {
                ...(context.payload as Record<string, string | number | boolean | undefined | null>),
                deal_name: String(qualifyingDealData?.name || ''),
                deal_id: qualifyingDealId,
            },
        });
    }

    let resolvedSummary = config.summary;
    if (resolvedSummary && resolvedSummary.includes('{{')) {
        resolvedSummary = await FieldsVariablesService.resolveTemplateVariables(resolvedSummary, {
            workspaceId: effectiveTargetWorkspaceId,
            entityId: context.entityId,
            extraVars: {
                ...(context.payload as Record<string, string | number | boolean | undefined | null>),
                deal_name: String(qualifyingDealData?.name || ''),
                deal_id: qualifyingDealId,
            },
        });
    }

    // 4. Idempotency Key (Rule 19 & 20)
    const idempotencyKey = context.runId ? `auto_${context.runId}_${context.stepId || qualifyingDealId}` : undefined;

    // 5. Construct Service Actor with Cross-Workspace Permission (Rule 16)
    const actor: CrmActor = {
        kind: 'service',
        service: 'automations',
        workspaceId: effectiveSourceWorkspaceId,
        allowedWorkspaceIds: [effectiveSourceWorkspaceId, effectiveTargetWorkspaceId],
        runId: context.runId,
    };

    // 6. Execute Transfer Core
    const result = await transferDealCore(actor, {
        dealId: qualifyingDealId,
        mode: config.mode,
        sourceWorkspaceId: effectiveSourceWorkspaceId,
        targetWorkspaceId: effectiveTargetWorkspaceId,
        targetPipelineId: config.targetPipelineId,
        targetStageId: config.targetStageId,
        assignedTo: resolvedAssignee,
        newName: resolvedNewName,
        summary: resolvedSummary,
        copyLineItems: config.copyLineItems !== false,
        copyContacts: config.copyContacts !== false,
        copyCustomFields: config.copyCustomFields !== false,
        idempotencyKey,
    });

    if (!result.success || !result.dealId) {
        throw new Error(result.error || 'Failed to transfer deal');
    }

    return {
        success: true,
        dealId: result.dealId,
        mode: config.mode,
        targetWorkspaceId: effectiveTargetWorkspaceId,
        targetPipelineId: config.targetPipelineId,
        targetStageId: config.targetStageId,
    };
}



