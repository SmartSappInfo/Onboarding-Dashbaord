'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Deal, WorkspaceEntity, DealContact, DealFocalContact } from '@/lib/types';
import { logActivity } from '@/lib/activity-logger';
import { canUser } from '@/lib/workspace-permissions';
import { calculateExpectedCloseDate } from '../admin/pipeline/utils/deal-expected-close';

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

async function resolveAssigneeDetails(userId: string): Promise<{ userId: string; name: string; email: string }> {
    try {
        const userSnap = await adminDb.collection('users').doc(userId).get();
        if (userSnap.exists) {
            const userData = userSnap.data();
            return {
                userId,
                name: userData?.name || 'Assigned User',
                email: userData?.email || '',
            };
        }
    } catch (e) {
        console.error('Failed to resolve assignee details:', e);
    }
    return { userId, name: 'Assigned User', email: '' };
}

export async function createDeal(data: DealCreationData): Promise<{ id?: string; error?: string }> {
    try {
        const { entityId, workspaceId, organizationId, pipelineId, name, value, assignmentStrategy, eligibleUserIds = [], suppressAutomations = false, ...rest } = data;

        const entityRef = adminDb.collection('workspace_entities').doc(`${workspaceId}_${entityId}`);
        const pipelineRef = adminDb.collection('pipelines').doc(pipelineId);
        
        let stageQueryOrDoc: any;
        if (!data.stageId) {
            stageQueryOrDoc = adminDb.collection('onboardingStages').where('pipelineId', '==', pipelineId).orderBy('order', 'asc').limit(1);
        } else if (!data.stageName) {
            stageQueryOrDoc = adminDb.collection('onboardingStages').doc(data.stageId);
        }

        const [entitySnap, pipelineSnap, stageSnap] = await Promise.all([
            entityRef.get(),
            pipelineRef.get(),
            stageQueryOrDoc ? stageQueryOrDoc.get() : Promise.resolve(null)
        ]);

        if (!entitySnap.exists) throw new Error('Entity not found');
        const entity = entitySnap.data() as WorkspaceEntity;

        const pipeline = pipelineSnap.exists ? pipelineSnap.data() : null;

        // Resolve final strategy and eligible assignees
        const activeStrategy = assignmentStrategy || pipeline?.assignmentStrategy || 'direct';
        const activeEligibleUserIds = eligibleUserIds.length > 0
            ? eligibleUserIds
            : (pipeline?.assignmentUserIds || []);

        let assignedTo = null;

        if (activeStrategy === 'direct') {
            assignedTo = entity.assignedTo || null;
        } else if (activeStrategy === 'round-robin' && activeEligibleUserIds.length > 0) {
            let minDeals = Infinity;
            let selectedUserId = activeEligibleUserIds[0];
            
            for (const uid of activeEligibleUserIds) {
                const snap = await adminDb.collection('deals').where('assignedTo.userId', '==', uid).where('status', '==', 'open').get();
                if (snap.size < minDeals) {
                    minDeals = snap.size;
                    selectedUserId = uid;
                }
            }
            assignedTo = await resolveAssigneeDetails(selectedUserId);
        } else if (activeStrategy === 'value-based' && activeEligibleUserIds.length > 0) {
            let minVal = Infinity;
            let selectedUserId = activeEligibleUserIds[0];
            
            for (const uid of activeEligibleUserIds) {
                const snap = await adminDb.collection('deals').where('assignedTo.userId', '==', uid).where('status', '==', 'open').get();
                let totalValue = 0;
                snap.forEach(doc => totalValue += (doc.data().value || 0));
                
                if (totalValue < minVal) {
                    minVal = totalValue;
                    selectedUserId = uid;
                }
            }
            assignedTo = await resolveAssigneeDetails(selectedUserId);
        } else if (activeStrategy === 'unassigned') {
            assignedTo = null;
        }

        let stageId = data.stageId;
        let stageName = data.stageName;

        if (stageSnap) {
            if (!stageId) {
                stageId = stageSnap.empty ? 'default_stage' : stageSnap.docs[0].id;
                stageName = stageSnap.empty ? undefined : (stageSnap.docs[0].data().name as string | undefined);
            } else if (!stageName) {
                if (stageSnap.exists) {
                    stageName = stageSnap.data()?.name as string | undefined;
                }
            }
        }

        const calculatedCloseDate = calculateExpectedCloseDate(
            pipeline,
            rest.expectedCloseDate
        );

        const newDeal: Omit<Deal, 'id'> = {
            organizationId,
            workspaceId,
            entityId,
            pipelineId,
            stageId: stageId || 'default_stage',
            ...(stageName ? { stageName } : {}),
            name,
            value: value || 0,
            status: data.status || 'open',
            assignedTo: data.assignedTo !== undefined ? data.assignedTo : assignedTo,
            expectedCloseDate: calculatedCloseDate,
            description: rest.description || null,
            // Set explicitly — `rest` is never spread into the document, so this
            // would be silently dropped if left to the spread. Bulk/automation/import
            // creation paths have no person context and default this to [].
            focalContacts: data.focalContacts ?? [],
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

export async function updateDealStatusAction(
    dealId: string, 
    status: 'open' | 'won' | 'lost',
    lostReason?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) throw new Error('Deal not found');
        const deal = dealSnap.data() as Deal;

        const oldStatus = deal.status || 'open';
        const finalLostReason = status === 'lost' ? (lostReason || 'Not Specified') : null;
        if (oldStatus === status && (status !== 'lost' || deal.lostReason === finalLostReason)) {
            return { success: true };
        }

        const timestamp = new Date().toISOString();
        await dealRef.update({
            status,
            lostReason: finalLostReason,
            updatedAt: timestamp
        });

        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: null,
            workspaceId: deal.workspaceId,
            type: 'deal_status_changed',
            source: 'system',
            description: status === 'lost'
                ? `marked deal "${deal.name}" as CLOSED LOST: ${finalLostReason}`
                : `marked deal "${deal.name}" as ${status.toUpperCase()}`,
            metadata: { 
                dealId, 
                fromStatus: oldStatus, 
                toStatus: status, 
                value: deal.value || 0,
                pipelineId: deal.pipelineId,
                lostReason: finalLostReason
            }
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
        focalContacts?: DealFocalContact[];
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

export async function addDealContactAction(
    dealId: string, 
    entityId: string, 
    role: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) throw new Error('Deal not found');
        const deal = dealSnap.data() as Deal;

        // Resolve contact name and email
        const entitySnap = await adminDb.collection('workspace_entities')
            .doc(`${deal.workspaceId}_${entityId}`).get();
        if (!entitySnap.exists) throw new Error('Contact entity not found in this workspace');
        const entity = entitySnap.data() as WorkspaceEntity;

        const currentContacts = deal.contacts || [];
        if (currentContacts.some(c => c.entityId === entityId)) {
            throw new Error('Contact already associated with this deal');
        }

        const newContact: DealContact = {
            entityId,
            role,
            name: entity.displayName || entity.entityName || 'Unknown',
            email: entity.primaryEmail || ''
        };

        const updatedContacts = [...currentContacts, newContact];
        const timestamp = new Date().toISOString();

        await dealRef.update({
            contacts: updatedContacts,
            updatedAt: timestamp
        });

        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: null,
            workspaceId: deal.workspaceId,
            type: 'deal_updated',
            source: 'system',
            description: `associated contact "${newContact.name}" to deal "${deal.name}" as ${role}`,
            metadata: { dealId, entityId, role, contactName: newContact.name }
        });

        return { success: true };
    } catch (e: any) {
        console.error('Failed to add deal contact:', e);
        return { success: false, error: e.message };
    }
}

