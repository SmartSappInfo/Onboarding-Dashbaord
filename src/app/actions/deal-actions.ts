'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/firebase-admin';
import type { 
    Deal, 
    WorkspaceEntity, 
    DealContact, 
    DealFocalContact, 
    EntityType, 
    DealDuplicateOptions, 
    DealMergeOptions, 
    DealMergeResult, 
    DealLineItem 
} from '@/lib/types';
import { logActivity } from '@/lib/activity-logger';
import { canUser } from '@/lib/workspace-permissions';
import { calculateExpectedCloseDate } from '../admin/pipeline/utils/deal-expected-close';
import { triggerAutomationProtocols } from '@/lib/automations/orchestrator';
import { calculateLineItemsTotals } from '@/lib/deals/deal-health-engine';
import { 
    validateStageTransition, 
    resolveStageTerminalStatus, 
    isStageTerminal 
} from '@/lib/deals/deal-stage-validation';
import type { 
    LeadConversionOptions, 
    LeadConversionResult, 
    DealInteractionData, 
    DealInteractionResult 
} from '@/lib/deals/deal-types';
import type { OnboardingStage } from '@/lib/types';
import { nanoid } from 'nanoid';

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
    status?: 'open' | 'won' | 'lost' | 'cancelled';
    lostReason?: string;
    userId?: string;
    bypassValidation?: boolean;
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
        const targetStage = stageSnap.data() as OnboardingStage;
        const stageName = targetStage?.name || stageId;

        // ARCHITECTURAL POINTER (Phase 2 — Entry Gate Validation):
        // Validate required fields before advancing stage unless explicitly bypassed
        if (!opts.bypassValidation) {
            const validation = validateStageTransition(deal, targetStage);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.message || `Deal does not meet the entry requirements for "${stageName}".`,
                };
            }
        }

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

        // Automated Terminal State Resolution (PRD Section 14)
        let resolvedStatus: 'open' | 'won' | 'lost' | 'cancelled' = opts.status || deal.status || 'open';
        if (!opts.status) {
            const autoStatus = resolveStageTerminalStatus(targetStage);
            if (autoStatus === 'won' || autoStatus === 'lost') {
                resolvedStatus = autoStatus;
            } else if (deal.status === 'won' || deal.status === 'lost') {
                resolvedStatus = 'open';
            }
        }

        const updatePayload: Record<string, unknown> = {
            stageId,
            stageName,
            stageEnteredAt: oldStageId !== stageId ? timestamp : (deal.stageEnteredAt || timestamp),
            stageHistory: updatedHistory,
            status: resolvedStatus,
            updatedAt: timestamp
        };

        // Sync stage win probability if configured and moving to a new stage
        if (typeof targetStage.probability === 'number' && (deal.probability == null || deal.probability === 0 || oldStageId !== stageId)) {
            updatePayload.probability = targetStage.probability;
        }

        if (resolvedStatus === 'lost' && opts.lostReason) {
            updatePayload.lostReason = opts.lostReason;
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
        pipelineId?: string;
        stageId?: string;
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
        const stageData = stageSnap.exists ? (stageSnap.data() as OnboardingStage) : null;
        const stageName = stageData?.name || targetStageId;
        const targetStatus: 'open' | 'won' | 'lost' = resolveStageTerminalStatus(stageData);

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

                        const updateObj: Record<string, unknown> = {
                            stageId: targetStageId,
                            stageName,
                            stageEnteredAt: oldStageId !== targetStageId ? now : (data.stageEnteredAt || now),
                            stageHistory: updatedHistory,
                            status: targetStatus,
                            updatedAt: now,
                        };

                        if (typeof stageData?.probability === 'number') {
                            updateObj.probability = stageData.probability;
                        }

                        batch.update(snap.ref, updateObj);
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
                            // ARCHITECTURAL POINTER (Rule 10 - Standardized Automation Trigger Payload):
                            // Provide top-level payload properties matching single-deal transition structure
                            // so trigger evaluators accurately match stageId, pipelineId, and deal value.
                            await triggerAutomationProtocols('DEAL_STAGE_CHANGED', {
                                dealId,
                                entityId: d.entityId,
                                entityType: 'deal',
                                pipelineId: d.pipelineId,
                                stageId: targetStageId,
                                stageName,
                                dealName: d.name,
                                dealValue: d.value || 0,
                                workspaceId: d.workspaceId || workspaceId,
                                organizationId: d.organizationId || 'default',
                                focalContacts: d.focalContacts || [],
                                customFields: d.customFields || {},
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

/**
 * ARCHITECTURAL POINTER (Phase 1 - Deal Duplication / Cloning):
 * Creates a duplicate copy of an existing opportunity:
 * - Copies: Line items, focal contacts, secondary contacts, custom fields, tags, and monetary parameters.
 * - Resets: Identity (new doc ID), initial stage tracking (enteredAt = now), clean stageHistory array,
 *   fresh timestamps, status = 'open', healthStatus = 'healthy'.
 * - Calculates expected close date if new pipeline/stage is selected.
 */
export async function duplicateDealAction(
    dealId: string,
    options?: DealDuplicateOptions,
    userId?: string
): Promise<{ success: boolean; newDealId?: string; error?: string }> {
    try {
        if (!dealId) {
            return { success: false, error: 'Deal ID is required' };
        }

        const sourceDoc = await adminDb.collection('deals').doc(dealId).get();
        if (!sourceDoc.exists) {
            return { success: false, error: 'Source deal not found' };
        }

        const sourceDeal = sourceDoc.data() as Deal;

        if (userId && sourceDeal.workspaceId) {
            const perm = await canUser(userId, 'operations', 'pipeline', 'create', sourceDeal.workspaceId);
            if (!perm.granted) {
                return { success: false, error: perm.reason };
            }
        }

        const now = new Date().toISOString();
        const targetPipelineId = options?.targetPipelineId || sourceDeal.pipelineId;
        const targetStageId = options?.targetStageId || sourceDeal.stageId;

        // Fetch stage name if stage changed
        let targetStageName = sourceDeal.stageName;
        if (targetStageId && targetStageId !== sourceDeal.stageId) {
            try {
                const stageDoc = await adminDb.collection('onboardingStages').doc(targetStageId).get();
                if (stageDoc.exists) {
                    targetStageName = stageDoc.data()?.name || targetStageName;
                }
            } catch {
                // Keep default stage name
            }
        }

        // Calculate expected close date for the target pipeline/stage
        let expectedCloseDate = sourceDeal.expectedCloseDate;
        try {
            const pipelineDoc = await adminDb.collection('pipelines').doc(targetPipelineId).get();
            const calculated = calculateExpectedCloseDate(
                pipelineDoc.exists ? pipelineDoc.data() : null,
                sourceDeal.expectedCloseDate
            );
            if (calculated) {
                expectedCloseDate = calculated;
            }
        } catch {
            // Keep existing close date or null
        }

        const clonedLineItems: DealLineItem[] = (options?.copyLineItems !== false && Array.isArray(sourceDeal.lineItems))
            ? sourceDeal.lineItems.map(item => ({ ...item, id: nanoid() }))
            : [];

        const clonedDealData: Omit<Deal, 'id'> = {
            organizationId: sourceDeal.organizationId || '',
            workspaceId: sourceDeal.workspaceId,
            entityId: sourceDeal.entityId,
            pipelineId: targetPipelineId,
            stageId: targetStageId,
            stageName: targetStageName,
            name: options?.newName?.trim() || `${sourceDeal.name} (Copy)`,
            value: sourceDeal.value || 0,
            currency: sourceDeal.currency || 'USD',
            status: 'open',
            probability: sourceDeal.probability ?? 20,
            forecastCategory: sourceDeal.forecastCategory || 'pipeline',
            weightedValue: ((sourceDeal.value || 0) * (sourceDeal.probability ?? 20)) / 100,
            healthStatus: 'healthy',
            stageEnteredAt: now,
            stageHistory: [{
                stageId: targetStageId,
                stageName: targetStageName || 'Initial Stage',
                enteredAt: now,
                exitedAt: null,
                durationSeconds: null,
                changedByUserId: userId || 'system',
                notes: `Deal cloned from "${sourceDeal.name}"`
            }],
            lineItems: clonedLineItems,
            mrr: options?.copyLineItems !== false ? (sourceDeal.mrr || 0) : 0,
            arr: options?.copyLineItems !== false ? (sourceDeal.arr || 0) : 0,
            acv: options?.copyLineItems !== false ? (sourceDeal.acv || 0) : 0,
            tcv: options?.copyLineItems !== false ? (sourceDeal.tcv || 0) : 0,
            oneTimeValue: options?.copyLineItems !== false ? (sourceDeal.oneTimeValue || 0) : 0,
            recurringValue: options?.copyLineItems !== false ? (sourceDeal.recurringValue || 0) : 0,
            contractTermMonths: sourceDeal.contractTermMonths || 12,
            priceBookId: sourceDeal.priceBookId || null,
            contractStatus: 'none',
            contacts: options?.copyContacts !== false ? (sourceDeal.contacts || []) : [],
            focalContacts: options?.copyContacts !== false ? (sourceDeal.focalContacts || []) : [],
            assignedTo: sourceDeal.assignedTo || null,
            expectedCloseDate: expectedCloseDate || null,
            description: sourceDeal.description || null,
            source: 'manual',
            customFields: options?.copyCustomFields !== false ? (sourceDeal.customFields || {}) : {},
            tags: sourceDeal.tags || [],
            isArchived: false,
            createdAt: now,
            updatedAt: now,
        };

        const newDocRef = await adminDb.collection('deals').add(clonedDealData);

        await logActivity({
            organizationId: sourceDeal.organizationId || '',
            entityId: sourceDeal.entityId || null,
            userId: userId || null,
            workspaceId: sourceDeal.workspaceId,
            type: 'deal_created',
            source: 'user',
            description: `duplicated deal "${sourceDeal.name}" to create "${clonedDealData.name}"`,
            metadata: { originalDealId: dealId, newDealId: newDocRef.id }
        });

        return { success: true, newDealId: newDocRef.id };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to duplicate deal';
        console.error('❌ Failed to duplicate deal:', error);
        return { success: false, error };
    }
}

/**
 * ARCHITECTURAL POINTER (Phase 1 - Soft-Archiving):
 * Soft-archives a deal without physical deletion, preserving all data and timeline history.
 */
export async function archiveDealAction(
    dealId: string,
    userId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!dealId) return { success: false, error: 'Deal ID is required' };

        const dealDoc = await adminDb.collection('deals').doc(dealId).get();
        if (!dealDoc.exists) return { success: false, error: 'Deal not found' };

        const deal = dealDoc.data() as Deal;
        if (userId && deal.workspaceId) {
            const perm = await canUser(userId, 'operations', 'pipeline', 'edit', deal.workspaceId);
            if (!perm.granted) return { success: false, error: perm.reason };
        }

        const now = new Date().toISOString();
        await adminDb.collection('deals').doc(dealId).update({
            isArchived: true,
            archivedAt: now,
            archivedBy: userId || null,
            updatedAt: now
        });

        await logActivity({
            organizationId: deal.organizationId || '',
            entityId: deal.entityId || null,
            userId: userId || null,
            workspaceId: deal.workspaceId,
            type: 'deal_archived',
            source: 'user',
            description: `archived deal "${deal.name}"`,
            metadata: { dealId }
        });

        return { success: true };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to archive deal';
        return { success: false, error };
    }
}

/**
 * Restores a soft-archived deal back into active pipeline tracking.
 */
export async function unarchiveDealAction(
    dealId: string,
    userId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!dealId) return { success: false, error: 'Deal ID is required' };

        const dealDoc = await adminDb.collection('deals').doc(dealId).get();
        if (!dealDoc.exists) return { success: false, error: 'Deal not found' };

        const deal = dealDoc.data() as Deal;
        if (userId && deal.workspaceId) {
            const perm = await canUser(userId, 'operations', 'pipeline', 'edit', deal.workspaceId);
            if (!perm.granted) return { success: false, error: perm.reason };
        }

        const now = new Date().toISOString();
        await adminDb.collection('deals').doc(dealId).update({
            isArchived: false,
            archivedAt: null,
            archivedBy: null,
            updatedAt: now
        });

        await logActivity({
            organizationId: deal.organizationId || '',
            entityId: deal.entityId || null,
            userId: userId || null,
            workspaceId: deal.workspaceId,
            type: 'deal_restored',
            source: 'user',
            description: `restored deal "${deal.name}" from archive`,
            metadata: { dealId }
        });

        return { success: true };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to restore deal';
        return { success: false, error };
    }
}

