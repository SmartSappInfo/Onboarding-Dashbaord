/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Single Source of Truth (SSOT) protocol for scanning, probing, and enriching existing media records
 * with missing duration metadata across Firestore collections (`media` and `media_shares`).
 *
 * PROTOCOL DESIGN:
 * 1. Fetch: Queries media assets in active workspace missing duration metadata.
 * 2. Enrich: Probes storage URLs / YouTube link metadata to resolve human-readable duration strings ("M:SS").
 * 3. Restore: Performs chunked batch updates (max 150 operations per writeBatch) to safely persist duration updates.
 * 4. Sync: Cascades duration updates to corresponding media_shares records.
 *
 * TESTABILITY: Can be run safely in client UI or administrative tasks; idempotent operations.
 * RELATED SURFACES: MediaLibraryBrowser.tsx, duration-extractor.ts, block-inspector.tsx.
 */

import { collection, query, where, getDocs, writeBatch, type Firestore } from 'firebase/firestore';
import { extractMediaUrlDuration } from './duration-extractor';

export interface BackfillProgressReport {
  processed: number;
  updated: number;
  errors: number;
  message: string;
}

/**
 * Runs the Fetch-Enrich-Restore backfill protocol for workspace media assets and media shares.
 */
export async function backfillWorkspaceMediaDurations(
  firestore: Firestore,
  workspaceId: string,
  onProgress?: (report: BackfillProgressReport) => void
): Promise<{ processed: number; updated: number }> {
  if (!firestore || !workspaceId) {
    return { processed: 0, updated: 0 };
  }

  let processed = 0;
  let updated = 0;
  let errors = 0;

  onProgress?.({
    processed: 0,
    updated: 0,
    errors: 0,
    message: 'Scanning workspace media library for records missing duration...',
  });

  // 1. Fetch workspace media documents
  const mediaRef = collection(firestore, 'media');
  const mediaQuery = workspaceId === 'global'
    ? mediaRef
    : query(mediaRef, where('workspaceIds', 'array-contains', workspaceId));

  const mediaSnap = await getDocs(mediaQuery);
  const candidateDocs = mediaSnap.docs.filter((doc) => {
    const data = doc.data();
    const isMedia = data.type === 'video' || data.type === 'audio' || Boolean(data.url);
    const hasDuration = Boolean(data.duration || data.mediaDuration || data.formattedDuration);
    return isMedia && !hasDuration;
  });

  if (candidateDocs.length === 0) {
    onProgress?.({
      processed: mediaSnap.docs.length,
      updated: 0,
      errors: 0,
      message: 'All media assets already have duration metadata attached.',
    });
    return { processed: mediaSnap.docs.length, updated: 0 };
  }

  // 2. Fetch corresponding media_shares for syncing
  const sharesRef = collection(firestore, 'media_shares');
  const sharesQuery = workspaceId === 'global'
    ? sharesRef
    : query(sharesRef, where('workspaceId', '==', workspaceId));
  const sharesSnap = await getDocs(sharesQuery);

  const assetToSharesMap = new Map<string, string[]>();
  sharesSnap.docs.forEach((shareDoc) => {
    const shareData = shareDoc.data();
    const assetId = shareData.assetId as string | undefined;
    if (assetId) {
      const existing = assetToSharesMap.get(assetId) || [];
      existing.push(shareDoc.id);
      assetToSharesMap.set(assetId, existing);
    }
  });

  // 3. Enrich & Partition into Chunked Write Batches (Max 150 ops per batch)
  interface PendingUpdate {
    path: string;
    docId: string;
    isShare: boolean;
    duration: string;
  }

  const pendingUpdates: PendingUpdate[] = [];

  for (const doc of candidateDocs) {
    processed++;
    const data = doc.data();
    const mediaUrl = (data.url as string) || (data.linkUrl as string) || '';

    if (mediaUrl) {
      try {
        const resolvedDuration = await extractMediaUrlDuration(mediaUrl);
        if (resolvedDuration) {
          pendingUpdates.push({
            path: 'media',
            docId: doc.id,
            isShare: false,
            duration: resolvedDuration,
          });

          // Cascade to shares
          const shareIds = assetToSharesMap.get(doc.id) || [];
          shareIds.forEach((shareId) => {
            pendingUpdates.push({
              path: 'media_shares',
              docId: shareId,
              isShare: true,
              duration: resolvedDuration,
            });
          });

          updated++;
        }
      } catch {
        errors++;
      }
    }

    onProgress?.({
      processed,
      updated,
      errors,
      message: `Enriched ${processed}/${candidateDocs.length} assets...`,
    });
  }

  // 4. Restore: Commit updates in strict chunks of 150 operations
  const BATCH_SIZE = 150;
  for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
    const chunk = pendingUpdates.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(firestore);

    chunk.forEach((update) => {
      const targetCol = update.isShare ? 'media_shares' : 'media';
      const targetRef = docRef(firestore, targetCol, update.docId);
      batch.update(targetRef, { duration: update.duration });
    });

    await batch.commit();
  }

  onProgress?.({
    processed,
    updated,
    errors,
    message: `Enrichment complete! Successfully restored duration on ${updated} records.`,
  });

  return { processed, updated };
}

import { doc as docRef } from 'firebase/firestore';
