import { adminDb } from '../../firebase-admin';
import { createDeal, updateDealStageAction, updateDealValueAction, updateDealStatusAction } from '../../../app/actions/deal-actions';
import type { ExecutionContext } from '../execution-types';

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
    
    const targetWorkspaceId = config.workspaceId || context.workspaceId;
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
 */
export async function handleCreateDeal(config: DealAutomationActionConfig, context: ExecutionContext) {
    if (!context.entityId) throw new Error("Entity context missing for deal creation");
    
    const targetWorkspaceId = config.workspaceId || context.workspaceId;

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
    
    // Resolve dynamic variables in title
    let dealName = config.name || "{{entityName}} Deal";
    if (dealName.includes('{{') && context.payload) {
        dealName = dealName.replace(/\{\{(.*?)\}\}/g, (match: string, key: string) => {
            const cleanKey = key.trim();
            return context.payload[cleanKey] !== undefined ? String(context.payload[cleanKey]) : match;
        });
    }
    
    if (dealName.includes('{{entityName}}')) {
        const { resolveContact } = await import('../../contact-adapter');
        const contact = await resolveContact(context.entityId, context.workspaceId);
        dealName = dealName.replace('{{entityName}}', contact?.name || 'Contact');
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

