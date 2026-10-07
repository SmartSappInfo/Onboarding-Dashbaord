'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/firebase-admin';
import type { 
    Deal, 
    Pipeline,
    DealContact, 
    DealFocalContact, 
    DealDuplicateOptions, 
    DealMergeOptions, 
    DealMergeResult, 
    DealLineItem,
    TransferDealInput,
    TransferDealResult
} from '@/lib/types';
import { logActivity } from '@/lib/activity-logger';
import { canUser } from '@/lib/workspace-permissions';
import { calculateExpectedCloseDate } from '../admin/pipeline/utils/deal-expected-close';
import { triggerAutomationProtocols } from '@/lib/automations/orchestrator';
import { calculateLineItemsTotals } from '@/lib/deals/deal-health-engine';
import { emitDealDomainEvent } from '@/lib/deals/deal-event-bus';
import { 
    resolveStageTerminalStatus, 
} from '@/lib/deals/deal-stage-validation';
import type { 
    LeadConversionOptions, 
    LeadConversionResult, 
    DealInteractionData, 
    DealInteractionResult,
    CreateDealWithNewEntityParams,
    CreateDealWithNewEntityResult,
} from '@/lib/deals/deal-types';
import { transferDealCore } from '@/lib/deals/deal-transfer-core';
import { z } from 'zod';
import { createEntityCore } from '@/lib/crm/entity-core';
import type { OnboardingStage } from '@/lib/types';
import { nanoid } from 'nanoid';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import {
    type CrmActor,
    type DealCreationData,
    type DealPermissionAction,
    type UpdateDealStageOptions,
    actorAttributionUid,
    checkDealPlacement,
    checkPipelinePermission,
    createDealCore,
    loadAuthorizedDeal,
    resolveWorkspaceEntityRecord,
    updateDealOwnerCore,
    updateDealStageCore,
    updateDealStatusCore,
    updateDealValueCore,
    workspaceOrganizationId,
} from '@/lib/crm/deal-core';

/*
 * SECURITY (agents_mcp PR-1 / N1): the deal logic lives in `src/lib/crm/deal-core.ts`, which is
 * NOT a Server Action module. Every export below is a public endpoint, so each one:
 * - takes identity from the session only (any caller-supplied `userId` was removed);
 * - authorizes against the deal's STORED workspace (the core does this), or the workspace named
 *   in the request after `requireWorkspace` has confirmed membership.
 * Trusted server code (automations, call centre, forms, surveys, bulk jobs, MCP) must import the
 * core directly with an explicit actor instead of calling these wrappers.
 */
export type { AssignmentStrategy, UpdateDealStageOptions } from '@/lib/crm/deal-core';

/** Fields that identify a deal or its tenant; client updates may never change them. */
const IMMUTABLE_DEAL_FIELDS = ['id', 'workspaceId', 'organizationId', 'createdAt'] as const;

/** The signed-in user as a deal actor. Workspace access is checked by the core per record. */
async function sessionActor(): Promise<CrmActor> {
    const { uid } = await requireAuth();
    return { kind: 'user', uid };
}

/**
 * Session check for actions that name a workspace: membership (requireWorkspace) plus the
 * operations/pipeline permission. Returns the verified uid or the reason for refusal.
 */
async function authorizeWorkspacePipeline(
    workspaceId: string,
    action: DealPermissionAction
): Promise<{ ok: true; uid: string } | { ok: false; error: string }> {
    const { uid } = await requireWorkspace(workspaceId);
    const permission = await checkPipelinePermission({ kind: 'user', uid }, workspaceId, action);
    return permission.granted ? { ok: true, uid } : { ok: false, error: permission.reason };
}

export async function createDeal(data: DealCreationData): Promise<{ id?: string; error?: string }> {
    const { uid } = await requireWorkspace(data.workspaceId);
    return createDealCore({ kind: 'user', uid }, data);
}

