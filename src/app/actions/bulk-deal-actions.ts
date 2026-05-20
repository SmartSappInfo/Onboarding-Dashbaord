'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Deal, WorkspaceEntity } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

interface BulkDealCreationData {
  entityIds: string[];
  workspaceId: string;
  organizationId: string;
  pipelineId: string;
  dealNamePattern: string; // e.g. "{{entityName}} - 2026 Expansion"
  value: number;
  assignmentStrategy: 'direct' | 'unassigned';
}

export async function bulkCreateDealsAction(data: BulkDealCreationData) {
  try {
    const {
      entityIds,
      workspaceId,
      organizationId,
      pipelineId,
      dealNamePattern,
      value,
      assignmentStrategy,
    } = data;

    if (entityIds.length === 0) {
      return { success: true, count: 0 };
    }

    // 1. Fetch Pipeline Stage details once
    const stageSnap = await adminDb
      .collection('onboardingStages')
      .where('pipelineId', '==', pipelineId)
      .orderBy('order', 'asc')
      .limit(1)
      .get();
    
    const stageId = stageSnap.empty ? 'default_stage' : stageSnap.docs[0].id;
    const stageName = stageSnap.empty ? undefined : (stageSnap.docs[0].data().name as string | undefined);

    const now = new Date().toISOString();
    const processedResults: string[] = [];
    const chunkLimit = 450; // Safety threshold for Firestore batches (limit is 500)

    // Slicing into parallel chunks
    for (let i = 0; i < entityIds.length; i += chunkLimit) {
      const chunk = entityIds.slice(i, i + chunkLimit);
      const batch = adminDb.batch();

      // Fetch all entities in this chunk from Firestore
      const entityRefs = chunk.map(id =>
        adminDb.collection('workspace_entities').doc(`${workspaceId}_${id}`)
      );
      
      const entitySnapshots = await adminDb.getAll(...entityRefs);

      entitySnapshots.forEach(snap => {
        if (!snap.exists) return;
        const entity = snap.data() as WorkspaceEntity;

        let assignedTo = null;
        if (assignmentStrategy === 'direct') {
          assignedTo = entity.assignedTo || null;
        }

        // Replace pattern placeholders
        const dealName = dealNamePattern.replace('{{entityName}}', entity.displayName || 'Entity');

        // Create deal ref
        const newDealRef = adminDb.collection('deals').doc();
        const dealData: Omit<Deal, 'id'> = {
          organizationId,
          workspaceId,
          entityId: entity.entityId,
          pipelineId,
          stageId,
          ...(stageName ? { stageName } : {}),
          name: dealName,
          value: value || 0,
          status: 'open',
          assignedTo,
          createdAt: now,
          updatedAt: now,
        };

        batch.set(newDealRef, dealData);
        processedResults.push(newDealRef.id);
      });

      // Commit this chunk's operations
      await batch.commit();
    }

    return {
      success: true,
      count: processedResults.length,
      message: `Successfully initiated ${processedResults.length} deals in the pipeline.`
    };
  } catch (error: any) {
    console.error('[bulkCreateDealsAction] Error:', error);
    return { success: false, error: error.message };
  }
}
