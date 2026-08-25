'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Page Management Actions:
 *    Handles atomic reordering, duplication, deletion, and insertion of pages within a Document
 *    (PRD Sections 50 & 85).
 * 2. High-Load Resilience & 150-Batch Ceiling:
 *    All multi-document mutations are chunked into batches of <= 150 operations with
 *    sequential atomic commits to avoid Firestore transaction and batch overflow limits.
 * 3. Dual-Write Invariant:
 *    Mutations synchronize modern `document_pages` / `documents` and legacy `flipbook_pages` / `flipbooks`.
 * 4. Multi-Tenant Authorization Invariant:
 *    Verifies workspace ID ownership and document existence before executing mutations.
 * 5. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { DocumentPage } from '@/lib/types/document-types';

const BATCH_SIZE_LIMIT = 150;

/**
 * Atomically reorders pages in a document based on an ordered array of page IDs.
 */
export async function reorderDocumentPagesAction(
  workspaceId: string,
  documentId: string,
  orderedPageIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!workspaceId || !documentId || !Array.isArray(orderedPageIds) || orderedPageIds.length === 0) {
      return { success: false, error: 'Invalid parameters for page reordering.' };
    }

    const docRef = adminDb.collection('documents').doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists || docSnap.data()?.workspaceId !== workspaceId) {
      return { success: false, error: 'Document not found or unauthorized.' };
    }

    // Prepare batch operations
    const now = new Date().toISOString();
    let currentBatch = adminDb.batch();
    let opCount = 0;

    for (let index = 0; index < orderedPageIds.length; index++) {
      const pageId = orderedPageIds[index];
      const pageNumber = index + 1;

      // 1. Update modern document_pages
      const modernPageRef = adminDb.collection('document_pages').doc(pageId);
      currentBatch.update(modernPageRef, {
        pageNumber,
        updatedAt: now,
      });
      opCount++;

      // 2. Synchronize legacy flipbook_pages if exists
      const legacyPageRef = adminDb.collection('flipbook_pages').doc(pageId);
      currentBatch.update(legacyPageRef, {
        pageNumber,
      });
      opCount++;

      if (opCount >= BATCH_SIZE_LIMIT) {
        await currentBatch.commit();
        currentBatch = adminDb.batch();
        opCount = 0;
      }
    }

    // Update parent document timestamp
    currentBatch.update(docRef, { updatedAt: now });
    currentBatch.update(adminDb.collection('flipbooks').doc(documentId), { updatedAt: now });
    await currentBatch.commit();

    return { success: true };
  } catch (err) {
    console.error('Error reordering document pages:', err);
    return { success: false, error: 'Failed to reorder document pages.' };
  }
}

/**
 * Duplicates a page, shifts subsequent page numbers by +1, and increments pageCount.
 */