const NewEntityDealInputSchema = z.object({
    workspaceId: z.string().min(1, 'Workspace ID is required'),
    organizationId: z.string().min(1, 'Organization ID is required'),
    entity: z.object({
        name: z.string().min(1, 'Entity name is required'),
        entityType: z.enum(['institution', 'person', 'family']).optional(),
        primaryContact: z.object({
            name: z.string().min(1, 'Primary contact name is required'),
            phone: z.string().optional(),
            email: z.string().optional(),
            role: z.string().optional(),
        }).refine(data => Boolean((data.phone && data.phone.trim().length > 0) || (data.email && data.email.trim().length > 0)), {
            message: 'Please provide at least a phone number or an email address.',
            path: ['phone'],
        }),
    }),
    deal: z.object({
        pipelineId: z.string().min(1, 'Pipeline is required'),
        stageId: z.string().optional(),
        name: z.string().min(1, 'Deal name is required'),
        value: z.number().min(0).default(0),
        description: z.string().nullable().optional(),
        expectedCloseDate: z.string().nullable().optional(),
        assignmentStrategy: z.enum(['direct', 'unassigned', 'round-robin', 'value-based']).optional(),
        assignedTo: z.object({
            userId: z.string().nullable(),
            name: z.string().nullable(),
            email: z.string().nullable(),
        }).optional(),
        suppressAutomations: z.boolean().optional(),
    }),
});

/**
 * ARCHITECTURAL POINTER (Atomic Entity & Deal Composite Creation):
 * Implements Inline Entity & Primary Contact Creation when initiating a deal.
 *
 * 1. Validates input schema via NewEntityDealInputSchema (Rule 4 strict typing).
 * 2. Authenticates session via requireWorkspace(workspaceId).
 * 3. Enforces RBAC permissions: user must have permissions to create entities
 *    and create deals in this workspace.
 * 4. Calls createEntityCore to initialize the entity, create the primary & signatory contact,
 *    and register the workspace_entity link.
 * 5. Handles duplicate detection (isDuplicate) gracefully without creating orphan deals.
 * 6. Invokes createDealCore with the newly created entity ID and binds the primary contact as
 *    the deal's focal contact.
 * 7. If deal creation fails, rolls back the newly created entity documents to maintain zero-orphan invariant.
 * 8. Revalidates relevant paths and returns the created IDs.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Always preserve the contact as both primary and signatory contact on the entity.
 * - Any double-brace variable resolution in descriptions must route through FieldsVariablesService.
 */
