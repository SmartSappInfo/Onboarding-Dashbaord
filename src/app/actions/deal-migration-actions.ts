'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

export async function executeDealMigration(workspaceId: string, organizationId: string) {
    try {
        const weQuery = adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId);
        const snapshot = await weQuery.get();

        if (snapshot.empty) return { success: true, migratedCount: 0 };

        const batch = adminDb.batch();
        let migratedCount = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            
            // If the entity has legacy pipeline fields, migrate it to a Deal
            if (data.pipelineId && data.stageId) {
                const dealRef = adminDb.collection('deals').doc(); // Auto-generate ID
                
                batch.set(dealRef, {
                    organizationId,
                    workspaceId,
                    entityId: data.entityId,
                    pipelineId: data.pipelineId,
                    stageId: data.stageId,
                    name: `${data.displayName} Deal`,
                    value: 0,
                    status: 'open',
                    assignedTo: data.assignedTo || null,
                    createdAt: data.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                // Remove legacy fields from workspace_entity
                batch.update(docSnap.ref, {
                    pipelineId: FieldValue.delete(),
                    stageId: FieldValue.delete(),
                    currentStageName: FieldValue.delete()
                });

                migratedCount++;
            }
        }

        if (migratedCount > 0) {
            await batch.commit();
        }

        return { success: true, migratedCount };
    } catch (error: any) {
        console.error('Deal Migration Error:', error);
        return { success: false, error: error.message };
    }
}
