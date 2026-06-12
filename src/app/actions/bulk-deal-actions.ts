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
  assignmentStrategy: 'direct' | 'unassigned' | 'pipeline';
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

    // 1. Fetch Pipeline settings and Stage details once
    const pipelineRef = adminDb.collection('pipelines').doc(pipelineId);
    const stageQuery = adminDb
      .collection('onboardingStages')
      .where('pipelineId', '==', pipelineId)
      .orderBy('order', 'asc')
      .limit(1);

    const [pipelineSnap, stageSnap] = await Promise.all([
      pipelineRef.get(),
      stageQuery.get()
    ]);

    if (!pipelineSnap.exists) throw new Error('Pipeline not found');
    const pipeline = pipelineSnap.data() as any;

    const stageId = stageSnap.empty ? 'default_stage' : stageSnap.docs[0].id;
    const stageName = stageSnap.empty ? undefined : (stageSnap.docs[0].data().name as string | undefined);

    const activeStrategy = assignmentStrategy === 'pipeline'
      ? (pipeline.assignmentStrategy || 'direct')
      : assignmentStrategy;

    const activeEligibleUserIds = pipeline.assignmentUserIds || [];

    // Load user profiles and stats once for the entire batch if auto-assignment is active
    const userProfiles: Record<string, { name: string; email: string }> = {};
    const userStats: Record<string, number> = {};

    const isAutoAssign = (activeStrategy === 'round-robin' || activeStrategy === 'value-based') && activeEligibleUserIds.length > 0;

    if (isAutoAssign) {
      // Fetch user profiles
      const userRefs = activeEligibleUserIds.map((uid: string) => adminDb.collection('users').doc(uid));
      const userSnaps = await adminDb.getAll(...userRefs);
      userSnaps.forEach(snap => {
        if (snap.exists) {
          const u = snap.data();
          userProfiles[snap.id] = { name: u?.name || 'Assigned User', email: u?.email || '' };
        } else {
          userProfiles[snap.id] = { name: 'Assigned User', email: '' };
        }
      });

      // Fetch initial user deal stats
      for (const uid of activeEligibleUserIds) {
        const snap = await adminDb.collection('deals')
          .where('assignedTo.userId', '==', uid)
          .where('status', '==', 'open')
          .get();
        if (activeStrategy === 'round-robin') {
          userStats[uid] = snap.size;
        } else {
          let totalVal = 0;
          snap.forEach(d => totalVal += (d.data().value || 0));
          userStats[uid] = totalVal;
        }
      }
    }

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
        if (isAutoAssign) {
          // Find eligible user with lowest metric
          let minVal = Infinity;
          let selectedUid = activeEligibleUserIds[0];
          for (const uid of activeEligibleUserIds) {
            const val = userStats[uid] ?? 0;
            if (val < minVal) {
              minVal = val;
              selectedUid = uid;
            }
          }
          // Update stats in memory for next loop iteration
          if (activeStrategy === 'round-robin') {
            userStats[selectedUid] = (userStats[selectedUid] ?? 0) + 1;
          } else {
            userStats[selectedUid] = (userStats[selectedUid] ?? 0) + (value || 0);
          }
          assignedTo = {
            userId: selectedUid,
            name: userProfiles[selectedUid]?.name || 'Assigned User',
            email: userProfiles[selectedUid]?.email || '',
          };
        } else if (activeStrategy === 'direct') {
          assignedTo = entity.assignedTo || null;
        } else if (activeStrategy === 'unassigned') {
          assignedTo = null;
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