export async function createDealWithNewEntityAction(
    rawInput: CreateDealWithNewEntityParams
): Promise<CreateDealWithNewEntityResult> {
    const parseResult = NewEntityDealInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
        return {
            success: false,
            error: parseResult.error.issues[0]?.message || 'Invalid input data.',
        };
    }

    const input = parseResult.data;
    const { uid } = await requireWorkspace(input.workspaceId);

    const contactId = nanoid(10);
    const contactName = input.entity.primaryContact.name.trim();
    const contactPhone = input.entity.primaryContact.phone?.trim() || '';
    const contactEmail = input.entity.primaryContact.email?.trim() || '';
    const contactRole = input.entity.primaryContact.role?.trim() || 'Signatory / Decision Maker';
    const entityType = input.entity.entityType || 'institution';
    const timestamp = new Date().toISOString();

    const entityPayload: Record<string, unknown> = {
        name: input.entity.name.trim(),
        primaryEmail: contactEmail || undefined,
        primaryPhone: contactPhone || undefined,
        entityContacts: [
            {
                id: contactId,
                name: contactName,
                phone: contactPhone,
                email: contactEmail,
                type: contactRole,
                typeLabel: contactRole,
                typeKey: 'other' as const,
                isPrimary: true,
                isSignatory: true,
                order: 0,
                createdAt: timestamp,
                updatedAt: timestamp,
            },
        ],
    };

    if (entityType === 'person') {
        const nameParts = input.entity.name.trim().split(' ');
        entityPayload.personData = {
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
        };
    }

    const entityResult = await createEntityCore(
        { kind: 'user', uid },
        {
            data: entityPayload,
            workspaceId: input.workspaceId,
            entityType,
            forceCreate: false,
        }
    );

    if (!entityResult.success || !entityResult.id) {
        return {
            success: false,
            error: entityResult.error || 'Failed to initialize entity.',
            isDuplicate: entityResult.isDuplicate,
            duplicates: entityResult.duplicates,
        };
    }

    const newEntityId = entityResult.id;
    const focalContact: DealFocalContact = {
        id: contactId,
        name: contactName,
        email: contactEmail || undefined,
        phone: contactPhone || undefined,
        role: contactRole,
    };

    try {
        const dealResult = await createDealCore(
            { kind: 'user', uid },
            {
                workspaceId: input.workspaceId,
                organizationId: input.organizationId,
                entityId: newEntityId,
                pipelineId: input.deal.pipelineId,
                stageId: input.deal.stageId,
                name: input.deal.name.trim(),
                value: input.deal.value,
                description: input.deal.description || null,
                expectedCloseDate: input.deal.expectedCloseDate || null,
                assignmentStrategy: input.deal.assignmentStrategy || 'direct',
                assignedTo: input.deal.assignedTo,
                focalContacts: [focalContact],
                suppressAutomations: input.deal.suppressAutomations,
            }
        );

        if (dealResult.error || !dealResult.id) {
            // Defensive rollback of created entity to maintain zero-orphan invariant
            try {
                const batch = adminDb.batch();
                const weDocId = `${input.workspaceId}_${newEntityId}`;
                batch.delete(adminDb.collection('workspace_entities').doc(weDocId));
                batch.delete(adminDb.collection('entities').doc(newEntityId));
                await batch.commit();
            } catch (rollbackErr) {
                console.error('[createDealWithNewEntityAction] Rollback entity failed:', rollbackErr);
            }

            return {
                success: false,
                error: dealResult.error || 'Failed to create deal for the new entity.',
            };
        }

        revalidatePath('/admin/pipeline');
        revalidatePath('/admin/entities');
        revalidatePath('/admin/deals');

        return {
            success: true,
            dealId: dealResult.id,
            entityId: newEntityId,
            focalContact,
        };
    } catch (dealErr: unknown) {
        // Defensive rollback of created entity
        try {
            const batch = adminDb.batch();
            const weDocId = `${input.workspaceId}_${newEntityId}`;
            batch.delete(adminDb.collection('workspace_entities').doc(weDocId));
            batch.delete(adminDb.collection('entities').doc(newEntityId));
            await batch.commit();
        } catch (rollbackErr) {
            console.error('[createDealWithNewEntityAction] Rollback entity failed:', rollbackErr);
        }

        return {
            success: false,
            error: dealErr instanceof Error ? dealErr.message : String(dealErr),
        };
    }
}

export async function updateDealStageAction(
    dealId: string,
    stageId: string,
    options?: UpdateDealStageOptions
): Promise<{ success: boolean; error?: string }> {
    return updateDealStageCore(await sessionActor(), dealId, stageId, options);
}

export async function updateDealValueAction(dealId: string, value: number): Promise<{ success: boolean; error?: string }> {
    return updateDealValueCore(await sessionActor(), dealId, value);
}

/**
 * Updates a deal's win probability percentage (0-100)
 */
