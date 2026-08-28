'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Deal, WorkspaceEntity, DealContact, DealFocalContact, EntityType } from '@/lib/types';
import { logActivity } from '@/lib/activity-logger';
import { canUser } from '@/lib/workspace-permissions';
import { calculateExpectedCloseDate } from '../admin/pipeline/utils/deal-expected-close';
import { triggerAutomationProtocols } from '@/lib/automations/orchestrator';

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

/**
 * ARCHITECTURAL NOTE & CAUTION (Zero Double-Prefix Entity ID & Multi-Pattern Resolution - Rule 10):
 * Safely resolves a workspace entity record across 4 storage patterns:
 * 1. Composite key: `${workspaceId}_${cleanEntityId}`
 * 2. Direct key: `cleanEntityId`
 * 3. Query lookup: where('workspaceId', '==', workspaceId).where('entityId', '==', cleanEntityId)
 * 4. Canonical entities collection fallback: doc('entities', cleanEntityId)
 * Guarantees zero "Entity not found" false negatives during pipeline deal creation or contact mapping.
 */
export async function resolveWorkspaceEntityRecord(
    workspaceId: string,
    entityId: string,
    organizationId: string = 'default'
): Promise<WorkspaceEntity | null> {
    if (!workspaceId || !entityId) return null;
    const cleanEntityId = entityId.startsWith(`${workspaceId}_`) ? entityId.slice(workspaceId.length + 1) : entityId;

    // Tier 1: Composite key
    const compositeSnap = await adminDb.collection('workspace_entities').doc(`${workspaceId}_${cleanEntityId}`).get();
    if (compositeSnap.exists) {
        const data = compositeSnap.data();
        if (!data?.workspaceId || data.workspaceId === workspaceId) {
            return { id: compositeSnap.id, ...data } as WorkspaceEntity;
        }
    }

    // Tier 2: Direct key with tenant boundary verification
    const directSnap = await adminDb.collection('workspace_entities').doc(cleanEntityId).get();
    if (directSnap.exists) {
        const data = directSnap.data();
        if (!data?.workspaceId || data.workspaceId === workspaceId) {
            return { id: directSnap.id, ...data } as WorkspaceEntity;
        }
    }

    // Tier 3: Query lookup (strictly scoped to workspaceId)
    const querySnap = await adminDb.collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', '==', cleanEntityId)
        .limit(1)
        .get();
    if (!querySnap.empty) {
        return { id: querySnap.docs[0].id, ...querySnap.docs[0].data() } as WorkspaceEntity;
    }

    // Tier 4: Canonical entities collection fallback with tenant ownership verification
    const entSnap = await adminDb.collection('entities').doc(cleanEntityId).get();
    if (entSnap.exists) {
        const rawEnt = entSnap.data() || {};
        const wsIds: string[] = Array.isArray(rawEnt.workspaceIds) ? rawEnt.workspaceIds : [];
        const isWsAllowed = wsIds.length === 0 || wsIds.includes(workspaceId);
        const isOrgAllowed = !rawEnt.organizationId || rawEnt.organizationId === organizationId || organizationId === 'default';

        if (isWsAllowed && isOrgAllowed) {
            const entType: EntityType = (rawEnt.entityType === 'family' || rawEnt.entityType === 'person') ? rawEnt.entityType : 'institution';
            return {
                id: entSnap.id,
                entityId: entSnap.id,
                entityType: entType,
                workspaceId,
                organizationId: rawEnt.organizationId || organizationId,
                displayName: String(rawEnt.name || rawEnt.displayName || ''),
                entityName: String(rawEnt.name || rawEnt.displayName || ''),
                primaryEmail: String(rawEnt.primaryEmail || rawEnt.email || ''),
                primaryPhone: String(rawEnt.primaryPhone || rawEnt.phone || ''),
                entityContacts: Array.isArray(rawEnt.entityContacts) ? rawEnt.entityContacts : [],
                workspaceTags: Array.isArray(rawEnt.workspaceTags) ? rawEnt.workspaceTags : [],
                assignedTo: rawEnt.assignedTo || null,
                status: rawEnt.status === 'archived' ? 'archived' : 'active',
                addedAt: String(rawEnt.addedAt || rawEnt.createdAt || new Date().toISOString()),
                updatedAt: String(rawEnt.updatedAt || new Date().toISOString()),
            };
        }
    }

    return null;
}

