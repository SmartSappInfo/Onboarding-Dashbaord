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
        // Fetch organization-level overrides
        if (organizationId) {
            const orgDocId = getContactTypeTemplateId('organization', entityType, organizationId);
            const orgSnap = await adminDb.collection('contact_type_templates').doc(orgDocId).get();
            if (orgSnap.exists) {
                const data = orgSnap.data();
                orgOverrides = data?.types as ContactTypeEntry[] | undefined;
            }
        }

        // Fetch workspace-level overrides
        if (workspaceId) {
            const wsDocId = getContactTypeTemplateId('workspace', entityType, workspaceId);
            const wsSnap = await adminDb.collection('contact_type_templates').doc(wsDocId).get();
            if (wsSnap.exists) {
                const data = wsSnap.data();
                wsOverrides = data?.types as ContactTypeEntry[] | undefined;
            }
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
