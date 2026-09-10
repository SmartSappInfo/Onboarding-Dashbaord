'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

export async function executeDealMigration(workspaceId: string, organizationId: string) {
  // SECURITY (audit F2): Server Actions are public endpoints. This platform
  // migration was reachable unauthenticated. Identity and permission are resolved
  // server-side from the session; the caller supplies neither.
  await authorizeBackofficeSession('operations', 'execute');

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
    } catch (error: unknown) {
        console.error('Deal Migration Error:', error);
        return { success: false, error: getErrorMessage(error) };
    }
}