export async function createDeal(data: DealCreationData): Promise<{ id?: string; error?: string }> {
    try {
        const { entityId, workspaceId, organizationId, pipelineId, name, value, assignmentStrategy, eligibleUserIds = [], suppressAutomations = false, ...rest } = data;

        const cleanEntityId = entityId.startsWith(`${workspaceId}_`) ? entityId.slice(workspaceId.length + 1) : entityId;
        const pipelineRef = adminDb.collection('pipelines').doc(pipelineId);
        
        let stageSnap: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QuerySnapshot | null = null;
        if (!data.stageId) {
            stageSnap = await adminDb.collection('onboardingStages').where('pipelineId', '==', pipelineId).orderBy('order', 'asc').limit(1).get();
        } else if (!data.stageName) {
            stageSnap = await adminDb.collection('onboardingStages').doc(data.stageId).get();
        }

        const [entity, pipelineSnap] = await Promise.all([
            resolveWorkspaceEntityRecord(workspaceId, cleanEntityId, organizationId),
            pipelineRef.get(),
        ]);

        if (!entity) throw new Error('Entity not found');

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
            if (!stageId && 'docs' in stageSnap) {
                stageId = stageSnap.empty ? 'default_stage' : stageSnap.docs[0].id;
                stageName = stageSnap.empty ? undefined : (stageSnap.docs[0].data()?.name as string | undefined);
            } else if (!stageName && 'exists' in stageSnap && stageSnap.exists) {
                stageName = (stageSnap.data() as { name?: string } | undefined)?.name;
            }
        }

        const calculatedCloseDate = calculateExpectedCloseDate(
            pipeline,
            rest.expectedCloseDate
        );

        // ARCHITECTURAL NOTE & CAUTION: Contact Resolution for Deals
        // If focalContacts is not explicitly passed, automatically populate primary contact from entity
        // so pipeline cards display contact avatar/initials badges (Requirement 10 & 18).
        let resolvedFocalContacts: DealFocalContact[] = data.focalContacts ?? [];
        const legacyFocal = ((entity as unknown as Record<string, unknown>).focalContacts as Array<Record<string, string>> | undefined) || [];
        if (resolvedFocalContacts.length === 0 && entity.entityContacts && entity.entityContacts.length > 0) {
            const primary = entity.entityContacts.find(c => c.isPrimary) || entity.entityContacts[0];
            resolvedFocalContacts = [{
                id: primary.id,
                name: primary.name,
                role: primary.typeLabel || undefined,
                email: primary.email || undefined,
                phone: primary.phone || undefined,
            }];
        } else if (resolvedFocalContacts.length === 0 && legacyFocal.length > 0) {
            const legacy = legacyFocal[0];
            resolvedFocalContacts = [{
                id: legacy.id || 'contact_1',
                name: legacy.name || 'Contact',
                role: legacy.role || legacy.typeLabel || undefined,
                email: legacy.email || undefined,
                phone: legacy.phone || undefined,
            }];
        }

        // ARCHITECTURAL POINTER:
        // Automatically sanitize deal names: strip legacy 'Deal for ' / 'Deal For ' prefix
        let cleanDealName = (name || '').trim();
        if (/^deal\s+for\s+/i.test(cleanDealName)) {
            cleanDealName = cleanDealName.replace(/^deal\s+for\s+/i, '').trim();
        }
        if (!cleanDealName && entity) {
            cleanDealName = entity.displayName || (entity as unknown as Record<string, string>).name || 'Deal';
        }

        const newDeal: Omit<Deal, 'id'> = {
            organizationId,
            workspaceId,
            entityId: cleanEntityId,
            pipelineId,
            stageId: stageId || 'default_stage',
            ...(stageName ? { stageName } : {}),
            name: cleanDealName,
            value: value || 0,
            status: data.status || 'open',
            assignedTo: data.assignedTo !== undefined ? data.assignedTo : assignedTo,
            expectedCloseDate: calculatedCloseDate,
            description: rest.description || null,
            focalContacts: resolvedFocalContacts,
            customFields: rest.customFields || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const docRef = await adminDb.collection('deals').add(newDeal);

        // Broadcast signal via Event Bus (respecting suppressAutomations)
        await logActivity({
            organizationId,
            entityId: cleanEntityId,
            userId: null,
            workspaceId,
            type: suppressAutomations ? 'deal_created_suppressed' : 'deal_created',
            source: 'system',
            description: suppressAutomations 
                ? `initialized a new deal: "${cleanDealName}" (automations suppressed)`
                : `initialized a new deal: "${cleanDealName}"`,
            metadata: { dealId: docRef.id, value: value || 0, pipelineId, stageId }
        });

        return { id: docRef.id };
    } catch (e: unknown) {
        console.error('Failed to create deal:', e);
        return { error: e instanceof Error ? e.message : String(e) };
    }
}

