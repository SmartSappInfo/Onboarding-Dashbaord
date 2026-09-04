/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Media 2.0 Migration:
 *    Idempotent Fetch-Enrich-Restore protocol upgrading pre-existing 1.0 `media` assets to
 *    the Media 2.0 schema by attaching `currentVersionId`, `versionCount`, and initial `MediaVersion` records.
 * 2. Chunked Write Safety:
 *    Executes updates in strict chunks of 150 operations per batch (`writeBatch`) to avoid rate limits or memory overload.
 */

import { 
  collection, doc, getDocs, setDoc, writeBatch, type Firestore 
} from 'firebase/firestore';
import type { MediaVersion } from '../types/media-2.0';

export interface MigrationReport {
  processed: number;
  migrated: number;
  errors: number;
  message: string;
}

/**
 * Runs the idempotent Media 2.0 migration protocol.
 */
export async function migrateMediaAssetsTo20(
  firestore: Firestore,
  onProgress?: (report: MigrationReport) => void
): Promise<{ processed: number; migrated: number; errors: number }> {
  if (!firestore) {
    return { processed: 0, migrated: 0, errors: 0 };
  }

  let processed = 0;
  let migrated = 0;
  let errors = 0;

  onProgress?.({
    processed: 0,
    migrated: 0,
    errors: 0,
    message: 'Scanning media collection for 1.0 records requiring 2.0 schema upgrade...',
  });

  try {
    const mediaRef = collection(firestore, 'media');
    const mediaSnap = await getDocs(mediaRef);
    const candidateDocs = mediaSnap.docs.filter((docSnap) => {
      const data = docSnap.data();
      return !data.currentVersionId || !data.lifecycleState;
    });

    if (candidateDocs.length === 0) {
      onProgress?.({
        processed: mediaSnap.docs.length,
        migrated: 0,
        errors: 0,
        message: 'All media assets are already upgraded to 2.0 schema.',
      });
      return { processed: mediaSnap.docs.length, migrated: 0, errors: 0 };
    }

    interface PendingMigrationUpdate {
      assetId: string;
      versionDoc: MediaVersion;
      lifecycleState: string;
    }

    const pendingUpdates: PendingMigrationUpdate[] = [];

    for (const docSnap of candidateDocs) {
      processed++;
      const data = docSnap.data();
      const assetId = docSnap.id;
      const mediaUrl = (data.url || data.linkUrl || '') as string;
      const fileName = (data.fileName || data.name || 'Initial File') as string;
      const fileSize = (data.fileSize || 0) as number;
      const mimeType = (data.mimeType || 'application/octet-stream') as string;
      const createdById = (data.createdBy || data.ownerId || 'system') as string;

      const initialVersionId = doc(collection(firestore, 'media_versions')).id;
      const initialVersion: MediaVersion = {
        id: initialVersionId,
        assetId,
        versionNumber: 1,
        url: mediaUrl,
        fileName,
        fileSize,
        mimeType,
        duration: data.duration || data.mediaDuration,
        createdById,
        changeLog: 'Initial v1 version backfill',
        createdAt: data.createdAt || new Date().toISOString(),
      };

      pendingUpdates.push({
        assetId,
        versionDoc: initialVersion,
        lifecycleState: 'active',
      });
      migrated++;
    }

    // Save versions and update parent assets in chunked batches (max 150 ops)
    const BATCH_SIZE = 75; // 75 items = 150 operations (1 setDoc + 1 updateDoc per item)
    for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
      const chunk = pendingUpdates.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(firestore);

      chunk.forEach((item) => {
        const versionRef = doc(firestore, 'media_versions', item.versionDoc.id);
        const assetRef = doc(firestore, 'media', item.assetId);

        batch.set(versionRef, item.versionDoc);
        batch.update(assetRef, {
          currentVersionId: item.versionDoc.id,
          versionCount: 1,
          lifecycleState: item.lifecycleState,
          updatedAt: new Date().toISOString(),
        });
      });

      await batch.commit();
    }

    onProgress?.({
      processed,
      migrated,
      errors: 0,
      message: `Migration complete! Successfully upgraded ${migrated} assets to Media 2.0 schema.`,
    });

    return { processed, migrated, errors };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[migrateMediaAssetsTo20] Migration error:', errorMsg);
    onProgress?.({
      processed,
      migrated,
      errors: errors + 1,
      message: `Migration failed: ${errorMsg}`,
    });
    return { processed, migrated, errors: errors + 1 };
  }
}
