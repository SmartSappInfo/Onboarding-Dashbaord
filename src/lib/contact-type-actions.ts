'use server';

/**
 * Contact Type Actions (FER-01 Phase 5)
 *
 * Server action for resolving effective contact types using the
 * 3-level hierarchy: System → Organization → Workspace.
 *
 * Reads from the `contact_type_templates` Firestore collection
 * and merges with system defaults from contact-type-defaults.ts.
 */

import { adminDb } from './firebase-admin';
import type { ContactTypeEntry, EntityType } from './types';
import {
    resolveContactTypes,
    getContactTypeTemplateId,
} from './contact-type-defaults';

/**
 * Fetches the effective contact types for a given entity type,
 * applying the 3-level override hierarchy.
 *
 * Resolution order:
 *   1. System defaults (hardcoded in contact-type-defaults.ts)
 *   2. Organization overrides (from Firestore contact_type_templates)
 *   3. Workspace overrides (from Firestore contact_type_templates)
 */
export async function getEffectiveContactTypes(
    entityType: EntityType,
    organizationId?: string,
    workspaceId?: string
): Promise<ContactTypeEntry[]> {
    let orgOverrides: ContactTypeEntry[] | undefined;
    let wsOverrides: ContactTypeEntry[] | undefined;

    try {
        let effectiveOrgId = organizationId;
        let effectiveWsId = workspaceId;

        if (workspaceId) {
            const { resolveWorkspaceGuid } = await import('./automations/workspace-resolver');
            const resolved = await resolveWorkspaceGuid(workspaceId);
            effectiveWsId = resolved.workspaceId;
            if (!effectiveOrgId && resolved.organizationId && resolved.organizationId !== 'default') {
                effectiveOrgId = resolved.organizationId;
            }
        }

        const fetchPromises: Promise<void>[] = [];

        if (effectiveOrgId) {
            const orgDocId = getContactTypeTemplateId('organization', entityType, effectiveOrgId);
            fetchPromises.push(
                adminDb.collection('contact_type_templates').doc(orgDocId).get().then((snap) => {
                    if (snap.exists) {
                        orgOverrides = snap.data()?.types as ContactTypeEntry[] | undefined;
                    }
                })
            );
        }

        if (effectiveWsId) {
            const wsDocId = getContactTypeTemplateId('workspace', entityType, effectiveWsId);
            fetchPromises.push(
                adminDb.collection('contact_type_templates').doc(wsDocId).get().then((snap) => {
                    if (snap.exists) {
                        wsOverrides = snap.data()?.types as ContactTypeEntry[] | undefined;
                    }
                })
            );
        }

        if (fetchPromises.length > 0) {
            await Promise.all(fetchPromises);
        }
    } catch (error) {
        // If Firestore reads fail, fall back to system defaults silently
        console.warn('[contact-type-actions] Failed to fetch overrides, using system defaults:', error);
    }

    return resolveContactTypes(entityType, orgOverrides, wsOverrides);
}

/**
 * Saves contact type overrides for an organization or workspace.
 */
export async function saveContactTypeOverrides(
    scopeType: 'organization' | 'workspace',
    entityType: EntityType,
    scopeId: string,
    types: ContactTypeEntry[],
    updatedBy?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const docId = getContactTypeTemplateId(scopeType, entityType, scopeId);
        await adminDb.collection('contact_type_templates').doc(docId).set({
            scopeType,
            entityType,
            ...(scopeType === 'organization' ? { organizationId: scopeId } : { workspaceId: scopeId }),
            types,
            updatedAt: new Date().toISOString(),
            updatedBy: updatedBy || 'system',
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error('[contact-type-actions] Failed to save overrides:', error);
        return { success: false, error: error.message };
    }
}