export interface UpdateDealStageOptions {
    status?: 'open' | 'won' | 'lost';
    lostReason?: string;
    userId?: string;
}

export async function updateDealStageAction(
    dealId: string, 
    stageId: string,
    options?: UpdateDealStageOptions | string
): Promise<{ success: boolean; error?: string }> {
    try {
        const opts: UpdateDealStageOptions = typeof options === 'string' ? { userId: options } : (options || {});
        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) throw new Error('Deal not found');
        const deal = dealSnap.data() as Deal;

        if (opts.userId) {
            const permission = await canUser(opts.userId, 'operations', 'pipeline', 'edit', deal.workspaceId);
            if (!permission.granted) {
                return { success: false, error: permission.reason || 'Permission denied.' };
            }
        }

        const stageSnap = await adminDb.collection('onboardingStages').doc(stageId).get();
        if (!stageSnap.exists) throw new Error('Stage not found');
        const stageName = stageSnap.data()?.name as string;

        const oldStageName = deal.stageName || deal.stageId;
        const oldStageId = deal.stageId;

        const timestamp = new Date().toISOString();

        // Calculate duration spent in the stage being exited
        const lastEntered = deal.stageEnteredAt || deal.createdAt || timestamp;
        const lastEnteredTime = new Date(lastEntered).getTime();
        const durationSeconds = !isNaN(lastEnteredTime) ? Math.max(0, Math.floor((new Date(timestamp).getTime() - lastEnteredTime) / 1000)) : 0;

        const previousHistory = Array.isArray(deal.stageHistory) ? deal.stageHistory : [];
        const updatedHistory: import('@/lib/types').DealStageHistory[] = oldStageId !== stageId ? [
            ...previousHistory,
            {
                stageId: oldStageId,
                stageName: oldStageName,
                enteredAt: lastEntered,
                exitedAt: timestamp,
                durationSeconds,
                changedByUserId: opts.userId || 'system',
                notes: opts.lostReason || undefined
            }
        ] : previousHistory;

        const updatePayload: Record<string, unknown> = {
            stageId,
            stageName,
            stageEnteredAt: oldStageId !== stageId ? timestamp : (deal.stageEnteredAt || timestamp),
            stageHistory: updatedHistory,
            updatedAt: timestamp
        };

        if (opts.status) {
            updatePayload.status = opts.status;
            if (opts.status === 'lost' && opts.lostReason) {
                updatePayload.lostReason = opts.lostReason;
            }
        }

        await dealRef.update(updatePayload);

        // ARCHITECTURAL POINTER:
        // Broadcast stage change signal to Activity Log & trigger stage-scoped automations.
        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: opts.userId || null,
            workspaceId: deal.workspaceId,
            type: opts.status === 'lost' ? 'deal_lost' : (opts.status === 'won' ? 'deal_won' : 'deal_stage_changed'),
            source: opts.userId ? 'user' : 'system',
            description: opts.status === 'lost' 
                ? `marked deal "${deal.name}" as lost in "${stageName}"${opts.lostReason ? ` (${opts.lostReason})` : ''}`
                : (opts.status === 'won' 
                    ? `won deal "${deal.name}" in "${stageName}"`
                    : `progressed deal "${deal.name}" from "${oldStageName}" to "${stageName}"`),
            metadata: { 
                dealId, 
                from: oldStageName, 
                to: stageName, 
                stageId, 
                pipelineId: deal.pipelineId,
                status: opts.status || deal.status,
                lostReason: opts.lostReason
            }
        });

        // Trigger attached automations for the receiving stage
        try {
            await triggerAutomationProtocols('DEAL_STAGE_CHANGED', {
                dealId,
                entityId: deal.entityId,
                entityType: 'deal',
                pipelineId: deal.pipelineId,
                stageId,
                stageName,
                oldStageId,
                oldStageName,
                dealName: deal.name,
                dealValue: deal.value || 0,
                workspaceId: deal.workspaceId,
                organizationId: deal.organizationId,
                focalContacts: deal.focalContacts || [],
                customFields: deal.customFields || {},
            });
        } catch (autoErr) {
            console.error('[AutomationTriggerError] Failed to dispatch stage change automations:', autoErr);
        }

        return { success: true };
    } catch (e: unknown) {
        console.error('Failed to update deal stage:', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
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
    } catch (e: unknown) {
        console.error('Failed to update deal value:', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
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
    } catch (e: unknown) {
        console.error('Failed to update deal status:', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
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
    } catch (e: unknown) {
        console.error('Failed to update deal owner:', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
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
        customFields?: Record<string, unknown>;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) throw new Error('Deal not found');
        const deal = dealSnap.data() as Deal;

        const timestamp = new Date().toISOString();
        const finalUpdates: Record<string, unknown> = {
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
    } catch (e: unknown) {
        console.error('Failed to update deal details:', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
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

        // Resolve contact name and email via resilient entity resolver
        const entity = await resolveWorkspaceEntityRecord(deal.workspaceId, entityId, deal.organizationId);
        if (!entity) throw new Error('Contact entity not found in this workspace');

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
    } catch (e: unknown) {
        console.error('Failed to add deal contact:', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
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
    } catch (e: unknown) {
        console.error('Failed to remove deal contact:', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
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

/**
 * Deletes a single deal document from Firestore deals collection and logs activity.
 *
 * DEVELOPER GUIDE & CAUTION FOR MAINTAINERS (Rule 10):
 * - Verifies user permission before deleting document.
 * - Logs 'deal_deleted' activity for audit compliance.
 * - Testability: Mock adminDb.collection('deals').doc().delete() in unit tests.
 */
export async function deleteDealAction(
    dealId: string,
    workspaceId: string,
    userId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!dealId || !workspaceId) {
            return { success: false, error: 'Missing dealId or workspaceId' };
        }

        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) {
            return { success: false, error: 'Deal not found.' };
        }

        const deal = dealSnap.data() as Deal;

        if (userId) {
            const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
            if (!permission.granted) {
                return { success: false, error: permission.reason };
            }
        }

        await dealRef.delete();

        await logActivity({
            organizationId: deal.organizationId || '',
            entityId: deal.entityId || '',
            userId: userId || null,
            workspaceId: deal.workspaceId || workspaceId,
            type: 'deal_deleted',
            source: 'user',
            description: `deleted deal "${deal.name}"`,
            metadata: { dealId, name: deal.name, stageId: deal.stageId }
        });

        return { success: true };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to delete deal';
        console.error('❌ Failed to delete deal:', error);
        return { success: false, error };
    }
}

/**
 * FER Protocol (Fetch, Enrich and Restore) for Deal Names:
 * Scans deals in Firestore matching "Deal for " / "Deal For " prefix (or within a workspace),
 * enriches them by resolving the canonical entity name from workspace_entities, and restores them in batches.
 *
 * ARCHITECTURAL POINTER (Rule 10):
 * - Multi-tenant workspace scoped if workspaceId is provided.
 * - Resolves full canonical entity displayName from Firestore, restoring untruncated names.
 * - Uses batching (400 ops per chunk) to adhere to Firestore rate limits and avoid memory exhaustion.
 */
export async function cleanLegacyDealNamesAction(params?: {
    workspaceId?: string;
    userId?: string;
}): Promise<{ success: boolean; totalChecked: number; updatedCount: number; errors?: string[] }> {
    try {
        const { workspaceId, userId } = params || {};
        
        if (userId && workspaceId) {
            const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
            if (!permission.granted) {
                return { success: false, totalChecked: 0, updatedCount: 0, errors: [permission.reason || 'Permission denied'] };
            }
        }

        let dealsQuery: FirebaseFirestore.Query = adminDb.collection('deals');
        if (workspaceId) {
            dealsQuery = dealsQuery.where('workspaceId', '==', workspaceId);
        }

        const snapshot = await dealsQuery.get();
        if (snapshot.empty) {
            return { success: true, totalChecked: 0, updatedCount: 0 };
        }

        const dealsToUpdate: Array<{ id: string; currentName: string; entityId: string; workspaceId: string; newName: string }> = [];

        // Dual-key entity cache to minimize round-trips
        const entityCache = new Map<string, string>();

        for (const doc of snapshot.docs) {
            const data = doc.data() as Deal;
            const currentName = (data.name || '').trim();

            if (/^deal\s+for\s+/i.test(currentName)) {
                const eid = data.entityId;
                const wsId = data.workspaceId || workspaceId || '';

                let resolvedName = '';
                if (eid && wsId) {
                    const cacheKey = `${wsId}_${eid}`;
                    if (entityCache.has(cacheKey)) {
                        resolvedName = entityCache.get(cacheKey)!;
                    } else {
                        const entity = await resolveWorkspaceEntityRecord(wsId, eid, data.organizationId);
                        if (entity) {
                            const rawName = entity.displayName || (entity as unknown as Record<string, string>).name || '';
                            resolvedName = rawName.trim();
                            if (resolvedName) entityCache.set(cacheKey, resolvedName);
                        }
                    }
                }

                // Fallback to cleanly stripping the prefix if entity lookup returns empty
                if (!resolvedName) {
                    resolvedName = currentName.replace(/^deal\s+for\s+/i, '').replace(/\.{2,}$/, '').trim();
                }

                if (resolvedName && resolvedName !== currentName) {
                    dealsToUpdate.push({
                        id: doc.id,
                        currentName,
                        entityId: eid,
                        workspaceId: wsId,
                        newName: resolvedName,
                    });
                }
            }
        }

        if (dealsToUpdate.length === 0) {
            return { success: true, totalChecked: snapshot.size, updatedCount: 0 };
        }

        const chunkSize = 400;
        const now = new Date().toISOString();

        for (let i = 0; i < dealsToUpdate.length; i += chunkSize) {
            const chunk = dealsToUpdate.slice(i, i + chunkSize);
            const batch = adminDb.batch();

            for (const item of chunk) {
                const ref = adminDb.collection('deals').doc(item.id);
                batch.update(ref, {
                    name: item.newName,
                    updatedAt: now,
                });
            }

            await batch.commit();
        }

        return {
            success: true,
            totalChecked: snapshot.size,
            updatedCount: dealsToUpdate.length,
        };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        console.error('❌ Failed to clean legacy deal names:', error);
        return { success: false, totalChecked: 0, updatedCount: 0, errors: [error] };
    }
}

/**
 * Updates the display order of stages within a pipeline atomically.
 *
 * ARCHITECTURAL POINTER (Rule 10):
 * - Assigns strict sequential order indices (0, 1, 2...) to avoid index collisions.
 * - Commits all stage order updates in a single atomic Firestore batch.
 */
export async function updateStageOrdersAction(
    pipelineId: string,
    orderedStageIds: string[],
    workspaceId?: string,
    userId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!pipelineId || !orderedStageIds || orderedStageIds.length === 0) {
            return { success: false, error: 'Pipeline ID and stage IDs are required.' };
        }

        if (userId && workspaceId) {
            const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
            if (!permission.granted) {
                return { success: false, error: permission.reason };
            }
        }

        const batch = adminDb.batch();
        const now = new Date().toISOString();

        orderedStageIds.forEach((stageId, index) => {
            const ref = adminDb.collection('onboardingStages').doc(stageId);
            batch.update(ref, {
                order: index,
                updatedAt: now,
            });
        });

        await batch.commit();
        return { success: true };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to update stage orders';
        console.error('❌ Failed to update stage orders:', error);
        return { success: false, error };
    }
}

/**
 * Updates fields on a single Deal document with permission checks and activity logging.
 */
export async function updateDealAction(
    dealId: string,
    updates: Partial<Deal>,
    workspaceId: string,
    userId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!dealId || !workspaceId) {
            return { success: false, error: 'Missing dealId or workspaceId' };
        }

        if (userId) {
            const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
            if (!permission.granted) {
                return { success: false, error: permission.reason };
            }
        }

        const dealRef = adminDb.collection('deals').doc(dealId);
        const dealSnap = await dealRef.get();
        if (!dealSnap.exists) {
            return { success: false, error: 'Deal not found.' };
        }

        const currentData = dealSnap.data() as Deal;

        // Cross-tenant protection
        if (currentData.workspaceId && currentData.workspaceId !== workspaceId) {
            return { success: false, error: 'Unauthorized: Deal belongs to a different workspace.' };
        }

        // Sanitize name if updated
        let cleanName = updates.name;
        if (cleanName && /^deal\s+for\s+/i.test(cleanName.trim())) {
            cleanName = cleanName.trim().replace(/^deal\s+for\s+/i, '').trim();
        }

        const patch: Record<string, unknown> = {
            ...updates,
            ...(cleanName ? { name: cleanName } : {}),
            updatedAt: new Date().toISOString(),
        };

        await dealRef.update(patch);

        await logActivity({
            organizationId: currentData.organizationId || '',
            entityId: currentData.entityId || '',
            userId: userId || null,
            workspaceId: currentData.workspaceId || workspaceId,
            type: 'deal_updated',
            source: 'user',
            description: `updated deal "${cleanName || currentData.name}"`,
            metadata: { dealId, updates: patch }
        });

        return { success: true };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to update deal';
        console.error('❌ Failed to update deal:', error);
        return { success: false, error };
    }
}

/**
 * Bulk updates the stage and status for an array of deal IDs with throttled automation dispatch.
 */
export async function bulkUpdateDealsStageAction(
    dealIds: string[],
    targetStageId: string,
    workspaceId: string,
    userId?: string
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    try {
        if (!dealIds || dealIds.length === 0 || !targetStageId || !workspaceId) {
            return { success: false, updatedCount: 0, error: 'Missing required parameters' };
        }

        if (userId) {
            const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
            if (!permission.granted) {
                return { success: false, updatedCount: 0, error: permission.reason };
            }
        }

        const stageSnap = await adminDb.collection('onboardingStages').doc(targetStageId).get();
        const stageData = stageSnap.exists ? stageSnap.data() : null;
        const stageName = stageData?.name || targetStageId;
        const isWonStage = stageName.toLowerCase().includes('live') || stageName.toLowerCase().includes('won');
        const isLostStage = stageName.toLowerCase().includes('lost');
        const targetStatus: 'open' | 'won' | 'lost' = isLostStage ? 'lost' : isWonStage ? 'won' : 'open';

        const now = new Date().toISOString();
        const chunkSize = 200;
        let totalUpdated = 0;

        for (let i = 0; i < dealIds.length; i += chunkSize) {
            const chunkIds = dealIds.slice(i, i + chunkSize);
            const docRefs = chunkIds.map(id => adminDb.collection('deals').doc(id));
            const snaps = await adminDb.getAll(...docRefs);
            const batch = adminDb.batch();
            let batchOps = 0;

            for (const snap of snaps) {
                if (snap.exists) {
                    const data = snap.data() as Deal;
                    // Multi-tenant check
                    if (!data.workspaceId || data.workspaceId === workspaceId) {
                        const oldStageId = data.stageId;
                        const oldStageName = data.stageName || data.stageId;
                        const lastEntered = data.stageEnteredAt || data.createdAt || now;
                        const lastEnteredTime = new Date(lastEntered).getTime();
                        const durationSeconds = !isNaN(lastEnteredTime) ? Math.max(0, Math.floor((new Date(now).getTime() - lastEnteredTime) / 1000)) : 0;

                        const previousHistory = Array.isArray(data.stageHistory) ? data.stageHistory : [];
                        const updatedHistory: import('@/lib/types').DealStageHistory[] = oldStageId !== targetStageId ? [
                            ...previousHistory,
                            {
                                stageId: oldStageId,
                                stageName: oldStageName,
                                enteredAt: lastEntered,
                                exitedAt: now,
                                durationSeconds,
                                changedByUserId: userId || 'system',
                            }
                        ] : previousHistory;

                        batch.update(snap.ref, {
                            stageId: targetStageId,
                            stageName,
                            stageEnteredAt: oldStageId !== targetStageId ? now : (data.stageEnteredAt || now),
                            stageHistory: updatedHistory,
                            status: targetStatus,
                            updatedAt: now,
                        });
                        batchOps++;
                    }
                }
            }

            if (batchOps > 0) {
                await batch.commit();
                totalUpdated += batchOps;
            }
        }

        // Throttled trigger for automations (batches of 10)
        const AUTO_CHUNK = 10;
        for (let i = 0; i < dealIds.length; i += AUTO_CHUNK) {
            const subChunk = dealIds.slice(i, i + AUTO_CHUNK);
            await Promise.all(subChunk.map(async (dealId) => {
                try {
                    const snap = await adminDb.collection('deals').doc(dealId).get();
                    if (snap.exists) {
                        const d = snap.data() as Deal;
                        if (!d.workspaceId || d.workspaceId === workspaceId) {
                            await triggerAutomationProtocols('DEAL_STAGE_CHANGED', {
                                workspaceId: d.workspaceId || workspaceId,
                                entityId: d.entityId,
                                organizationId: d.organizationId || 'default',
                                payload: {
                                    dealId,
                                    pipelineId: d.pipelineId,
                                    stageId: targetStageId,
                                    stageName,
                                    value: d.value,
                                }
                            });
                        }
                    }
                } catch {
                    // Ignore individual automation trigger errors in bulk flow
                }
            }));
        }

        await logActivity({
            organizationId: '',
            entityId: null,
            userId: userId || null,
            workspaceId,
            type: 'bulk_deals_stage_changed',
            source: 'user',
            description: `bulk moved ${totalUpdated} deals to stage "${stageName}"`,
            metadata: { targetStageId, stageName, count: totalUpdated }
        });

        return { success: true, updatedCount: totalUpdated };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to bulk move deals';
        console.error('❌ Failed to bulk move deals:', error);
        return { success: false, updatedCount: 0, error };
    }
}

/**
 * Bulk reassigns an array of deal IDs to a new owner.
 */
export async function bulkAssignDealsAction(
    dealIds: string[],
    assignedTo: { userId: string | null; name: string | null; email: string | null } | null,
    workspaceId: string,
    userId?: string
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    try {
        if (!dealIds || dealIds.length === 0 || !workspaceId) {
            return { success: false, updatedCount: 0, error: 'Missing required parameters' };
        }

        if (userId) {
            const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
            if (!permission.granted) {
                return { success: false, updatedCount: 0, error: permission.reason };
            }
        }

        const now = new Date().toISOString();
        const chunkSize = 200;
        let totalUpdated = 0;

        for (let i = 0; i < dealIds.length; i += chunkSize) {
            const chunkIds = dealIds.slice(i, i + chunkSize);
            const docRefs = chunkIds.map(id => adminDb.collection('deals').doc(id));
            const snaps = await adminDb.getAll(...docRefs);
            const batch = adminDb.batch();
            let batchOps = 0;

            for (const snap of snaps) {
                if (snap.exists) {
                    const data = snap.data() as Deal;
                    if (!data.workspaceId || data.workspaceId === workspaceId) {
                        batch.update(snap.ref, {
                            assignedTo: assignedTo || null,
                            updatedAt: now,
                        });
                        batchOps++;
                    }
                }
            }

            if (batchOps > 0) {
                await batch.commit();
                totalUpdated += batchOps;
            }
        }

        await logActivity({
            organizationId: '',
            entityId: null,
            userId: userId || null,
            workspaceId,
            type: 'bulk_deals_reassigned',
            source: 'user',
            description: `bulk reassigned ${totalUpdated} deals to ${assignedTo?.name || 'Unassigned'}`,
            metadata: { assignedTo, count: totalUpdated }
        });

        return { success: true, updatedCount: totalUpdated };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to bulk reassign deals';
        console.error('❌ Failed to bulk reassign deals:', error);
        return { success: false, updatedCount: 0, error };
    }
}

/**
 * Bulk deletes an array of deal documents from Firestore.
 */
export async function bulkDeleteDealsAction(
    dealIds: string[],
    workspaceId: string,
    userId?: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
        if (!dealIds || dealIds.length === 0 || !workspaceId) {
            return { success: false, deletedCount: 0, error: 'Missing required parameters' };
        }

        if (userId) {
            const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
            if (!permission.granted) {
                return { success: false, deletedCount: 0, error: permission.reason };
            }
        }

        const chunkSize = 200;
        let totalDeleted = 0;

        for (let i = 0; i < dealIds.length; i += chunkSize) {
            const chunkIds = dealIds.slice(i, i + chunkSize);
            const docRefs = chunkIds.map(id => adminDb.collection('deals').doc(id));
            const snaps = await adminDb.getAll(...docRefs);
            const batch = adminDb.batch();
            let batchOps = 0;

            for (const snap of snaps) {
                if (snap.exists) {
                    const data = snap.data() as Deal;
                    if (!data.workspaceId || data.workspaceId === workspaceId) {
                        batch.delete(snap.ref);
                        batchOps++;
                    }
                }
            }

            if (batchOps > 0) {
                await batch.commit();
                totalDeleted += batchOps;
            }
        }

        await logActivity({
            organizationId: '',
            entityId: null,
            userId: userId || null,
            workspaceId,
            type: 'bulk_deals_deleted',
            source: 'user',
            description: `bulk deleted ${totalDeleted} deals`,
            metadata: { count: totalDeleted }
        });

        return { success: true, deletedCount: totalDeleted };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to bulk delete deals';
        console.error('❌ Failed to bulk delete deals:', error);
        return { success: false, deletedCount: 0, error };
    }
}