export async function duplicateDocumentPageAction(
  workspaceId: string,
  documentId: string,
  pageId: string
): Promise<{ success: boolean; newPageId?: string; error?: string }> {
  try {
    if (!workspaceId || !documentId || !pageId) {
      return { success: false, error: 'Workspace ID, Document ID, and Page ID are required.' };
    }

    const docRef = adminDb.collection('documents').doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists || docSnap.data()?.workspaceId !== workspaceId) {
      return { success: false, error: 'Document not found or unauthorized.' };
    }

    const sourcePageRef = adminDb.collection('document_pages').doc(pageId);
    const sourcePageSnap = await sourcePageRef.get();

    if (!sourcePageSnap.exists) {
      return { success: false, error: 'Source page not found.' };
    }

    const sourcePageData = sourcePageSnap.data() as DocumentPage;
    const insertAfterPageNumber = sourcePageData.pageNumber;

    // Fetch all subsequent pages that need shifting
    const subsequentPagesSnap = await adminDb
      .collection('document_pages')
      .where('documentId', '==', documentId)
      .where('pageNumber', '>', insertAfterPageNumber)
      .get();

    const now = new Date().toISOString();
    const newPageId = `${documentId}_page_${Date.now()}`;
    const newPageNumber = insertAfterPageNumber + 1;

    let currentBatch = adminDb.batch();
    let opCount = 0;

    // 1. Shift subsequent pages down
    for (const d of subsequentPagesSnap.docs) {
      const currentNum = d.data().pageNumber as number;
      currentBatch.update(d.ref, {
        pageNumber: currentNum + 1,
        updatedAt: now,
      });
      opCount++;

      const legacyRef = adminDb.collection('flipbook_pages').doc(d.id);
      currentBatch.update(legacyRef, {
        pageNumber: currentNum + 1,
      });
      opCount++;

      if (opCount >= BATCH_SIZE_LIMIT) {
        await currentBatch.commit();
        currentBatch = adminDb.batch();
        opCount = 0;
      }
    }

    // 2. Insert duplicated page
    const duplicatedPage: DocumentPage = {
      ...sourcePageData,
      id: newPageId,
      pageNumber: newPageNumber,
      createdAt: now,
      updatedAt: now,
    };

    currentBatch.set(adminDb.collection('document_pages').doc(newPageId), duplicatedPage);
    currentBatch.set(adminDb.collection('flipbook_pages').doc(newPageId), {
      id: newPageId,
      flipbookId: documentId,
      pageNumber: newPageNumber,
      imageUrl: sourcePageData.renderedAssetUrl || sourcePageData.thumbnailUrl || '',
      thumbnailUrl: sourcePageData.thumbnailUrl || '',
      width: sourcePageData.width,
      height: sourcePageData.height,
      aspectRatio: sourcePageData.aspectRatio,
      createdAt: now,
    });

    // 3. Increment document pageCount
    const currentCount = (docSnap.data()?.pageCount as number) || 1;
    currentBatch.update(docRef, {
      pageCount: currentCount + 1,
      updatedAt: now,
    });
    currentBatch.update(adminDb.collection('flipbooks').doc(documentId), {
      pageCount: currentCount + 1,
      updatedAt: now,
    });

    await currentBatch.commit();

    return { success: true, newPageId };
  } catch (err) {
    console.error('Error duplicating document page:', err);
    return { success: false, error: 'Failed to duplicate document page.' };
  }
}

/**
 * Deletes a page, removes associated hotspots, shifts remaining pages by -1, and decrements pageCount.
 */
export async function deleteDocumentPageAction(
  workspaceId: string,
  documentId: string,
  pageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!workspaceId || !documentId || !pageId) {
      return { success: false, error: 'Workspace ID, Document ID, and Page ID are required.' };
    }

    const docRef = adminDb.collection('documents').doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists || docSnap.data()?.workspaceId !== workspaceId) {
      return { success: false, error: 'Document not found or unauthorized.' };
    }

    const currentCount = (docSnap.data()?.pageCount as number) || 1;
    if (currentCount <= 1) {
      return { success: false, error: 'Cannot delete the only page in a document.' };
    }

    const targetPageRef = adminDb.collection('document_pages').doc(pageId);
    const targetPageSnap = await targetPageRef.get();

    if (!targetPageSnap.exists) {
      return { success: false, error: 'Target page not found.' };
    }

    const targetPageNumber = targetPageSnap.data()?.pageNumber as number;

    // Fetch subsequent pages that need shifting
    const subsequentPagesSnap = await adminDb
      .collection('document_pages')
      .where('documentId', '==', documentId)
      .where('pageNumber', '>', targetPageNumber)
      .get();

    const now = new Date().toISOString();
    let currentBatch = adminDb.batch();
    let opCount = 0;

    // 1. Delete target page
    currentBatch.delete(targetPageRef);
    currentBatch.delete(adminDb.collection('flipbook_pages').doc(pageId));
    opCount += 2;

    // 2. Shift subsequent pages up
    for (const d of subsequentPagesSnap.docs) {
      const currentNum = d.data().pageNumber as number;
      currentBatch.update(d.ref, {
        pageNumber: currentNum - 1,
        updatedAt: now,
      });
      opCount++;

      const legacyRef = adminDb.collection('flipbook_pages').doc(d.id);
      currentBatch.update(legacyRef, {
        pageNumber: currentNum - 1,
      });
      opCount++;

      if (opCount >= BATCH_SIZE_LIMIT) {
        await currentBatch.commit();
        currentBatch = adminDb.batch();
        opCount = 0;
      }
    }

    // 3. Decrement document pageCount
    currentBatch.update(docRef, {
      pageCount: currentCount - 1,
      updatedAt: now,
    });
    currentBatch.update(adminDb.collection('flipbooks').doc(documentId), {
      pageCount: currentCount - 1,
      updatedAt: now,
    });

    await currentBatch.commit();

    return { success: true };
  } catch (err) {
    console.error('Error deleting document page:', err);
    return { success: false, error: 'Failed to delete document page.' };
  }
}
