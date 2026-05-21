'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Deal, WorkspaceEntity } from '@/lib/types';
import { logActivity } from '@/lib/activity-logger';

export type AssignmentStrategy = 'direct' | 'round-robin' | 'value-based' | 'unassigned';

interface DealCreationData extends Partial<Deal> {
    entityId: string;
    workspaceId: string;
    organizationId: string;
    pipelineId: string;
    name: string;
    value?: number;
    assignmentStrategy?: AssignmentStrategy;
    eligibleUserIds?: string[];
    suppressAutomations?: boolean;
}

export async function createDeal(data: DealCreationData): Promise<{ id?: string; error?: string }> {
    try {
        const { entityId, workspaceId, organizationId, pipelineId, name, value, assignmentStrategy = 'direct', eligibleUserIds = [], suppressAutomations = false, ...rest } = data;

        const entitySnap = await adminDb.collection('workspace_entities').doc(`${workspaceId}_${entityId}`).get();
        if (!entitySnap.exists) throw new Error('Entity not found');
        const entity = entitySnap.data() as WorkspaceEntity;

        let assignedTo = null;

        if (assignmentStrategy === 'direct') {
            assignedTo = entity.assignedTo || null;
        } else if (assignmentStrategy === 'round-robin' && eligibleUserIds.length > 0) {
            let minDeals = Infinity;
            let selectedUserId = eligibleUserIds[0];
            
            for (const uid of eligibleUserIds) {
                const snap = await adminDb.collection('deals').where('assignedTo.userId', '==', uid).where('status', '==', 'open').get();
                if (snap.size < minDeals) {
                    minDeals = snap.size;
                    selectedUserId = uid;
                }
            }
            assignedTo = { userId: selectedUserId, name: 'Assigned User', email: '' };
        } else if (assignmentStrategy === 'value-based' && eligibleUserIds.length > 0) {
            let minVal = Infinity;
            let selectedUserId = eligibleUserIds[0];
            
            for (const uid of eligibleUserIds) {
                const snap = await adminDb.collection('deals').where('assignedTo.userId', '==', uid).where('status', '==', 'open').get();
                let totalValue = 0;
                snap.forEach(doc => totalValue += (doc.data().value || 0));
                
                if (totalValue < minVal) {
                    minVal = totalValue;
                    selectedUserId = uid;
                }
            }
            assignedTo = { userId: selectedUserId, name: 'Assigned User', email: '' };
        }

        let stageId = data.stageId;
        let stageName = data.stageName;

        if (!stageId) {
            const stageSnap = await adminDb.collection('onboardingStages').where('pipelineId', '==', pipelineId).orderBy('order', 'asc').limit(1).get();
            stageId = stageSnap.empty ? 'default_stage' : stageSnap.docs[0].id;
            stageName = stageSnap.empty ? undefined : (stageSnap.docs[0].data().name as string | undefined);
        } else if (!stageName) {
            const stageDoc = await adminDb.collection('onboardingStages').doc(stageId).get();
            if (stageDoc.exists) {
                stageName = stageDoc.data()?.name as string | undefined;
            }
        }

        const newDeal: Omit<Deal, 'id'> = {
            organizationId,
            workspaceId,
            entityId,
            pipelineId,
            stageId,
            ...(stageName ? { stageName } : {}),
            name,
            value: value || 0,
            status: data.status || 'open',
            assignedTo: data.assignedTo !== undefined ? data.assignedTo : assignedTo,
            expectedCloseDate: rest.expectedCloseDate || null,
            description: rest.description || null,
            customFields: rest.customFields || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const docRef = await adminDb.collection('deals').add(newDeal);

        // Broadcast signal via Event Bus (respecting suppressAutomations)
        await logActivity({
            organizationId,
            entityId,
            userId: null,
            workspaceId,
            type: suppressAutomations ? 'deal_created_suppressed' : 'deal_created',
            source: 'system',
            description: suppressAutomations 
                ? `initialized a new deal: "${name}" (automations suppressed)`
                : `initialized a new deal: "${name}"`,
            metadata: { dealId: docRef.id, value: value || 0, pipelineId, stageId }
        });

        return { id: docRef.id };
    } catch (e: any) {
        console.error('Failed to create deal:', e);
        return { error: e.message };
    }
}

export async function updateDealStageAction(dealId: string, stageId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) throw new Error('Deal not found');
        const deal = dealSnap.data() as Deal;

        const stageSnap = await adminDb.collection('onboardingStages').doc(stageId).get();
        if (!stageSnap.exists) throw new Error('Stage not found');
        const stageName = stageSnap.data()?.name as string;

        const oldStageName = deal.stageName || deal.stageId;

        if (deal.stageId === stageId) {
            return { success: true }; // No change
        }

        const timestamp = new Date().toISOString();
        await dealRef.update({
            stageId,
            stageName,
            updatedAt: timestamp
        });

        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: null,
            workspaceId: deal.workspaceId,
            type: 'deal_stage_changed',
            source: 'system',
            description: `progressed deal "${deal.name}" from "${oldStageName}" to "${stageName}"`,
            metadata: { dealId, from: oldStageName, to: stageName, stageId, pipelineId: deal.pipelineId }
        });

        return { success: true };
    } catch (e: any) {
        console.error('Failed to update deal stage:', e);
        return { success: false, error: e.message };
    }
}

