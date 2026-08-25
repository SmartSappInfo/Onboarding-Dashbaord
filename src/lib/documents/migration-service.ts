'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Fetch-Enrich-Restore Migration Service:
 *    Executes zero-downtime data migration converting legacy `flipbooks` and `flipbook_pages`
 *    collections to enterprise `documents`, `document_versions`, `document_pages`, `document_layers`,
 *    `viewer_experiences`, and `access_policies` (PRD Sections 83–84 & 98).
 * 2. High-Load Resilience & Idempotency:
 *    All migration writes are idempotent and chunked in batches of 150 operations (`BATCH_SIZE = 150`).
 * 3. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { FlipbookConfig, FlipbookPage } from '@/lib/types/flipbook-types';
import type { DocumentPage } from '@/lib/types/document-types';
import { flipbookToDocumentAggregate, flipbookPageToDocumentPage } from '@/lib/documents/document-adapter';

export interface MigrationSummary {
  workspaceId: string;
  totalFlipbooks: number;
  migratedCount: number;
  failedCount: number;
  lastProcessedId?: string;
  hasMore: boolean;
  errors: Array<{ flipbookId: string; error: string }>;
}

/**
 * Migrates all legacy Flipbooks in a workspace to the Document Experience Platform
 * with cursor pagination to prevent execution timeouts on large workspaces.
 */
export async function migrateWorkspaceFlipbooks(
  workspaceId: string,
  limitCount = 50,
  startAfterDocId?: string
): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    workspaceId,
    totalFlipbooks: 0,
    migratedCount: 0,
    failedCount: 0,
    hasMore: false,
    errors: [],
  };

  try {
    let queryRef = adminDb.collection('flipbooks')
      .where('workspaceId', '==', workspaceId)
      .orderBy('__name__')
      .limit(limitCount + 1);

    if (startAfterDocId) {
      const startDoc = await adminDb.collection('flipbooks').doc(startAfterDocId).get();
      if (startDoc.exists) {
        queryRef = queryRef.startAfter(startDoc);
      }
    }

    const snap = await queryRef.get();
    const docs = snap.docs.slice(0, limitCount);
    summary.hasMore = snap.docs.length > limitCount;
    summary.totalFlipbooks = docs.length;

    for (const doc of docs) {
      const res = await migrateSingleFlipbook(doc.id);
      if (res.success) {
        summary.migratedCount += 1;
      } else {
        summary.failedCount += 1;
        summary.errors.push({ flipbookId: doc.id, error: res.error || 'Unknown error' });
      }
      summary.lastProcessedId = doc.id;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Workspace migration failed';
    summary.errors.push({ flipbookId: 'all', error: msg });
  }

  return summary;
}

/**
 * Migrates a single legacy Flipbook document and its associated pages to the Document model.
 */
export async function migrateSingleFlipbook(flipbookId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('flipbooks').doc(flipbookId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: `Flipbook ${flipbookId} not found` };
    }

    const flipbook = snap.data() as FlipbookConfig;
    const { document, version, source, experience, accessPolicy, layers } = flipbookToDocumentAggregate(flipbook);

    // 1. Commit Document Aggregate entities
    const mainBatch = adminDb.batch();
    mainBatch.set(adminDb.collection('documents').doc(document.id), document, { merge: true });
    mainBatch.set(adminDb.collection('document_versions').doc(version.id), version, { merge: true });
    mainBatch.set(adminDb.collection('document_sources').doc(source.id), source, { merge: true });
    mainBatch.set(adminDb.collection('viewer_experiences').doc(experience.id), experience, { merge: true });
    mainBatch.set(adminDb.collection('access_policies').doc(accessPolicy.documentId), accessPolicy, { merge: true });

    layers.forEach((layer) => {
      mainBatch.set(adminDb.collection('document_layers').doc(layer.id), layer, { merge: true });
    });

    await mainBatch.commit();

    // 2. Fetch and migrate legacy pages in batches of 150
    const pagesSnap = await adminDb.collection('flipbook_pages').where('flipbookId', '==', flipbookId).get();
    const BATCH_SIZE = 150;

    for (let i = 0; i < pagesSnap.docs.length; i += BATCH_SIZE) {
      const chunk = pagesSnap.docs.slice(i, i + BATCH_SIZE);
      const pageBatch = adminDb.batch();

      chunk.forEach((pDoc) => {
        const legacyPage = pDoc.data() as FlipbookPage;
        const docPage: DocumentPage = flipbookPageToDocumentPage(legacyPage, version.id, flipbook.workspaceId);
        const targetRef = adminDb.collection('document_pages').doc(docPage.id);
        pageBatch.set(targetRef, docPage, { merge: true });
      });

      await pageBatch.commit();
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Migration failed';
    return { success: false, error: msg };
  }
}