/**
 * Bulk soft-archives an array of deals.
 */
export async function bulkArchiveDealsAction(
    dealIds: string[],
    workspaceId: string,
    userId?: string
): Promise<{ success: boolean; archivedCount: number; error?: string }> {
    try {
        if (!dealIds || dealIds.length === 0 || !workspaceId) {
            return { success: false, archivedCount: 0, error: 'Missing required parameters' };
        }

        if (userId) {
            const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
            if (!permission.granted) {
                return { success: false, archivedCount: 0, error: permission.reason };
            }
        }

        const chunkSize = 200;
        let totalArchived = 0;
        const now = new Date().toISOString();

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
                            isArchived: true,
                            archivedAt: now,
                            archivedBy: userId || null,
                            updatedAt: now
                        });
                        batchOps++;
                    }
                }
            }

            if (batchOps > 0) {
                await batch.commit();
                totalArchived += batchOps;
            }
        }

        await logActivity({
            organizationId: '',
            entityId: null,
            userId: userId || null,
            workspaceId,
            type: 'bulk_deals_archived',
            source: 'user',
            description: `bulk archived ${totalArchived} deals`,
            metadata: { count: totalArchived }
        });

        return { success: true, archivedCount: totalArchived };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to bulk archive deals';
        return { success: false, archivedCount: 0, error };
    }
}