export async function updateDealValueAction(dealId: string, value: number): Promise<{ success: boolean; error?: string }> {
    try {
        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) throw new Error('Deal not found');
        const deal = dealSnap.data() as Deal;

        const oldVal = deal.value || 0;
        if (oldVal === value) return { success: true };

        const timestamp = new Date().toISOString();
        await dealRef.update({
            value,
            updatedAt: timestamp
        });

        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: null,
            workspaceId: deal.workspaceId,
            type: 'deal_value_changed',
            source: 'system',
            description: `updated deal "${deal.name}" value from $${oldVal} to $${value}`,
            metadata: { dealId, fromValue: oldVal, toValue: value }
        });

        return { success: true };
    } catch (e: any) {
        console.error('Failed to update deal value:', e);
        return { success: false, error: e.message };
    }
}

export async function updateDealStatusAction(dealId: string, status: 'open' | 'won' | 'lost'): Promise<{ success: boolean; error?: string }> {
    try {
        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) throw new Error('Deal not found');
        const deal = dealSnap.data() as Deal;

        const oldStatus = deal.status || 'open';
        if (oldStatus === status) return { success: true };

        const timestamp = new Date().toISOString();
        await dealRef.update({
            status,
            updatedAt: timestamp
        });

        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: null,
            workspaceId: deal.workspaceId,
            type: 'deal_status_changed',
            source: 'system',
            description: `marked deal "${deal.name}" as ${status.toUpperCase()}`,
            metadata: { dealId, fromStatus: oldStatus, toStatus: status }
        });

        return { success: true };
    } catch (e: any) {
        console.error('Failed to update deal status:', e);
        return { success: false, error: e.message };
    }
}

export async function updateDealOwnerAction(
    dealId: string, 
    userId: string | null, 
    userName: string | null, 
    userEmail: string | null
): Promise<{ success: boolean; error?: string }> {
    try {
        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) throw new Error('Deal not found');
        const deal = dealSnap.data() as Deal;

        const assignedTo = userId ? { userId, name: userName, email: userEmail } : null;

        const timestamp = new Date().toISOString();
        await dealRef.update({
            assignedTo,
            updatedAt: timestamp
        });

        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: null,
            workspaceId: deal.workspaceId,
            type: 'deal_owner_changed',
            source: 'system',
            description: `reassigned deal "${deal.name}" to ${userName || 'Unassigned'}`,
            metadata: { dealId, ownerId: userId, ownerName: userName }
        });

        return { success: true };
    } catch (e: any) {
        console.error('Failed to update deal owner:', e);
        return { success: false, error: e.message };
    }
}

export async function updateDealDetailsAction(
    dealId: string, 
    updates: { 
        name?: string; 
        value?: number; 
        expectedCloseDate?: string | null; 
        description?: string | null; 
        assignedTo?: { userId: string | null; name: string | null; email: string | null } | null;
        customFields?: Record<string, any>;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) throw new Error('Deal not found');
        const deal = dealSnap.data() as Deal;

        const timestamp = new Date().toISOString();
        const finalUpdates: any = {
            ...updates,
            updatedAt: timestamp
        };

        await dealRef.update(finalUpdates);

        // Simple activity logging for general updates
        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: null,
            workspaceId: deal.workspaceId,
            type: 'deal_updated',
            source: 'system',
            description: `updated core information for deal "${updates.name || deal.name}"`,
            metadata: { dealId, updates }
        });

        return { success: true };
    } catch (e: any) {
        console.error('Failed to update deal details:', e);
        return { success: false, error: e.message };
    }
}
