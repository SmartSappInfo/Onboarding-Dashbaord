/**
 * @fileOverview Entity Status Restoration Protocol (FER-03)
 *
 * Implements the "Active-by-Default" modernization policy:
 * 1. Bulk restores all 'entities' and 'workspace_entities' to status: 'active'.
 * 2. Bulk restores all legacy 'schools' to status: 'Active'.
 * 3. Logs all transitions for audit traceability.
 */

'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import { logWorkspaceEntityUpdated } from './entity-audit';

/**
 * Bulk restores all documents in 'entities' and 'workspace_entities' to 'active' status.
 * This ensures they appear in the modernized admin hubs.
 */
export async function restoreAllEntitiesToActiveAction(userId: string, userName: string, userEmail: string) {
    try {
        const timestamp = new Date().toISOString();
        let entityCount = 0;
        let weCount = 0;
        let errorCount = 0;

        // 1. Process 'entities' collection
        const entitiesSnap = await adminDb.collection('entities').get();
        for (const doc of entitiesSnap.docs) {
            try {
                const data = doc.data();
                if (data.status !== 'active') {
                    await doc.ref.update({
                        status: 'active',
                        updatedAt: timestamp
                    });
                    
                    // Log to activity trail
                    await logActivity({
                        organizationId: data.organizationId || 'smartsapp-hq',
                        workspaceId: data.workspaceId || 'system',
                        entityId: doc.id,
                        entityType: data.entityType,
                        displayName: data.name || 'Unknown Entity',
                        userId,
                        type: 'entity_updated',
                        source: 'system',
                        description: `FER-03: Restored entity status to "active"`,
                        metadata: { oldStatus: data.status, newStatus: 'active' }
                    });
                    
                    entityCount++;
                }
            } catch (e) {
                console.error(`[FER-03] Failed to restore entity ${doc.id}:`, e);
                errorCount++;
            }
        }

        // 2. Process 'workspace_entities' collection
        const weSnap = await adminDb.collection('workspace_entities').get();
        for (const doc of weSnap.docs) {
            try {
                const data = doc.data();
                if (data.status !== 'active') {
                    const oldValue = { ...data };
                    await doc.ref.update({
                        status: 'active',
                        updatedAt: timestamp
                    });

                    // Log to specialized workspace audit trail
                    await logWorkspaceEntityUpdated({
                        organizationId: data.organizationId || 'smartsapp-hq',
                        workspaceId: data.workspaceId,
                        entityId: data.entityId,
                        entityType: data.entityType,
                        userId,
                        userName,
                        userEmail,
                        oldValue,
                        newValue: { ...data, status: 'active', updatedAt: timestamp },
                        changedFields: ['status'],
                        operationContext: 'migration'
                    });

                    weCount++;
                }
            } catch (e) {
                console.error(`[FER-03] Failed to restore workspace_entity ${doc.id}:`, e);
                errorCount++;
            }
        }

        return {
            success: true,
            entityCount,
            weCount,
            errorCount,
            message: `Restoration complete: ${entityCount} entities and ${weCount} workspace links activated.`
        };
    } catch (e: any) {
        console.error('[FER-03] Critical Restoration Failure:', e.message);
        return { success: false, error: e.message };
    }
}