export async function removeDealContactAction(
    dealId: string, 
    entityId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) throw new Error('Deal not found');
        const deal = dealSnap.data() as Deal;

        const currentContacts = deal.contacts || [];
        const contactToRemove = currentContacts.find(c => c.entityId === entityId);
        if (!contactToRemove) {
            return { success: true }; // Already removed
        }

        const updatedContacts = currentContacts.filter(c => c.entityId !== entityId);
        const timestamp = new Date().toISOString();

        await dealRef.update({
            contacts: updatedContacts,
            updatedAt: timestamp
        });

        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: null,
            workspaceId: deal.workspaceId,
            type: 'deal_updated',
            source: 'system',
            description: `removed contact association "${contactToRemove.name || entityId}" from deal "${deal.name}"`,
            metadata: { dealId, entityId }
        });

        return { success: true };
    } catch (e: any) {
        console.error('Failed to remove deal contact:', e);
        return { success: false, error: e.message };
    }
}

export async function clearStageDealsAction(
    stageId: string,
    workspaceId: string,
    userId: string
): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
        const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const workspaceSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
        if (!workspaceSnap.exists) {
            return { success: false, error: 'Workspace not found.' };
        }
        const organizationId = workspaceSnap.data()?.organizationId || '';

        const stageSnap = await adminDb.collection('onboardingStages').doc(stageId).get();
        const stageName = stageSnap.exists ? stageSnap.data()?.name : stageId;

        const dealsSnap = await adminDb.collection('deals')
            .where('stageId', '==', stageId)
            .where('workspaceId', '==', workspaceId)
            .get();

        if (dealsSnap.empty) {
            return { success: true, count: 0 };
        }

        const docs = dealsSnap.docs;
        const chunkSize = 400;
        for (let i = 0; i < docs.length; i += chunkSize) {
            const chunk = docs.slice(i, i + chunkSize);
            const batch = adminDb.batch();
            chunk.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        await logActivity({
            organizationId,
            entityId: null,
            userId,
            workspaceId,
            type: 'deals_cleared',
            source: 'system',
            description: `cleared all ${docs.length} deals in stage "${stageName}"`,
            metadata: { stageId, stageName, count: docs.length }
        });

        return { success: true, count: docs.length };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        console.error('Failed to clear stage deals:', error);
        return { success: false, error };
    }
}
