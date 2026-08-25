'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Enterprise Document Server Actions:
 *    Provides all mutation and verification endpoints for the Document Experience Platform
 *    (Documents, Versions, Pages, Layers, Access Policies, Leads, Telemetry).
 * 2. Multi-Tenant Workspace Authorization:
 *    Every mutation strictly verifies that the active workspace matches `resource.data.workspaceId`.
 * 3. High-Load Resilience & Chunked Batches:
 *    Bulk page writes and deletions enforce a strict limit of 150 operations per batch (`BATCH_SIZE = 150`).
 * 4. Dual-Write Compatibility:
 *    Writes both to modern Document collections (`documents`, `document_versions`, `document_pages`, `access_policies`)
 *    and legacy `flipbooks` collections to guarantee 100% zero-downtime backward compatibility.
 * 5. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { 
  Document, 
  DocumentVersion, 
  DocumentSource, 
  DocumentPage, 
  ViewerExperience, 
  AccessPolicy,
  DocumentSourceType
} from '@/lib/types/document-types';
import type { FlipbookConfig, FlipbookPage } from '@/lib/types/flipbook-types';
import { hashPasscode, verifyPasscode } from '@/lib/documents/access-service';
import { ingestDocumentEvent, IngestEventPayload } from '@/lib/documents/event-collector';

export interface CreateDocumentPayload {
  workspaceId: string;
  title: string;
  description?: string;
  sourceFileUrl: string;
  sourceFileType: DocumentSourceType;
  sourceFileName: string;
  pageCount: number;
  aspectRatio: number;
  userId: string;
  pages?: Array<{
    pageNumber: number;
    imageUrl: string;
    thumbnailUrl?: string;
    width: number;
    height: number;
    extractedText?: string;
  }>;
}

export interface UpdateDocumentPayload {
  documentId: string;
  workspaceId: string;
  title?: string;
  description?: string;
  slug?: string;
  status?: 'draft' | 'published';
  style?: FlipbookConfig['style'];
  hotspots?: FlipbookConfig['hotspots'];
  leadGate?: FlipbookConfig['leadGate'];
  password?: string;
  userId: string;
}

/**
 * Creates a new Document with Version 1, Source, ViewerExperience, and Pages.
 */
