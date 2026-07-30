'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * 
 * Media Automation Actions Server Module
 * --------------------------------------
 * 1. Multi-Tenant Workspace Security:
 *    All target assets MUST be verified to belong to `workspaceId` prior to batch commits.
 * 
 * 2. Media Type Alignment Safeguard:
 *    Automation rules from a video asset (e.g. on_progress_50) MUST only be transferred to
 *    target assets of the SAME type (video ➔ video, audio ➔ audio, image ➔ image).
 * 
 * 3. Deep Reference Isolation:
 *    `automationRules` objects are deep-cloned via JSON serialization to prevent
 *    shared in-memory pointer mutation across different shares.
 * 
 * 4. High-Load Chunked Firestore Writes:
 *    Batch operations are capped at 150 documents per chunk to operate safely well under
 *    Firestore's 500-doc transactional ceiling.
 */

import { adminDb } from './firebase-admin';
import type { CallOutcomeAutomation, MediaAsset } from './types';

export interface TransferMediaAutomationsParams {
  sourceAssetId: string;
  targetAssetIds: string[];
  scopeMode: 'all' | 'selected' | 'single';
  workspaceId: string;
  automationRules: Record<string, CallOutcomeAutomation[]>;
}

export interface TransferMediaAutomationsResult {
  success: boolean;
  count: number;
  message: string;
}

const BATCH_SIZE = 150;

/**
 * Transfers/replicates automation rules from a source media asset to targeted hosted media assets in a workspace.
 */
export async function transferMediaAutomationsAction(
  params: TransferMediaAutomationsParams
): Promise<TransferMediaAutomationsResult> {
  const { sourceAssetId, targetAssetIds, scopeMode, workspaceId, automationRules } = params;

  if (!sourceAssetId || !workspaceId) {
    return { success: false, count: 0, message: 'Missing required source asset or workspace context.' };
  }

  try {
    // 1. Fetch Source Asset metadata to determine media type and workspace
    const sourceSnap = await adminDb.collection('media').doc(sourceAssetId).get();
    if (!sourceSnap.exists) {
      return { success: false, count: 0, message: 'Source media asset document not found.' };
    }

    const sourceData = sourceSnap.data() as MediaAsset;
    if (!sourceData.workspaceIds?.includes(workspaceId)) {
      return { success: false, count: 0, message: 'Unauthorized: Source asset workspace mismatch.' };
    }

    const sourceType = sourceData.type || 'video';

    // 2. Query all candidate media assets matching the workspace and type
    const candidateSnaps = await adminDb
      .collection('media')
      .where('workspaceIds', 'array-contains', workspaceId)
      .where('type', '==', sourceType)
      .get();

    if (candidateSnaps.empty) {
      return { success: false, count: 0, message: `No target ${sourceType} assets found in workspace.` };
    }

    // Filter target asset IDs based on scope mode
    let validTargetAssetIds: string[] = [];

    if (scopeMode === 'all') {
      validTargetAssetIds = candidateSnaps.docs
        .map((d) => d.id)
        .filter((id) => id !== sourceAssetId);
    } else {
      const allowedSet = new Set(targetAssetIds);
      validTargetAssetIds = candidateSnaps.docs
        .map((d) => d.id)
        .filter((id) => allowedSet.has(id) && id !== sourceAssetId);
    }

    if (validTargetAssetIds.length === 0) {
      return { success: false, count: 0, message: 'No valid matching target assets selected.' };
    }

    // 3. Deep-clone automation rules to break object reference coupling
    const clonedRules: Record<string, CallOutcomeAutomation[]> = JSON.parse(
      JSON.stringify(automationRules || {})
    );

    // 4. Resolve or initialize `media_shares` documents for all target assets
    const mediaSharesRef = adminDb.collection('media_shares');
    
    // Chunk target asset IDs into batches of 30 for Firestore `in` queries
    const CHUNK_QUERY_SIZE = 30;
    const targetAssetChunks: string[][] = [];
    for (let i = 0; i < validTargetAssetIds.length; i += CHUNK_QUERY_SIZE) {
      targetAssetChunks.push(validTargetAssetIds.slice(i, i + CHUNK_QUERY_SIZE));
    }

    const existingSharesByAssetId = new Map<string, FirebaseFirestore.DocumentSnapshot>();

    await Promise.all(
      targetAssetChunks.map(async (chunk) => {
        const snap = await mediaSharesRef.where('assetId', 'in', chunk).get();
        snap.docs.forEach((doc) => {
          const data = doc.data();
          if (data?.assetId) {
            existingSharesByAssetId.set(data.assetId, doc);
          }
        });
      })
    );

    // Prepare list of write operations (docRef + data payload)
    const writeOperations: Array<{ docRef: FirebaseFirestore.DocumentReference; payload: Record<string, unknown>; isNew: boolean }> = [];

    validTargetAssetIds.forEach((targetAssetId) => {
      const existingDoc = existingSharesByAssetId.get(targetAssetId);
      if (existingDoc) {
        writeOperations.push({
          docRef: existingDoc.ref,
          payload: {
            automationRules: clonedRules,
            updatedAt: new Date().toISOString(),
          },
          isNew: false,
        });
      } else {
        // Initialize default share config doc if missing
        const newDocRef = mediaSharesRef.doc();
        const targetAssetDoc = candidateSnaps.docs.find((d) => d.id === targetAssetId);
        const targetAssetName = targetAssetDoc?.data()?.name || 'Media Landing Page';

        writeOperations.push({
          docRef: newDocRef,
          payload: {
            assetId: targetAssetId,
            workspaceId,
            title: targetAssetName,
            automationRules: clonedRules,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          isNew: true,
        });
      }
    });

    // 5. Execute chunked batch writes (Capped at 150 docs/batch)
    const writeChunks: typeof writeOperations[] = [];
    for (let i = 0; i < writeOperations.length; i += BATCH_SIZE) {
      writeChunks.push(writeOperations.slice(i, i + BATCH_SIZE));
    }

    let updatedCount = 0;
    for (const chunk of writeChunks) {
      const batch = adminDb.batch();
      chunk.forEach((op) => {
        if (op.isNew) {
          batch.set(op.docRef, op.payload);
        } else {
          batch.update(op.docRef, op.payload);
        }
      });
      await batch.commit();
      updatedCount += chunk.length;
    }

    return {
      success: true,
      count: updatedCount,
      message: `Successfully transferred automation rules to ${updatedCount} media asset${updatedCount === 1 ? '' : 's'}.`,
    };
  } catch (err) {
    console.error('[transferMediaAutomationsAction] Execution error:', err);
    return {
      success: false,
      count: 0,
      message: err instanceof Error ? err.message : 'Failed to transfer automation rules.',
    };
  }
}
