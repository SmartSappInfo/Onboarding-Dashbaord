'use server';

/**
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 
 * 1. Single Source of Truth for Tags & Pipelines:
 *    - All tag operations route through TagSelector in the UI; server actions here mutate Firestore
 *      documents (`workspace_entities` and `contacts`) using atomic `FieldValue.arrayUnion`.
 * 2. Multi-Tenant Security & Isolation:
 *    - `workspaceId` is strictly required and enforced on every Firestore query (`where('workspaceId', '==', workspaceId)`).
 *    - Never mutate records across tenant boundaries.
 * 3. High-Load Batch Scalability & Chunking:
 *    - Cloud Firestore strictly limits 'in' query filter comparisons to max 30 items.
 *    - Slicing `entityIds` into sub-chunks of 30 prevents INVALID_ARGUMENT crashes under high volume.
 *    - Commits are executed safely within batch limits.
 * 4. Testability:
 *    - Validated in `src/lib/__tests__/survey-entity-actions.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canUser } from '@/lib/workspace-permissions';

export interface BulkApplyTagsToSurveyEntitiesParams {
  workspaceId: string;
  entityIds: string[];
  tagIds: string[];
  userId?: string;
}

export interface BulkMoveSurveyEntitiesStageParams {
  workspaceId: string;
  entityIds: string[];
  pipelineId: string;
  stageId: string;
  userId?: string;
}

export interface SurveyEntityActionResult {
  success: boolean;
  updatedCount: number;
  error?: string;
}

/**
 * Atomically applies workspace tags to selected survey identified entities and contacts in Firestore.
 */
export async function bulkApplyTagsToSurveyEntitiesAction(
  params: BulkApplyTagsToSurveyEntitiesParams
): Promise<SurveyEntityActionResult> {
  const { workspaceId, entityIds, tagIds, userId } = params;

  if (!workspaceId) {
    return { success: false, updatedCount: 0, error: 'Workspace context is required.' };
  }
  if (!entityIds || entityIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'No entity records selected.' };
  }
  if (!tagIds || tagIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'No tags selected to apply.' };
  }

  if (userId) {
    const perm = await canUser(userId, 'operations', 'contacts', 'edit', workspaceId);
    if (!perm.granted) {
      return { success: false, updatedCount: 0, error: perm.reason || 'Permission denied.' };
    }
  }

  const cleanEntityIds = [...new Set(entityIds.filter(Boolean))];
  const cleanTagIds = [...new Set(tagIds.filter(Boolean))];
  let updatedCount = 0;

  try {
    const FIRESTORE_IN_LIMIT = 30;
    for (let i = 0; i < cleanEntityIds.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = cleanEntityIds.slice(i, i + FIRESTORE_IN_LIMIT);
      const batch = adminDb.batch();
      const updatedRefPaths = new Set<string>();

      // Run lookups across entities and contacts concurrently
      const [
        entityByDocId,
        entityByEntityId,
        entityByCode,
        contactByDocId,
        contactByEntityId,
      ] = await Promise.all([
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('code', 'in', chunk).get(),
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
      ]);

      const applyTagUpdate = (docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
        if (!updatedRefPaths.has(docSnap.ref.path)) {
          updatedRefPaths.add(docSnap.ref.path);
          batch.update(docSnap.ref, {
            tagIds: FieldValue.arrayUnion(...cleanTagIds),
            workspaceTags: FieldValue.arrayUnion(...cleanTagIds),
            updatedAt: new Date().toISOString(),
          });
          updatedCount++;
        }
      };

      entityByDocId.docs.forEach(applyTagUpdate);
      entityByEntityId.docs.forEach(applyTagUpdate);
      entityByCode.docs.forEach(applyTagUpdate);
      contactByDocId.docs.forEach(applyTagUpdate);
      contactByEntityId.docs.forEach(applyTagUpdate);

      if (updatedRefPaths.size > 0) {
        await batch.commit();
      }
    }

    return { success: true, updatedCount };
  } catch (err) {
    console.error('[bulkApplyTagsToSurveyEntitiesAction] Error applying tags:', err);
    return {
      success: false,
      updatedCount,
      error: err instanceof Error ? err.message : 'Failed to update entity tags.',
    };
  }
}

/**
 * Updates operational pipeline and stage fields on selected survey identified entities and contacts.
 */
export async function bulkMoveSurveyEntitiesStageAction(
  params: BulkMoveSurveyEntitiesStageParams
): Promise<SurveyEntityActionResult> {
  const { workspaceId, entityIds, pipelineId, stageId, userId } = params;

  if (!workspaceId) {
    return { success: false, updatedCount: 0, error: 'Workspace context is required.' };
  }
  if (!entityIds || entityIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'No entity records selected.' };
  }
  if (!pipelineId || !stageId) {
    return { success: false, updatedCount: 0, error: 'Pipeline and stage selection are required.' };
  }

  if (userId) {
    const perm = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
    if (!perm.granted) {
      return { success: false, updatedCount: 0, error: perm.reason || 'Permission denied.' };
    }
  }

  const cleanEntityIds = [...new Set(entityIds.filter(Boolean))];
  let updatedCount = 0;

  try {
    const FIRESTORE_IN_LIMIT = 30;
    for (let i = 0; i < cleanEntityIds.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = cleanEntityIds.slice(i, i + FIRESTORE_IN_LIMIT);
      const batch = adminDb.batch();
      const updatedRefPaths = new Set<string>();

      const [
        entityByDocId,
        entityByEntityId,
        entityByCode,
        contactByDocId,
        contactByEntityId,
      ] = await Promise.all([
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('code', 'in', chunk).get(),
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
      ]);

      const applyStageUpdate = (docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
        if (!updatedRefPaths.has(docSnap.ref.path)) {
          updatedRefPaths.add(docSnap.ref.path);
          batch.update(docSnap.ref, {
            pipelineId,
            stageId,
            updatedAt: new Date().toISOString(),
          });
          updatedCount++;
        }
      };

      entityByDocId.docs.forEach(applyStageUpdate);
      entityByEntityId.docs.forEach(applyStageUpdate);
      entityByCode.docs.forEach(applyStageUpdate);
      contactByDocId.docs.forEach(applyStageUpdate);
      contactByEntityId.docs.forEach(applyStageUpdate);

      if (updatedRefPaths.size > 0) {
        await batch.commit();
      }
    }

    return { success: true, updatedCount };
  } catch (err) {
    console.error('[bulkMoveSurveyEntitiesStageAction] Error moving pipeline stage:', err);
    return {
      success: false,
      updatedCount,
      error: err instanceof Error ? err.message : 'Failed to update pipeline stage.',
    };
  }
}
