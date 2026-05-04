'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Deal, WorkspaceEntity } from '@/lib/types';

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
}

export async function createDeal(data: DealCreationData): Promise<{ id?: string; error?: string }> {
    try {
        const { entityId, workspaceId, organizationId, pipelineId, name, value, assignmentStrategy = 'direct', eligibleUserIds = [], ...rest } = data;

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

        const stageSnap = await adminDb.collection('onboardingStages').where('pipelineId', '==', pipelineId).orderBy('order', 'asc').limit(1).get();
        const stageId = stageSnap.empty ? 'default_stage' : stageSnap.docs[0].id;

        const newDeal: Omit<Deal, 'id'> = {
            organizationId,
            workspaceId,
            entityId,
            pipelineId,
            stageId,
            name,
            value: value || 0,
            status: 'open',
            assignedTo,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...rest
        };

        const docRef = await adminDb.collection('deals').add(newDeal);
        return { id: docRef.id };
    } catch (e: any) {
        return { error: e.message };
    }
}