/**
 * ARCHITECTURAL POINTER (Phase 1 - Deal Merge Engine):
 * Merges two deals into a single designated Master Record:
 * - Unites associated secondary contacts & focal contacts (deduplicated).
 * - Combines products/line items and recalculates grand totals.
 * - Re-associates operational tasks/notes from secondary deal to master deal.
 * - Soft-archives secondary deal with status = 'cancelled', outcome = 'duplicate', mergedIntoDealId = masterId.
 * - Never permanently deletes the secondary record, preserving auditability.
 */
export async function mergeDealsAction(
    options: DealMergeOptions,
    workspaceId: string,
    userId?: string
): Promise<DealMergeResult> {
    try {
        const { masterDealId, secondaryDealId } = options;
        if (!masterDealId || !secondaryDealId || masterDealId === secondaryDealId) {
            return {
                success: false,
                masterDealId,
                secondaryDealId,
                mergedContactsCount: 0,
                mergedLineItemsCount: 0,
                error: 'Valid master and distinct secondary deal IDs are required.'
            };
        }

        if (userId) {
            const perm = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
            if (!perm.granted) {
                return {
                    success: false,
                    masterDealId,
                    secondaryDealId,
                    mergedContactsCount: 0,
                    mergedLineItemsCount: 0,
                    error: perm.reason
                };
            }
        }

        const [masterSnap, secondarySnap] = await adminDb.getAll(
            adminDb.collection('deals').doc(masterDealId),
            adminDb.collection('deals').doc(secondaryDealId)
        );

        if (!masterSnap.exists || !secondarySnap.exists) {
            return {
                success: false,
                masterDealId,
                secondaryDealId,
                mergedContactsCount: 0,
                mergedLineItemsCount: 0,
                error: 'One or both deals could not be found.'
            };
        }

        const masterDeal = masterSnap.data() as Deal;
        const secondaryDeal = secondarySnap.data() as Deal;

        if (masterDeal.workspaceId !== workspaceId || secondaryDeal.workspaceId !== workspaceId) {
            return {
                success: false,
                masterDealId,
                secondaryDealId,
                mergedContactsCount: 0,
                mergedLineItemsCount: 0,
                error: 'Cannot merge deals across different workspaces.'
            };
        }

        const now = new Date().toISOString();

        // 1. Merge Contacts & Focal Contacts
        let mergedContacts: DealContact[] = masterDeal.contacts || [];
        let mergedFocalContacts: DealFocalContact[] = masterDeal.focalContacts || [];
        let mergedContactsCount = 0;

        if (options.mergeContacts) {
            const contactIdSet = new Set((masterDeal.contacts || []).map(c => c.entityId || c.email));
            const extraContacts = (secondaryDeal.contacts || []).filter(c => !contactIdSet.has(c.entityId || c.email));
            mergedContacts = [...(masterDeal.contacts || []), ...extraContacts];

            const focalIdSet = new Set((masterDeal.focalContacts || []).map(f => f.id || f.email));
            const extraFocals = (secondaryDeal.focalContacts || []).filter(f => !focalIdSet.has(f.id || f.email));
            mergedFocalContacts = [...(masterDeal.focalContacts || []), ...extraFocals];

            mergedContactsCount = extraContacts.length + extraFocals.length;
        }

        // 2. Merge Line Items
        let mergedLineItems: DealLineItem[] = masterDeal.lineItems || [];
        let mergedLineItemsCount = 0;
        let finalValue = options.resolvedValue;

        if (options.mergeLineItems && Array.isArray(secondaryDeal.lineItems) && secondaryDeal.lineItems.length > 0) {
            const secondaryItemsWithNewIds = secondaryDeal.lineItems.map(item => ({
                ...item,
                id: nanoid()
            }));
            mergedLineItems = [...(masterDeal.lineItems || []), ...secondaryItemsWithNewIds];
            mergedLineItemsCount = secondaryItemsWithNewIds.length;

            const totals = calculateLineItemsTotals(mergedLineItems, masterDeal.contractTermMonths || 12);
            if (totals.grandTotal > 0) {
                finalValue = totals.grandTotal;
            }
        }

        const effectiveTotals = calculateLineItemsTotals(mergedLineItems, masterDeal.contractTermMonths || 12);

        // 3. Merge Custom Fields
        const mergedCustomFields = options.mergeCustomFields
            ? { ...(secondaryDeal.customFields || {}), ...(masterDeal.customFields || {}) }
            : (masterDeal.customFields || {});

        // 4. Merge Tags
        const mergedTags = Array.from(new Set([...(masterDeal.tags || []), ...(secondaryDeal.tags || [])]));

        // 5. Reassign Tasks
        if (options.mergeTasksAndNotes) {
            try {
                const tasksSnap = await adminDb.collection('tasks')
                    .where('relatedEntityId', '==', secondaryDealId)
                    .get();

                if (!tasksSnap.empty) {
                    const taskBatch = adminDb.batch();
                    tasksSnap.docs.forEach(d => {
                        taskBatch.update(d.ref, {
                            relatedEntityId: masterDealId,
                            updatedAt: now
                        });
                    });
                    await taskBatch.commit();
                }
            } catch (taskErr) {
                console.error('Warning: Failed to reassign tasks during merge:', taskErr);
            }
        }

        // 6. Update Master Deal
        await adminDb.collection('deals').doc(masterDealId).update({
            name: options.resolvedName.trim(),
            value: finalValue,
            pipelineId: options.resolvedPipelineId,
            stageId: options.resolvedStageId,
            expectedCloseDate: options.resolvedCloseDate || masterDeal.expectedCloseDate || null,
            assignedTo: options.resolvedAssignedTo !== undefined ? options.resolvedAssignedTo : masterDeal.assignedTo,
            contacts: mergedContacts,
            focalContacts: mergedFocalContacts,
            lineItems: mergedLineItems,
            mrr: effectiveTotals.mrr,
            arr: effectiveTotals.arr,
            acv: effectiveTotals.acv,
            tcv: effectiveTotals.tcv,
            oneTimeValue: effectiveTotals.oneTimeValue,
            recurringValue: effectiveTotals.recurringValue,
            customFields: mergedCustomFields,
            tags: mergedTags,
            updatedAt: now
        });

        // 7. Soft-Archive Secondary Deal
        await adminDb.collection('deals').doc(secondaryDealId).update({
            isArchived: true,
            status: 'cancelled',
            lostReason: `Merged into master deal "${options.resolvedName.trim()}" (${masterDealId})`,
            mergedIntoDealId: masterDealId,
            archivedAt: now,
            archivedBy: userId || null,
            updatedAt: now
        });

        // 8. Log Activity
        await logActivity({
            organizationId: masterDeal.organizationId || '',
            entityId: masterDeal.entityId || null,
            userId: userId || null,
            workspaceId,
            type: 'deal_merged',
            source: 'user',
            description: `merged deal "${secondaryDeal.name}" into "${options.resolvedName.trim()}"`,
            metadata: { masterDealId, secondaryDealId, mergedContactsCount, mergedLineItemsCount }
        });

        return {
            success: true,
            masterDealId,
            secondaryDealId,
            mergedContactsCount,
            mergedLineItemsCount
        };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to merge deals';
        console.error('❌ Failed to merge deals:', error);
        return {
            success: false,
            masterDealId: options.masterDealId,
            secondaryDealId: options.secondaryDealId,
            mergedContactsCount: 0,
            mergedLineItemsCount: 0,
            error
        };
    }
}

