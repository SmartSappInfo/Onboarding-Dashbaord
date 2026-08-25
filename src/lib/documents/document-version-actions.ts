'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Version Management:
 *    Manages lifecycle, branching, promotion, and archiving for document versions
 *    (`DocumentVersion`) and page sets (`DocumentPage`) (PRD Sections 16–18 & 83).
 * 2. Multi-Tenant Workspace Authorization:
 *    Every mutation strictly verifies that the active workspace matches `resource.data.workspaceId`.
 * 3. High-Load Resilience & Batch Safety:
 *    Page cloning and deletions enforce a strict chunked limit of 150 operations per batch (`BATCH_SIZE = 150`).
 * 4. Dual-Write Compatibility:
 *    When a version is promoted to active, page references are synchronized with legacy `flipbook_pages`
 *    to maintain zero-downtime reader compatibility.
 * 5. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Document, DocumentVersion, DocumentPage } from '@/lib/types/document-types';
import type { FlipbookPage } from '@/lib/types/flipbook-types';

export interface CreateVersionPayload {
  documentId: string;
  workspaceId: string;
  userId: string;
  sourceId?: string;
  cloneFromVersionId?: string;
  pages?: Array<{
    pageNumber: number;
    imageUrl: string;
    thumbnailUrl?: string;
    width: number;
    height: number;
    extractedText?: string;
  }>;
}

/**
 * Creates a new draft DocumentVersion, optionally cloning pages from a previous version.
 */