export async function updateDealProbabilityAction(
    dealId: string,
    probability: number
): Promise<{ success: boolean; error?: string }> {
    const actor = await sessionActor();

    try {
        const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
        if (!loaded.ok) return { success: false, error: loaded.error };
        const { deal, ref: dealRef } = loaded;

        const clampedProbability = Math.max(0, Math.min(100, Math.round(probability)));
        const oldProbability = deal.probability ?? 0;
        if (oldProbability === clampedProbability) return { success: true };

        const timestamp = new Date().toISOString();
        await dealRef.update({
            probability: clampedProbability,
            updatedAt: timestamp
        });

        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: actorAttributionUid(actor),
            workspaceId: deal.workspaceId,
            type: 'deal_updated',
            source: 'user',
            description: `updated deal "${deal.name}" probability from ${oldProbability}% to ${clampedProbability}%`,
            metadata: { dealId, fromProbability: oldProbability, toProbability: clampedProbability }
        });

        return { success: true };
    } catch (e: unknown) {
        console.error('Failed to update deal probability:', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
}

export async function updateDealStatusAction(
    dealId: string,
    status: 'open' | 'won' | 'lost',
    lostReason?: string
): Promise<{ success: boolean; error?: string }> {
    return updateDealStatusCore(await sessionActor(), dealId, status, lostReason);
}

export async function updateDealOwnerAction(
    dealId: string,
    userId: string | null,
    userName: string | null,
    userEmail: string | null
): Promise<{ success: boolean; error?: string }> {
    return updateDealOwnerCore(await sessionActor(), dealId, userId, userName, userEmail);
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
        primaryContactId?: string | null;
        customFields?: Record<string, unknown>;
    }
): Promise<{ success: boolean; error?: string }> {
    const actor = await sessionActor();

    try {
        const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
        if (!loaded.ok) return { success: false, error: loaded.error };
        const { deal, ref: dealRef } = loaded;
        const placement = await checkDealPlacement(deal.workspaceId, { pipelineId: updates.pipelineId, stageId: updates.stageId });
        if (!placement.granted) return { success: false, error: placement.reason };

        const timestamp = new Date().toISOString();
        // ARCHITECTURAL POINTER (Rule 10): Strip undefined values so Firestore does not reject with invalid argument
        const cleanUpdates: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(updates)) {
            if (v !== undefined) {
                cleanUpdates[k] = v;
            }
        }
        cleanUpdates.updatedAt = timestamp;

        await dealRef.update(cleanUpdates);

        // Simple activity logging for general updates
        await logActivity({
            organizationId: deal.organizationId,
            entityId: deal.entityId,
            userId: actorAttributionUid(actor),
            workspaceId: deal.workspaceId,
            type: 'deal_updated',
            source: 'user',
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
    const actor = await sessionActor();

    try {
        const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
        if (!loaded.ok) return { success: false, error: loaded.error };
        const { deal, ref: dealRef } = loaded;

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
            email: entity.primaryEmail || '',
            phone: entity.primaryPhone || entity.entityContacts?.find(ec => ec.isPrimary)?.phone || ''
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
            userId: actorAttributionUid(actor),
            workspaceId: deal.workspaceId,
            type: 'deal_updated',
            source: 'user',
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
    const actor = await sessionActor();

    try {
        const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
        if (!loaded.ok) return { success: false, error: loaded.error };
        const { deal, ref: dealRef } = loaded;

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
            userId: actorAttributionUid(actor),
            workspaceId: deal.workspaceId,
            type: 'deal_updated',
            source: 'user',
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
    workspaceId: string
): Promise<{ success: boolean; error?: string; count?: number }> {
    // SECURITY (N1): identity from the session. Deleting deals has always required pipeline 'edit'.
    const auth = await authorizeWorkspacePipeline(workspaceId, 'edit');
    if (!auth.ok) return { success: false, error: auth.error };
    const userId = auth.uid;

    try {

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
    workspaceId: string
): Promise<{ success: boolean; error?: string }> {
    const actor = await sessionActor();
    const userId = actorAttributionUid(actor);

    try {
        if (!dealId || !workspaceId) {
            return { success: false, error: 'Missing dealId or workspaceId' };
        }

        // SECURITY (N1): authorized against the deal's STORED workspace, not the one in the request.
        const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
        if (!loaded.ok) return { success: false, error: loaded.error };
        const { deal, ref: dealRef } = loaded;

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
export async function cleanLegacyDealNamesAction(params: {
    workspaceId: string;
}): Promise<{ success: boolean; totalChecked: number; updatedCount: number; errors?: string[] }> {
    // SECURITY (N1): this used to scan every tenant's deals when no workspace was given.
    // It is now always scoped to one workspace the session user can edit.
    const { workspaceId } = params;
    const auth = await authorizeWorkspacePipeline(workspaceId, 'edit');
    if (!auth.ok) return { success: false, totalChecked: 0, updatedCount: 0, errors: [auth.error] };

    try {
        const dealsQuery: FirebaseFirestore.Query = adminDb.collection('deals').where('workspaceId', '==', workspaceId);

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
    workspaceId: string
): Promise<{ success: boolean; error?: string }> {
    const auth = await authorizeWorkspacePipeline(workspaceId, 'edit');
    if (!auth.ok) return { success: false, error: auth.error };

    try {
        if (!pipelineId || !orderedStageIds || orderedStageIds.length === 0) {
            return { success: false, error: 'Pipeline ID and stage IDs are required.' };
        }

        // SECURITY (N1): the pipeline must be shared to this workspace, and every stage must belong
        // to that pipeline. Otherwise any user could reorder another tenant's stages by id.
        const pipelineSnap = await adminDb.collection('pipelines').doc(pipelineId).get();
        const pipelineWorkspaces: unknown = pipelineSnap.exists ? pipelineSnap.get('workspaceIds') : undefined;
        if (!Array.isArray(pipelineWorkspaces) || !pipelineWorkspaces.includes(workspaceId)) {
            return { success: false, error: 'Pipeline not found.' };
        }
        const stageSnaps = await adminDb.getAll(...orderedStageIds.map((id) => adminDb.collection('onboardingStages').doc(id)));
        if (stageSnaps.some((snap) => !snap.exists || snap.get('pipelineId') !== pipelineId)) {
            return { success: false, error: 'One or more stages do not belong to this pipeline.' };
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
    workspaceId: string
): Promise<{ success: boolean; error?: string }> {
    const actor = await sessionActor();
    const userId = actorAttributionUid(actor);

    try {
        if (!dealId || !workspaceId) {
            return { success: false, error: 'Missing dealId or workspaceId' };
        }

        // SECURITY (N1): checked against the deal's STORED workspace.
        const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
        if (!loaded.ok) return { success: false, error: loaded.error };
        const { deal: currentData, ref: dealRef } = loaded;
        if (currentData.workspaceId !== workspaceId) {
            return { success: false, error: 'Unauthorized: Deal belongs to a different workspace.' };
        }

        // SECURITY (N1): a deal can never be moved to another tenant or re-identified by an update.
        for (const field of IMMUTABLE_DEAL_FIELDS) delete updates[field];
        const placement = await checkDealPlacement(currentData.workspaceId, { pipelineId: updates.pipelineId, stageId: updates.stageId });
        if (!placement.granted) return { success: false, error: placement.reason };

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
    workspaceId: string
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    // SECURITY (N1): identity from the session; only deals stored in this workspace are touched.
    const auth = await authorizeWorkspacePipeline(workspaceId, 'edit');
    if (!auth.ok) return { success: false, updatedCount: 0, error: auth.error };
    const userId = auth.uid;

    try {
        if (!dealIds || dealIds.length === 0 || !targetStageId || !workspaceId) {
            return { success: false, updatedCount: 0, error: 'Missing required parameters' };
        }

        const placement = await checkDealPlacement(workspaceId, { stageId: targetStageId });
        if (!placement.granted) return { success: false, updatedCount: 0, error: placement.reason };

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
                    if (data.workspaceId === workspaceId) {
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
                        if (d.workspaceId === workspaceId) {
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
    workspaceId: string
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    // SECURITY (N1): identity from the session; only deals stored in this workspace are touched.
    const auth = await authorizeWorkspacePipeline(workspaceId, 'edit');
    if (!auth.ok) return { success: false, updatedCount: 0, error: auth.error };
    const userId = auth.uid;

    try {
        if (!dealIds || dealIds.length === 0 || !workspaceId) {
            return { success: false, updatedCount: 0, error: 'Missing required parameters' };
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
                    if (data.workspaceId === workspaceId) {
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
    workspaceId: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    // SECURITY (N1): identity from the session; only deals stored in this workspace are touched.
    const auth = await authorizeWorkspacePipeline(workspaceId, 'edit');
    if (!auth.ok) return { success: false, deletedCount: 0, error: auth.error };
    const userId = auth.uid;

    try {
        if (!dealIds || dealIds.length === 0 || !workspaceId) {
            return { success: false, deletedCount: 0, error: 'Missing required parameters' };
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
                    if (data.workspaceId === workspaceId) {
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
    options?: DealDuplicateOptions
): Promise<{ success: boolean; newDealId?: string; error?: string }> {
    const actor = await sessionActor();
    const userId = actorAttributionUid(actor);

    try {
        if (!dealId) {
            return { success: false, error: 'Deal ID is required' };
        }

        // SECURITY (N1): the copy lands in the source deal's own workspace, so 'create' is checked there.
        const loaded = await loadAuthorizedDeal(actor, dealId, 'create');
        if (!loaded.ok) return { success: false, error: loaded.error };
        const sourceDeal = loaded.deal;

        // FU-15: a requested target pipeline / stage must be shared to the source deal's workspace.
        const placement = await checkDealPlacement(sourceDeal.workspaceId, {
            pipelineId: options?.targetPipelineId,
            stageId: options?.targetStageId,
        });
        if (!placement.granted) return { success: false, error: placement.reason };

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
 * ARCHITECTURAL POINTER (Cross-Workspace Deal Transfer & Cloning - Rule 10, Rule 69 & agents_mcp_rules):
 * Moves or copies a Deal across pipelines and workspaces.
 * Delegates directly to canonical transferDealCore (Single Source of Truth shared with Automations & MCP).
 */
export async function transferDealAction(
    input: TransferDealInput
): Promise<TransferDealResult> {
    const actor = await sessionActor();
    return transferDealCore(actor, input);
}

/**
 * ARCHITECTURAL POINTER (Phase 1 - Soft-Archiving):
 * Soft-archives a deal without physical deletion, preserving all data and timeline history.
 */
export async function archiveDealAction(
    dealId: string
): Promise<{ success: boolean; error?: string }> {
    const actor = await sessionActor();
    const userId = actorAttributionUid(actor);

    try {
        if (!dealId) return { success: false, error: 'Deal ID is required' };

        const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
        if (!loaded.ok) return { success: false, error: loaded.error };
        const deal = loaded.deal;

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
    dealId: string
): Promise<{ success: boolean; error?: string }> {
    const actor = await sessionActor();
    const userId = actorAttributionUid(actor);

    try {
        if (!dealId) return { success: false, error: 'Deal ID is required' };

        const loaded = await loadAuthorizedDeal(actor, dealId, 'edit');
        if (!loaded.ok) return { success: false, error: loaded.error };
        const deal = loaded.deal;

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
    workspaceId: string
): Promise<{ success: boolean; archivedCount: number; error?: string }> {
    // SECURITY (N1): identity from the session; only deals stored in this workspace are touched.
    const auth = await authorizeWorkspacePipeline(workspaceId, 'edit');
    if (!auth.ok) return { success: false, archivedCount: 0, error: auth.error };
    const userId = auth.uid;

    try {
        if (!dealIds || dealIds.length === 0 || !workspaceId) {
            return { success: false, archivedCount: 0, error: 'Missing required parameters' };
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
                    if (data.workspaceId === workspaceId) {
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
    workspaceId: string
): Promise<DealMergeResult> {
    // SECURITY (audit F2 / N1): identity comes from the session only.
    const { uid: userId } = await requireWorkspace(workspaceId);

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
    // SECURITY (N1): identity comes from the session; the caller used to supply `userId`.
    const { uid: userId } = await requireWorkspace(options.workspaceId);

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
            workspaceId
        } = options;

        if (!leadEntityId || !pipelineId || !workspaceId) {
            return { success: false, error: 'Missing required parameters for lead conversion.' };
        }

        // 1. Permission Check
        const permission = await canUser(userId, 'operations', 'pipeline', 'create', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason || 'Unauthorized to create opportunities.' };
        }

        const placement = await checkDealPlacement(workspaceId, { pipelineId, stageId: requestedStageId });
        if (!placement.granted) return { success: false, error: placement.reason };

        // SECURITY (N1): the deal's organization is its workspace's organization.
        const organizationId = await workspaceOrganizationId(workspaceId);
        if (organizationId === null) {
            return { success: false, error: 'Workspace not found.' };
        }

        // 2. Resolve Lead Entity Record
        const entityRecord = await resolveWorkspaceEntityRecord(workspaceId, leadEntityId, organizationId || 'default');
        if (!entityRecord) {
            return { success: false, error: 'Lead entity not found in target workspace.' };
        }

        const now = new Date().toISOString();

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

        // 4. Resolve Target Pipeline Configuration & Expected Close Date
        const pipelineDoc = await adminDb.collection('pipelines').doc(pipelineId).get();
        const pipelineData = pipelineDoc.exists ? (pipelineDoc.data() as Pipeline) : null;

        let resolvedCloseDate = expectedCloseDate;
        if (!resolvedCloseDate) {
            const calculated = calculateExpectedCloseDate(
                pipelineData as import('../admin/pipeline/utils/deal-expected-close').PipelineOffsetConfig | null,
                null,
                new Date(now),
                targetStage.slaDays || 30
            );
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
                    isPrimary: index === 0 || cId === focalContactIds[0],
                });
            } else {
                dealContacts.push({
                    entityId: cId,
                    name: c.name || 'Unnamed Contact',
                    email: c.email,
                    phone: c.phone,
                    role: c.role || c.typeLabel || 'Stakeholder',
                });
            }
        });

        // 6. Create Deal Record
        const dealRef = adminDb.collection('deals').doc();
        const dealId = dealRef.id;
        const resolvedDealName = dealName?.trim() || entityRecord.displayName || 'Converted Lead Deal';
        const resolvedDefaultDealValue = typeof pipelineData?.defaultDealValue === 'number' && !Number.isNaN(pipelineData.defaultDealValue)
            ? Math.max(0, pipelineData.defaultDealValue)
            : 0;
        const numValue = typeof value === 'number' && !Number.isNaN(value) && value > 0
            ? value
            : resolvedDefaultDealValue;
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
            primaryContactId: focalContacts.find(fc => fc.isPrimary)?.id || focalContacts[0]?.id || null,
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
    workspaceId: string
): Promise<DealInteractionResult> {
    // SECURITY (audit F2 / N1): identity comes from the session only.
    const { uid: userId } = await requireWorkspace(workspaceId);

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
        // SECURITY (N1): the permission above was for `workspaceId`; the deal must live there.
        if (deal.workspaceId !== workspaceId) {
            return { success: false, error: 'Deal record not found.' };
        }
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

        // 7. Emit Domain Event
        emitDealDomainEvent('deal.activity.created', {
            dealId: deal.id,
            dealName: deal.name,
            workspaceId: deal.workspaceId || workspaceId,
            organizationId,
            entityId: deal.entityId,
            pipelineId: deal.pipelineId,
            stageId: deal.stageId,
            status: deal.status,
            value: deal.value || 0,
            activityType: interactionData.type,
            metadata: {
                subject,
                interactionType: interactionData.type,
                outcome: interactionData.outcome || null,
                durationMinutes: interactionData.durationMinutes || null,
            },
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