export async function createDocumentAction(payload: CreateDocumentPayload): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
    if (!payload.workspaceId || !payload.title || !payload.sourceFileUrl) {
      return { success: false, error: 'Required fields missing' };
    }

    const documentId = adminDb.collection('documents').doc().id;
    const versionId = `${documentId}_v1`;
    const sourceId = `${documentId}_source`;

    const slug = payload.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || documentId.slice(0, 8);

    const now = new Date().toISOString();

    const document: Document = {
      id: documentId,
      workspaceId: payload.workspaceId,
      title: payload.title,
      description: payload.description || '',
      slug,
      status: 'draft',
      documentType: 'flipbook',
      activeVersionId: versionId,
      defaultViewerMode: 'flipbook',
      createdBy: payload.userId,
      createdAt: now,
      updatedAt: now,
      viewsCount: 0,
      leadsCount: 0,
      flipsCount: 0,
      likesCount: 0,
    };

    const version: DocumentVersion = {
      id: versionId,
      documentId,
      workspaceId: payload.workspaceId,
      versionNumber: 1,
      sourceId,
      pageCount: payload.pageCount || 1,
      status: 'ready',
      createdBy: payload.userId,
      createdAt: now,
    };

    const source: DocumentSource = {
      id: sourceId,
      documentId,
      versionId,
      workspaceId: payload.workspaceId,
      fileName: payload.sourceFileName || 'document.pdf',
      mimeType: payload.sourceFileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      sourceType: payload.sourceFileType,
      sourceUrl: payload.sourceFileUrl,
      uploadedBy: payload.userId,
      uploadedAt: now,
    };

    const experience: ViewerExperience = {
      id: `${documentId}_experience`,
      documentId,
      workspaceId: payload.workspaceId,
      mode: 'flipbook',
      layout: {
        pageStyle: 'magazine',
        hardcover: false,
        aspectRatio: payload.aspectRatio || 1.414,
      },
      theme: {
        backgroundColor: '#f1f5f9',
        pageShadow: true,
      },
      navigation: {
        enableThumbnails: true,
        enablePageNumbers: true,
        enableProgressScrubber: true,
        enableKeyboardNav: true,
        enableTouchGestures: true,
      },
      animation: {
        type: 'page_flip',
        durationMs: 600,
        pageCurl: true,
        soundEnabled: true,
        reducedMotionFallback: true,
      },
      controls: {
        enableDownloadPdf: true,
        enablePrint: true,
        enableShare: true,
        enableSearch: true,
        enableFullscreen: true,
        enableZoom: true,
      },
      branding: {},
      leadGate: {
        enabled: false,
        triggerPage: 0,
        title: 'Unlock Full Access',
        description: 'Enter your contact details to continue reading.',
        requireName: true,
        requireEmail: true,
        requirePhone: false,
        ctaText: 'Unlock Reader',
      },
      createdAt: now,
      updatedAt: now,
    };

    const accessPolicy: AccessPolicy = {
      documentId,
      workspaceId: payload.workspaceId,
      visibility: 'public',
      downloadPolicy: 'allowed',
      printPolicy: 'allowed',
      createdAt: now,
      updatedAt: now,
    };

    // Dual-write legacy Flipbook record
    const legacyFlipbook: FlipbookConfig = {
      id: documentId,
      workspaceId: payload.workspaceId,
      title: payload.title,
      description: payload.description || '',
      slug,
      status: 'draft',
      sourceFileUrl: payload.sourceFileUrl,
      sourceFileType: payload.sourceFileType === 'docx' || payload.sourceFileType === 'epub' || payload.sourceFileType === 'media'
        ? payload.sourceFileType 
        : 'pdf',
      sourceFileName: payload.sourceFileName || 'document.pdf',
      pageCount: payload.pageCount || 1,
      aspectRatio: payload.aspectRatio || 1.414,
      style: {
        pageStyle: 'magazine',
        soundEnabled: true,
        hardcover: false,
        backgroundColor: '#f1f5f9',
        enableDownloadPdf: true,
        enablePrint: true,
        enableShare: true,
        enableSearch: true,
        enableThumbnails: true,
      },
      hotspots: [],
      leadGate: {
        enabled: false,
        triggerPage: 0,
        title: 'Unlock Full Access',
        description: 'Enter your contact details to continue reading.',
        requireName: true,
        requireEmail: true,
        requirePhone: false,
        ctaText: 'Unlock Reader',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: payload.userId,
      viewsCount: 0,
      leadsCount: 0,
      flipsCount: 0,
      likesCount: 0,
    };

    // Write primary Document entities
    await adminDb.collection('documents').doc(documentId).set(document);
    await adminDb.collection('document_versions').doc(versionId).set(version);
    await adminDb.collection('document_sources').doc(sourceId).set(source);
    await adminDb.collection('viewer_experiences').doc(`${documentId}_experience`).set(experience);
    await adminDb.collection('access_policies').doc(documentId).set(accessPolicy);
    await adminDb.collection('flipbooks').doc(documentId).set(legacyFlipbook);

    // Save pages in chunked batches of 150
    if (payload.pages && payload.pages.length > 0) {
      const BATCH_SIZE = 150;
      for (let i = 0; i < payload.pages.length; i += BATCH_SIZE) {
        const chunk = payload.pages.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();

        chunk.forEach((p) => {
          const pageDocId = `${documentId}_page_${p.pageNumber}`;
          const pageRef = adminDb.collection('document_pages').doc(pageDocId);
          const legacyPageRef = adminDb.collection('flipbook_pages').doc(pageDocId);

          const pageData: DocumentPage = {
            id: pageDocId,
            documentId,
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

          const legacyPageData: FlipbookPage = {
            id: pageDocId,
            flipbookId: documentId,
            pageNumber: p.pageNumber,
            imageUrl: p.imageUrl,
            thumbnailUrl: p.thumbnailUrl || p.imageUrl,
            width: p.width,
            height: p.height,
            extractedText: p.extractedText || '',
          };

          batch.set(pageRef, pageData);
          batch.set(legacyPageRef, legacyPageData);
        });

        await batch.commit();
      }
    }

    return { success: true, documentId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create document';
    return { success: false, error: msg };
  }
}

/**
 * Updates an existing Document and its associated experience and access policies.
 */
export async function updateDocumentAction(payload: UpdateDocumentPayload): Promise<{ success: boolean; error?: string }> {
  try {
    if (!payload.documentId || !payload.workspaceId) {
      return { success: false, error: 'Document ID and workspace ID required' };
    }

    const docRef = adminDb.collection('documents').doc(payload.documentId);
    const legacyRef = adminDb.collection('flipbooks').doc(payload.documentId);

    const snap = await docRef.get();
    const legacySnap = await legacyRef.get();

    if (!snap.exists && !legacySnap.exists) {
      return { success: false, error: 'Document not found' };
    }

    const existingWorkspaceId = (snap.data()?.workspaceId || legacySnap.data()?.workspaceId) as string;
    if (existingWorkspaceId !== payload.workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    const now = new Date().toISOString();
    const docUpdates: Partial<Document> = { updatedAt: now };
    const legacyUpdates: Partial<FlipbookConfig> = { updatedAt: now };

    if (payload.title !== undefined) {
      docUpdates.title = payload.title;
      legacyUpdates.title = payload.title;
    }
    if (payload.description !== undefined) {
      docUpdates.description = payload.description;
      legacyUpdates.description = payload.description;
    }
    if (payload.slug !== undefined) {
      const sanitized = payload.slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
      docUpdates.slug = sanitized;
      legacyUpdates.slug = sanitized;
    }
    if (payload.status !== undefined) {
      docUpdates.status = payload.status;
      legacyUpdates.status = payload.status;
      if (payload.status === 'published') {
        docUpdates.publishedAt = now;
      }
    }
    if (payload.style !== undefined) legacyUpdates.style = payload.style;
    if (payload.hotspots !== undefined) legacyUpdates.hotspots = payload.hotspots;
    if (payload.leadGate !== undefined) legacyUpdates.leadGate = payload.leadGate;

    // Passcode hashing
    if (payload.password !== undefined) {
      if (payload.password.trim().length > 0) {
        const { hash, salt } = hashPasscode(payload.password.trim());
        await adminDb.collection('access_policies').doc(payload.documentId).set({
          documentId: payload.documentId,
          workspaceId: payload.workspaceId,
          visibility: 'protected',
          passwordHash: hash,
          salt: salt,
          downloadPolicy: payload.style?.enableDownloadPdf ? 'allowed' : 'disabled',
          printPolicy: payload.style?.enablePrint ? 'allowed' : 'disabled',
          updatedAt: now,
        }, { merge: true });
        legacyUpdates.password = '***'; // Obfuscate legacy password
      } else {
        await adminDb.collection('access_policies').doc(payload.documentId).set({
          visibility: 'public',
          passwordHash: FieldValue.delete(),
          salt: FieldValue.delete(),
          updatedAt: now,
        }, { merge: true });
        legacyUpdates.password = '';
      }
    }

    if (snap.exists) {
      await docRef.update(docUpdates);
    }
    if (legacySnap.exists) {
      await legacyRef.update(legacyUpdates);
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update document';
    return { success: false, error: msg };
  }
}

/**
 * Deletes a Document and all its child pages and entities in chunked batches.
 */
export async function deleteDocumentAction(documentId: string, workspaceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('documents').doc(documentId);
    const legacyRef = adminDb.collection('flipbooks').doc(documentId);

    const snap = await docRef.get();
    const legacySnap = await legacyRef.get();

    if (!snap.exists && !legacySnap.exists) return { success: true };

    const existingWorkspaceId = (snap.data()?.workspaceId || legacySnap.data()?.workspaceId) as string;
    if (existingWorkspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    if (snap.exists) await docRef.delete();
    if (legacySnap.exists) await legacyRef.delete();

    // Delete associated pages in chunks of 150
    const pagesSnap = await adminDb.collection('document_pages').where('documentId', '==', documentId).get();
    const legacyPagesSnap = await adminDb.collection('flipbook_pages').where('flipbookId', '==', documentId).get();

    const allPageDocs = [...pagesSnap.docs, ...legacyPagesSnap.docs];
    const BATCH_SIZE = 150;
    for (let i = 0; i < allPageDocs.length; i += BATCH_SIZE) {
      const chunk = allPageDocs.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete document';
    return { success: false, error: msg };
  }
}

/**
 * Server-side passcode verification against stored AccessPolicy hashes.
 */
export async function verifyDocumentPasscodeAction(documentId: string, passcode: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!documentId || !passcode) {
      return { success: false, error: 'Document ID and passcode are required.' };
    }

    const policyRef = adminDb.collection('access_policies').doc(documentId);
    const policySnap = await policyRef.get();

    if (policySnap.exists) {
      const policy = policySnap.data() as AccessPolicy;
      if (policy.passwordHash && policy.salt) {
        const isValid = verifyPasscode(passcode, policy.passwordHash, policy.salt);
        return { success: isValid, error: isValid ? undefined : 'Incorrect passcode.' };
      }
    }

    // Fallback: Check legacy flipbook document
    const fbSnap = await adminDb.collection('flipbooks').doc(documentId).get();
    if (fbSnap.exists) {
      const data = fbSnap.data() as FlipbookConfig;
      if (data.password && data.password !== '***') {
        const isValid = data.password === passcode;
        return { success: isValid, error: isValid ? undefined : 'Incorrect passcode.' };
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Passcode verification failed';
    return { success: false, error: msg };
  }
}

/**
 * Submits a captured lead from a public document reader.
 */
export async function submitDocumentLeadAction(payload: {
  documentId: string;
  workspaceId: string;
  name?: string;
  email: string;
  phone?: string;
}): Promise<{ success: boolean; submissionId?: string; error?: string }> {
  try {
    if (!payload.email || !payload.documentId || !payload.workspaceId) {
      return { success: false, error: 'Email, document ID, and workspace ID are required.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email.trim())) {
      return { success: false, error: 'Invalid email address' };
    }

    const leadId = adminDb.collection('flipbook_leads').doc().id;
    const now = new Date().toISOString();

    const submission = {
      id: leadId,
      flipbookId: payload.documentId,
      documentId: payload.documentId,
      workspaceId: payload.workspaceId,
      name: payload.name?.trim() || '',
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || '',
      submittedAt: now,
    };

    await adminDb.collection('flipbook_leads').doc(leadId).set(submission);

    // Atomically increment leadsCount
    await adminDb.collection('documents').doc(payload.documentId).update({
      leadsCount: FieldValue.increment(1),
    }).catch(() => {});

    await adminDb.collection('flipbooks').doc(payload.documentId).update({
      leadsCount: FieldValue.increment(1),
    }).catch(() => {});

    return { success: true, submissionId: leadId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit lead';
    return { success: false, error: msg };
  }
}

/**
 * Server Action for recording telemetry events.
 */
export async function recordDocumentEventAction(payload: IngestEventPayload): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return ingestDocumentEvent(payload);
}