export async function createDocumentVersionAction(payload: CreateVersionPayload): Promise<{
  success: boolean;
  versionId?: string;
  versionNumber?: number;
  error?: string;
}> {
  try {
    if (!payload.documentId || !payload.workspaceId) {
      return { success: false, error: 'Document ID and workspace ID are required' };
    }

    const docRef = adminDb.collection('documents').doc(payload.documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: 'Parent document not found' };
    }

    const docData = docSnap.data() as Document;
    if (docData.workspaceId !== payload.workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    // Determine next version number
    const versionsSnap = await adminDb.collection('document_versions')
      .where('documentId', '==', payload.documentId)
      .get();

    const existingNumbers = versionsSnap.docs.map((d) => (d.data() as DocumentVersion).versionNumber || 1);
    const nextVersionNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    const versionId = `${payload.documentId}_v${nextVersionNumber}`;
    const now = new Date().toISOString();

    const newVersion: DocumentVersion = {
      id: versionId,
      documentId: payload.documentId,
      workspaceId: payload.workspaceId,
      versionNumber: nextVersionNumber,
      sourceId: payload.sourceId || `${payload.documentId}_source`,
      pageCount: payload.pages?.length || docData.viewsCount || 1,
      status: 'ready',
      createdBy: payload.userId,
      createdAt: now,
    };

    await adminDb.collection('document_versions').doc(versionId).set(newVersion);

    // If new pages are explicitly provided, save them in batches of 150
    if (payload.pages && payload.pages.length > 0) {
      const BATCH_SIZE = 150;
      for (let i = 0; i < payload.pages.length; i += BATCH_SIZE) {
        const chunk = payload.pages.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();

        chunk.forEach((p) => {
          const pageId = `${versionId}_page_${p.pageNumber}`;
          const pageRef = adminDb.collection('document_pages').doc(pageId);

          const pageData: DocumentPage = {
            id: pageId,
            documentId: payload.documentId,
            versionId,
            workspaceId: payload.workspaceId,
            pageNumber: p.pageNumber,
            width: p.width,
            height: p.height,
            aspectRatio: p.width && p.height ? p.width / p.height : 0.707,
            renderedAssetUrl: p.imageUrl,
            thumbnailUrl: p.thumbnailUrl || p.imageUrl,
            extractedText: p.extractedText || '',
            textStatus: p.extractedText ? 'extracted' : 'none',
            processingStatus: 'completed',
            createdAt: now,
            updatedAt: now,
          };

          batch.set(pageRef, pageData);
        });

        await batch.commit();
      }
    } else if (payload.cloneFromVersionId) {
      // Clone pages from existing version in batches of 150
      const sourcePagesSnap = await adminDb.collection('document_pages')
        .where('versionId', '==', payload.cloneFromVersionId)
        .get();

      const BATCH_SIZE = 150;
      for (let i = 0; i < sourcePagesSnap.docs.length; i += BATCH_SIZE) {
        const chunk = sourcePagesSnap.docs.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();

        chunk.forEach((pDoc) => {
          const srcPage = pDoc.data() as DocumentPage;
          const clonedPageId = `${versionId}_page_${srcPage.pageNumber}`;
          const clonedPageRef = adminDb.collection('document_pages').doc(clonedPageId);

          const clonedPage: DocumentPage = {
            ...srcPage,
            id: clonedPageId,
            versionId,
            createdAt: now,
            updatedAt: now,
          };

          batch.set(clonedPageRef, clonedPage);
        });

        await batch.commit();
      }
    }

    return {
      success: true,
      versionId,
      versionNumber: nextVersionNumber,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create document version';
    return { success: false, error: msg };
  }
}

/**
 * Promotes a specific DocumentVersion to become the active version for reader delivery.
 */
export async function promoteDocumentVersionAction(
  documentId: string,
  versionId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!documentId || !versionId || !workspaceId) {
      return { success: false, error: 'Document ID, version ID, and workspace ID are required' };
    }

    const docRef = adminDb.collection('documents').doc(documentId);
    const versionRef = adminDb.collection('document_versions').doc(versionId);

    const docSnap = await docRef.get();
    const versionSnap = await versionRef.get();

    if (!docSnap.exists || !versionSnap.exists) {
      return { success: false, error: 'Document or Version not found' };
    }

    const docData = docSnap.data() as Document;
    const versionData = versionSnap.data() as DocumentVersion;

    if (docData.workspaceId !== workspaceId || versionData.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    const now = new Date().toISOString();

    // 1. Update Document activeVersion pointer
    await docRef.update({
      activeVersionId: versionId,
      updatedAt: now,
    });

    // 2. Fetch version pages and synchronize legacy flipbook_pages
    const versionPagesSnap = await adminDb.collection('document_pages')
      .where('versionId', '==', versionId)
      .get();

    const legacyPagesSnap = await adminDb.collection('flipbook_pages')
      .where('flipbookId', '==', documentId)
      .get();

    // Delete obsolete legacy pages
    const BATCH_SIZE = 150;
    for (let i = 0; i < legacyPagesSnap.docs.length; i += BATCH_SIZE) {
      const chunk = legacyPagesSnap.docs.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Write updated active pages to legacy collection
    for (let i = 0; i < versionPagesSnap.docs.length; i += BATCH_SIZE) {
      const chunk = versionPagesSnap.docs.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      chunk.forEach((pDoc) => {
        const docPage = pDoc.data() as DocumentPage;
        const legacyPageId = `${documentId}_page_${docPage.pageNumber}`;
        const legacyRef = adminDb.collection('flipbook_pages').doc(legacyPageId);

        const legacyPage: FlipbookPage = {
          id: legacyPageId,
          flipbookId: documentId,
          pageNumber: docPage.pageNumber,
          imageUrl: docPage.renderedAssetUrl,
          thumbnailUrl: docPage.thumbnailUrl || docPage.renderedAssetUrl,
          width: docPage.width,
          height: docPage.height,
          extractedText: docPage.extractedText || '',
        };

        batch.set(legacyRef, legacyPage);
      });

      await batch.commit();
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to promote document version';
    return { success: false, error: msg };
  }
}

/**
 * Archives an existing DocumentVersion so it is preserved for history but inactive.
 */
export async function archiveDocumentVersionAction(
  documentId: string,
  versionId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const versionRef = adminDb.collection('document_versions').doc(versionId);
    const versionSnap = await versionRef.get();

    if (!versionSnap.exists) {
      return { success: false, error: 'Version not found' };
    }

    const versionData = versionSnap.data() as DocumentVersion;
    if (versionData.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    await versionRef.update({
      status: 'archived',
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to archive document version';
    return { success: false, error: msg };
  }
}

/**
 * Fetches all versions for a document ordered by versionNumber descending.
 */
export async function getDocumentVersionsAction(
  documentId: string,
  workspaceId: string
): Promise<{ success: boolean; versions?: DocumentVersion[]; error?: string }> {
  try {
    const snap = await adminDb.collection('document_versions')
      .where('documentId', '==', documentId)
      .where('workspaceId', '==', workspaceId)
      .get();

    const versions = snap.docs
      .map((d) => d.data() as DocumentVersion)
      .sort((a, b) => b.versionNumber - a.versionNumber);

    return { success: true, versions };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch document versions';
    return { success: false, error: msg };
  }
}
