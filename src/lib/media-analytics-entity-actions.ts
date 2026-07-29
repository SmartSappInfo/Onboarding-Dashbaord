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
    const BATCH_SIZE = 250;
    for (let i = 0; i < cleanContactIds.length; i += BATCH_SIZE) {
      const chunk = cleanContactIds.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      // Look up contacts collection docs
      const contactSnaps = await adminDb
        .collection('contacts')
        .where('workspaceId', '==', workspaceId)
        .where('__name__', 'in', chunk)
        .get();

      contactSnaps.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          tagIds: FieldValue.arrayUnion(...cleanTagIds),
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      });

      // Look up workspace_entities docs
      const entitySnaps = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', 'in', chunk)
        .get();

      entitySnaps.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          tagIds: FieldValue.arrayUnion(...cleanTagIds),
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      });

      await batch.commit();
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
    const BATCH_SIZE = 250;
    for (let i = 0; i < cleanContactIds.length; i += BATCH_SIZE) {
      const chunk = cleanContactIds.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      const contactSnaps = await adminDb
        .collection('contacts')
        .where('workspaceId', '==', workspaceId)
        .where('__name__', 'in', chunk)
        .get();

      contactSnaps.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          pipelineId,
          stageId,
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      });

      const entitySnaps = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', 'in', chunk)
        .get();

      entitySnaps.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          pipelineId,
          stageId,
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      });

      await batch.commit();
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
