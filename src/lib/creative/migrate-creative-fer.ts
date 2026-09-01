'use server';

/**
 * ARCHITECTURE:
 * Fetch-Enrich-Restore (FER) Migration Protocol for Creative Studio 2.0 (Phase 1)
 * 
 * Safely migrates existing legacy `thumbnail_designs` records into modern
 * `creative_projects` and `creative_documents` without data loss or duplicates.
 * 
 * CAUTION:
 * Batches are strictly capped below the 400 operation safety ceiling per commit.
 * Idempotent: Can be run multiple times safely.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { ThumbnailDesign } from '@/lib/thumbnail/thumbnail-types';
import { thumbnailDesignToCreativeProject } from '@/lib/creative/creative-types';

export interface FERMigrationResult {
  success: boolean;
  totalFetched: number;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}

export async function migrateLegacyThumbnailsFERAction(): Promise<FERMigrationResult> {
  const result: FERMigrationResult = {
    success: true,
    totalFetched: 0,
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  try {
    const snap = await adminDb.collection('thumbnail_designs').get();
    result.totalFetched = snap.size;

    if (snap.empty) {
      return result;
    }

    const legacyDocs = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<ThumbnailDesign, 'id'>),
    }));

    // Process in batches of 150 (300 writes per batch: 1 project + 1 document)
    const BATCH_SIZE = 150;
    for (let i = 0; i < legacyDocs.length; i += BATCH_SIZE) {
      const chunk = legacyDocs.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      for (const legacy of chunk) {
        try {
          const { project, document } = thumbnailDesignToCreativeProject(legacy);

          const projectRef = adminDb.collection('creative_projects').doc(project.id);
          const docRef = adminDb.collection('creative_documents').doc(document.id);

          batch.set(projectRef, project, { merge: true });
          batch.set(docRef, document, { merge: true });

          result.migratedCount++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown item conversion error';
          result.errors.push(`Failed to migrate thumbnail ${legacy.id}: ${errMsg}`);
          result.skippedCount++;
        }
      }

      await batch.commit();
    }

    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Fatal migration failure';
    console.error('[migrateLegacyThumbnailsFERAction] Error:', error);
    result.success = false;
    result.errors.push(message);
    return result;
  }
}