/**
 * ============================================================================
 * PHASE 3: CRM ACTIVITY GRAPH & LEAD-TO-DEAL CONVERSION ACTIONS (PRD §24, §25, §120)
 * ============================================================================
 * 
 * Architectural Pointers:
 * - Converts a prospect / lead into a first-class Deal opportunity record in the target pipeline.
 * - Preserves complete marketing attribution (source, campaignId, leadScore) and stakeholder contacts.
 * - Stamps the original lead record with conversion metadata (isConverted, convertedAt, convertedDealId).
 * - Enforces canUser RBAC multi-tenant isolation and logs dealId-scoped activities to the platform Event Bus.
 * 
 * Caution Areas for Future Maintainers:
 * - Lead entity lookup resolves across composite workspace_entities keys and canonical entities collection.
 * - Original lead is NEVER deleted upon conversion; it is marked as converted for 360° auditability.
 * 
 * Testability Pointers:
 * - Unit tests in deal-actions.phase3.test.ts verify permission checks, attribution mapping, and deal creation.
 */
export async function convertLeadToDealAction(
    options: LeadConversionOptions
): Promise<LeadConversionResult> {
    try {
        const {
            leadEntityId,
            pipelineId,
            stageId: requestedStageId,
            dealName,
            value = 0,
            expectedCloseDate,
            assignedTo,
            focalContactIds = [],
            notes,
            userId,
            workspaceId
        } = options;

        if (!leadEntityId || !pipelineId || !userId || !workspaceId) {
            return { success: false, error: 'Missing required parameters for lead conversion.' };
        }

        // 1. Permission Check
        const permission = await canUser(userId, 'operations', 'pipeline', 'create', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason || 'Unauthorized to create opportunities.' };
        }

        // 2. Resolve Lead Entity Record
        const entityRecord = await resolveWorkspaceEntityRecord(workspaceId, leadEntityId);
        if (!entityRecord) {
            return { success: false, error: 'Lead entity not found in target workspace.' };
        }

        const now = new Date().toISOString();
        const organizationId = entityRecord.organizationId || 'default';

        // 3. Resolve Target Pipeline Stages
        const stagesSnap = await adminDb.collection('onboardingStages')
            .where('pipelineId', '==', pipelineId)
            .get();

        if (stagesSnap.empty) {
            return { success: false, error: 'Target pipeline has no configured stages.' };
        }

        const sortedStages = stagesSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as OnboardingStage))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const targetStage = requestedStageId
            ? (sortedStages.find(s => s.id === requestedStageId) || sortedStages[0])
            : sortedStages[0];

        const resolvedStageId = targetStage.id;
        const stageProbability = typeof targetStage.probability === 'number' ? targetStage.probability : 20;

        // 4. Resolve Expected Close Date
        let resolvedCloseDate = expectedCloseDate;
        if (!resolvedCloseDate) {
            const pipelineDoc = await adminDb.collection('pipelines').doc(pipelineId).get();
            const pipelineConfig = pipelineDoc.exists ? pipelineDoc.data() as import('../admin/pipeline/utils/deal-expected-close').PipelineOffsetConfig : null;
            const calculated = calculateExpectedCloseDate(pipelineConfig, null, new Date(now), targetStage.slaDays || 30);
            resolvedCloseDate = calculated || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        // 5. Map Contacts & Stakeholders
        const entityRawContacts = (entityRecord.entityContacts || entityRecord.contacts || []) as Array<{
            id?: string;
            entityId?: string;
            name?: string;
            email?: string;
            phone?: string;
            typeLabel?: string;
            role?: string;
        }>;

        const focalContacts: DealFocalContact[] = [];
        const dealContacts: DealContact[] = [];

        entityRawContacts.forEach((c, index) => {
            const cId = c.id || c.entityId || `contact_${index}`;
            const isFocal = focalContactIds.length > 0
                ? focalContactIds.includes(cId) || focalContactIds.includes(c.entityId || '')
                : index === 0; // Default first contact as focal

            if (isFocal) {
                focalContacts.push({
                    id: cId,
                    name: c.name || 'Unnamed Contact',
                    email: c.email,
                    phone: c.phone,
                    role: c.role || c.typeLabel || 'Primary Contact',
                });
            } else {
                dealContacts.push({
                    entityId: cId,
                    name: c.name || 'Unnamed Contact',
                    email: c.email,
                    role: c.role || c.typeLabel || 'Stakeholder',
                });
            }
        });

        // 6. Create Deal Record
        const dealRef = adminDb.collection('deals').doc();
        const dealId = dealRef.id;
        const resolvedDealName = dealName?.trim() || entityRecord.displayName || 'Converted Lead Deal';
        const numValue = typeof value === 'number' && value >= 0 ? value : 0;
        const weightedValue = Math.round(numValue * (stageProbability / 100) * 100) / 100;

        const newDeal: Partial<Deal> = {
            id: dealId,
            entityId: leadEntityId,
            workspaceId,
            organizationId,
            pipelineId,
            stageId: resolvedStageId,
            stageName: targetStage.name || 'Initial',
            name: resolvedDealName,
            value: numValue,
            status: 'open',
            source: (entityRecord.source || entityRecord.utmSource || 'lead_conversion') as Deal['source'],
            campaignId: entityRecord.campaignId || entityRecord.utmCampaign || undefined,
            leadId: leadEntityId,
            assignedTo: assignedTo || null,
            focalContacts,
            contacts: dealContacts,
            expectedCloseDate: resolvedCloseDate,
            probability: stageProbability,
            weightedValue,
            stageEnteredAt: now,
            stageHistory: [{
                stageId: resolvedStageId,
                stageName: targetStage.name || 'Initial',
                enteredAt: now,
                durationSeconds: 0,
                changedByUserId: userId,
            }],
            customFields: (entityRecord.customData || {}) as Record<string, string | number | boolean | null>,
            tags: entityRecord.workspaceTags || [],
            isArchived: false,
            createdAt: now,
            updatedAt: now,
        };

        const batch = adminDb.batch();
        batch.set(dealRef, newDeal);

        // 7. Stamp Conversion on Lead Record (both in workspace_entities & canonical entities if present)
        const leadUpdateData = {
            isConverted: true,
            convertedAt: now,
            convertedBy: userId,
            convertedDealId: dealId,
            updatedAt: now,
        };

        const cleanLeadId = leadEntityId.startsWith(`${workspaceId}_`) ? leadEntityId.slice(workspaceId.length + 1) : leadEntityId;
        const weRef = adminDb.collection('workspace_entities').doc(`${workspaceId}_${cleanLeadId}`);
        batch.set(weRef, leadUpdateData, { merge: true });

        // Optional Handover Note
        if (notes && notes.trim().length > 0) {
            const noteRef = adminDb.collection('notes').doc();
            batch.set(noteRef, {
                id: noteRef.id,
                entityId: leadEntityId,
                dealId,
                workspaceId,
                organizationId,
                authorId: userId,
                content: notes.trim(),
                createdAt: now,
                updatedAt: now,
            });
        }

        await batch.commit();

        // 8. Log Conversion Activity on Unified Event Bus
        await logActivity({
            organizationId,
            workspaceId,
            entityId: leadEntityId,
            dealId,
            userId,
            type: 'lead_converted',
            source: 'user',
            description: `converted lead "${entityRecord.displayName}" into deal "${resolvedDealName}"`,
            metadata: {
                dealId,
                dealName: resolvedDealName,
                pipelineId,
                stageId: resolvedStageId,
                stageName: targetStage.name,
                value: numValue,
                leadEntityId,
            }
        });

        revalidatePath('/admin/pipeline');
        revalidatePath('/admin/deals');
        revalidatePath('/admin/entities');
        revalidatePath(`/admin/entities/${leadEntityId}`);
        revalidatePath(`/admin/deals/${dealId}`);

        return {
            success: true,
            dealId,
            leadEntityId,
        };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to convert lead to deal';
        console.error('❌ [CONVERT:LEAD_TO_DEAL] Failed:', error);
        return { success: false, error };
    }
}

