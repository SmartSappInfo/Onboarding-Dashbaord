import { adminDb } from '../../firebase-admin';
import { createDeal, updateDealStageAction, updateDealValueAction, updateDealStatusAction } from '../../../app/actions/deal-actions';
import type { ExecutionContext } from '../execution-types';
import { FieldsVariablesService } from '../../services/fields-variables-service-impl';

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
 * Resolves the target deal ID for a given automation context.
 * Prioritizes dealId in trigger payload, falling back to the active open deal of the entity.
 */
async function resolveTargetDealId(config: DealAutomationActionConfig, context: ExecutionContext): Promise<string | null> {
    if (context.payload && context.payload.dealId) {
        return context.payload.dealId as string;
    }
    
    if (!context.entityId) return null;
    
    const { resolveWorkspaceGuid } = await import('../workspace-resolver');
    const { workspaceId: targetWorkspaceId } = await resolveWorkspaceGuid(config.workspaceId || context.workspaceId);
    let query = adminDb.collection('deals')
        .where('entityId', '==', context.entityId)
        .where('workspaceId', '==', targetWorkspaceId)
        .where('status', '==', 'open');
        
    if (config.pipelineId) {
        query = query.where('pipelineId', '==', config.pipelineId);
    }
    
    const snap = await query.orderBy('updatedAt', 'desc').limit(1).get();
    if (!snap.empty) {
        return snap.docs[0].id;
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
            const { linkEntityToWorkspaceAction } = await import('../../workspace-entity-actions');
            const linkResult = await linkEntityToWorkspaceAction({
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
    
    const result = await createDeal({
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
    
    const dealId = await resolveTargetDealId(config, context);
    if (!dealId) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for stage update.");
        return;
    }
    
    // Loop / Recursion protection: check if deal is already at that stage
    const dealSnap = await adminDb.collection('deals').doc(dealId).get();
    if (dealSnap.exists && dealSnap.data()?.stageId === config.stageId) {
        console.log(`>>> [DEAL:AUTO] Stage is already "${config.stageId}". Skipping to prevent loop.`);
        return;
    }
    
    const result = await updateDealStageAction(dealId, config.stageId);
    if (!result.success) throw new Error(result.error);
}

/**
 * Automation Handler: UPDATE_DEAL_VALUE
 */
export async function handleUpdateDealValue(config: DealAutomationActionConfig, context: ExecutionContext) {
    if (config.value === undefined || config.value === null) {
        throw new Error("Value is required for update deal value action");
    }
    
    const dealId = await resolveTargetDealId(config, context);
    if (!dealId) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for value update.");
        return;
    }
    
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
    
    const result = await updateDealValueAction(dealId, targetValue);
    if (!result.success) throw new Error(result.error);
}

/**
 * Automation Handler: UPDATE_DEAL_STATUS
 */
export async function handleUpdateDealStatus(config: DealAutomationActionConfig, context: ExecutionContext) {
    if (!config.status) throw new Error("Status is required for update deal status action");
    
    const dealId = await resolveTargetDealId(config, context);
    if (!dealId) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for status update.");
        return;
    }
    
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
    
    const result = await updateDealStatusAction(dealId, status);
    if (!result.success) throw new Error(result.error);
}

/**
 * Automation Handler: ASSIGN_DEAL_OWNER
 */
export async function handleAssignDealOwner(config: DealAutomationActionConfig & { userId?: string; userName?: string; userEmail?: string }, context: ExecutionContext) {
    const dealId = await resolveTargetDealId(config, context);
    if (!dealId) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for owner assignment.");
        return;
    }

    const { updateDealOwnerAction } = await import('../../../app/actions/deal-actions');
    
    let targetUserId = config.userId || null;
    let targetUserName = config.userName || null;
    let targetUserEmail = config.userEmail || null;

    // Handle round-robin if specified
    if (config.assignmentStrategy === 'round-robin' && Array.isArray(config.eligibleUserIds) && config.eligibleUserIds.length > 0) {
        const randomIndex = Math.floor(Math.random() * config.eligibleUserIds.length);
        targetUserId = config.eligibleUserIds[randomIndex];
    }

    const result = await updateDealOwnerAction(dealId, targetUserId, targetUserName, targetUserEmail);
    if (!result.success) throw new Error(result.error);
}

/**
 * Automation Handler: UPDATE_DEAL_PROBABILITY
 */
export async function handleUpdateDealProbability(config: DealAutomationActionConfig & { probability?: number }, context: ExecutionContext) {
    if (config.probability === undefined || config.probability === null) {
        throw new Error("Probability is required for update deal probability action");
    }

    const dealId = await resolveTargetDealId(config, context);
    if (!dealId) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for probability update.");
        return;
    }

    const probability = Math.max(0, Math.min(100, Number(config.probability)));
    const dealRef = adminDb.collection('deals').doc(dealId);
    
    await dealRef.update({
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

    const dealId = await resolveTargetDealId(config as DealAutomationActionConfig, context);
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

    const dealId = await resolveTargetDealId(config as DealAutomationActionConfig, context);
    if (!dealId) {
        console.warn(">>> [DEAL:AUTO] No target deal resolved for adding deal note.");
        return;
    }

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


