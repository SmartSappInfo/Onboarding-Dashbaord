'use server';

/**
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS:
 * 
 * 1. Single Source of Truth for Tags & Pipelines:
 *    - All tag operations route through TagSelector; server actions here update Firestore
 *      documents (`contacts` and `workspace_entities`) using `FieldValue.arrayUnion`.
 * 2. Multi-Tenant Security & Isolation:
 *    - `workspaceId` MUST be enforced on every query and mutation.
 *    - Never mutate documents belonging to another workspace.
 * 3. Batch Scalability & Protection:
 *    - Firestore batches are capped at 500 operations per commit.
 *    - We chunk `contactIds` into batches of max 250 to stay safely below limits.
 * 4. Testability Pointers:
 *    - Test with empty contactIds, cross-workspace IDs, and missing tag IDs.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface BulkApplyTagsParams {
  workspaceId: string;
  contactIds: string[];
  tagIds: string[];
}

export interface BulkMoveStageParams {
  workspaceId: string;
  contactIds: string[];
  pipelineId: string;
  stageId: string;
}

export interface BulkActionResult {
  success: boolean;
  updatedCount: number;
  error?: string;
}

/**
 * Atomically applies workspace tags to selected contact and entity records in Firestore.
 */
export async function bulkApplyTagsToMediaContactsAction(
  params: BulkApplyTagsParams
): Promise<BulkActionResult> {
  const { workspaceId, contactIds, tagIds } = params;

  if (!workspaceId) {
    return { success: false, updatedCount: 0, error: 'Workspace context is required.' };
  }
  if (!contactIds || contactIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'No contact records selected.' };
  }
  if (!tagIds || tagIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'No tags selected to apply.' };
  }

  const cleanContactIds = [...new Set(contactIds.filter(Boolean))];
  const cleanTagIds = [...new Set(tagIds.filter(Boolean))];
  let updatedCount = 0;

  try {
    // CAUTION: Cloud Firestore 'in' query operator strictly caps comparison values at 30 items.
    // Slicing cleanContactIds into sub-chunks of max 30 prevents INVALID_ARGUMENT crashes.
    const FIRESTORE_IN_LIMIT = 30;
    for (let i = 0; i < cleanContactIds.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = cleanContactIds.slice(i, i + FIRESTORE_IN_LIMIT);
      const batch = adminDb.batch();
      const updatedRefPaths = new Set<string>();

      // Run 5 index lookups concurrently via Promise.all for maximum high-load throughput
      const [
        contactByDocId,
        contactByEntityId,
        entityByDocId,
        entityByEntityId,
        entityByCode,
      ] = await Promise.all([
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('code', 'in', chunk).get(),
      ]);

      const applyTagUpdate = (docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
        if (!updatedRefPaths.has(docSnap.ref.path)) {
          updatedRefPaths.add(docSnap.ref.path);
          batch.update(docSnap.ref, {
            tagIds: FieldValue.arrayUnion(...cleanTagIds),
            updatedAt: new Date().toISOString(),
          });
          updatedCount++;
        }
      };

      contactByDocId.docs.forEach(applyTagUpdate);
      contactByEntityId.docs.forEach(applyTagUpdate);
      entityByDocId.docs.forEach(applyTagUpdate);
      entityByEntityId.docs.forEach(applyTagUpdate);
      entityByCode.docs.forEach(applyTagUpdate);

      if (updatedRefPaths.size > 0) {
        await batch.commit();
      }
    }

    return { success: true, updatedCount };
  } catch (err) {
    console.error('[bulkApplyTagsToMediaContactsAction] Error applying tags:', err);
    return {
      success: false,
      updatedCount,
      error: err instanceof Error ? err.message : 'Failed to update contact tags.',
    };
  }
}

/**
 * Updates operational pipeline and stage fields on selected contacts/entities.
 */
export async function bulkMoveMediaContactsStageAction(
  params: BulkMoveStageParams
): Promise<BulkActionResult> {
  const { workspaceId, contactIds, pipelineId, stageId } = params;

  if (!workspaceId) {
    return { success: false, updatedCount: 0, error: 'Workspace context is required.' };
  }
  if (!contactIds || contactIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'No contact records selected.' };
  }
  if (!pipelineId || !stageId) {
    return { success: false, updatedCount: 0, error: 'Pipeline and stage selection are required.' };
  }

  const cleanContactIds = [...new Set(contactIds.filter(Boolean))];
  let updatedCount = 0;

  try {
    // CAUTION: Cloud Firestore 'in' query operator strictly caps comparison values at 30 items.
    // Slicing cleanContactIds into sub-chunks of max 30 prevents INVALID_ARGUMENT crashes.
    const FIRESTORE_IN_LIMIT = 30;
    for (let i = 0; i < cleanContactIds.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = cleanContactIds.slice(i, i + FIRESTORE_IN_LIMIT);
      const batch = adminDb.batch();
      const updatedRefPaths = new Set<string>();

      // Run 5 index lookups concurrently via Promise.all for maximum high-load throughput
      const [
        contactByDocId,
        contactByEntityId,
        entityByDocId,
        entityByEntityId,
        entityByCode,
      ] = await Promise.all([
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('code', 'in', chunk).get(),
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

      contactByDocId.docs.forEach(applyStageUpdate);
      contactByEntityId.docs.forEach(applyStageUpdate);
      entityByDocId.docs.forEach(applyStageUpdate);
      entityByEntityId.docs.forEach(applyStageUpdate);
      entityByCode.docs.forEach(applyStageUpdate);

      if (updatedRefPaths.size > 0) {
        await batch.commit();
      }
    }

    return { success: true, updatedCount };
  } catch (err) {
    console.error('[bulkMoveMediaContactsStageAction] Error moving pipeline stage:', err);
    return {
      success: false,
      updatedCount,
      error: err instanceof Error ? err.message : 'Failed to update pipeline stage.',
    };
  }
}