/**
 * Logs a multi-channel CRM interaction (Call, Meeting, Email, WhatsApp, SMS, Note) on a Deal
 */
export async function logDealInteractionAction(
    dealId: string,
    interactionData: DealInteractionData,
    userId: string,
    workspaceId: string
): Promise<DealInteractionResult> {
    try {
        if (!dealId || !interactionData || !userId || !workspaceId) {
            return { success: false, error: 'Missing required parameters for logging deal interaction.' };
        }

        // 1. Permission Check
        const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason || 'Unauthorized to edit deals.' };
        }

        // 2. Fetch Deal Record
        const dealSnap = await adminDb.collection('deals').doc(dealId).get();
        if (!dealSnap.exists) {
            return { success: false, error: 'Deal record not found.' };
        }

        const deal = { id: dealSnap.id, ...dealSnap.data() } as Deal;
        const now = new Date().toISOString();
        const organizationId = deal.organizationId || 'default';

        // 3. Map Interaction Type to Activity Event Type
        const activityTypeMap: Record<string, string> = {
            call: 'call_logged',
            meeting: 'meeting_completed',
            email: 'email_sent',
            whatsapp: 'whatsapp_sent',
            sms: 'sms_sent',
            note: 'note_added',
        };

        const eventType = activityTypeMap[interactionData.type] || 'deal_interaction';

        // 4. Construct Descriptive Audit Text
        const subject = interactionData.subject.trim();
        const description = interactionData.description?.trim()
            ? `${subject} — ${interactionData.description.trim()}`
            : subject;

        // 5. Log Activity with Top-Level dealId
        await logActivity({
            organizationId,
            workspaceId: deal.workspaceId || workspaceId,
            entityId: deal.entityId || null,
            dealId: deal.id,
            userId,
            type: eventType,
            source: 'user',
            description,
            metadata: {
                dealId: deal.id,
                dealName: deal.name,
                interactionType: interactionData.type,
                outcome: interactionData.outcome || null,
                durationMinutes: interactionData.durationMinutes || null,
                recipientContactId: interactionData.recipientContactId || null,
                recipientName: interactionData.recipientName || null,
                recipientPhone: interactionData.recipientPhone || null,
                recipientEmail: interactionData.recipientEmail || null,
                locationOrPlatform: interactionData.locationOrPlatform || null,
                occurredAt: interactionData.occurredAt || now,
            }
        });

        // 6. Touch Deal Timestamp
        await adminDb.collection('deals').doc(dealId).update({
            updatedAt: now,
        });

        revalidatePath(`/admin/deals/${dealId}`);
        revalidatePath('/admin/pipeline');

        return { success: true };
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : 'Failed to log deal interaction';
        console.error('❌ [DEAL:LOG_INTERACTION] Failed:', error);
        return { success: false, error };
    }
}


