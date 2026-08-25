'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for AI Document Intelligence Server Actions:
 *    Fetches active version page text buffers, generates summaries, recommends conversion hotspots,
 *    and answers reader questions with grounded page citations (PRD Sections 2600–2625).
 * 2. Multi-Tenant Authorization Invariant:
 *    All operations strictly verify `workspaceId` tenant ownership.
 * 3. Atomic Layer Application:
 *    When applying an AI recommendation, creates a new `DocumentLayer` entity under `document_layers`.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  Document,
  DocumentPage,
  DocumentAiSummary,
  DocumentAiCtaRecommendation,
  DocumentAiMessage,
  DocumentAiQaResponse,
  DocumentLayer,
} from '@/lib/types/document-types';
import {
  generateDocumentSummary,
  recommendDocumentHotspots,
  answerDocumentQuestion,
} from './ai-document-service';

export async function generateDocumentSummaryAction(
  workspaceId: string,
  documentId: string
): Promise<{ success: boolean; summary?: DocumentAiSummary; error?: string }> {
  try {
    if (!workspaceId || !documentId) {
      return { success: false, error: 'Workspace ID and Document ID are required.' };
    }

    // 1. Fetch document
    const docSnap = await adminDb.collection('documents').doc(documentId).get();
    if (!docSnap.exists) {
      return { success: false, error: 'Document not found.' };
    }
    const docData = docSnap.data() as Document;
    if (docData.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized.' };
    }

    // 2. Fetch pages for active version
    const versionId = docData.activeVersionId;
    const pagesSnap = await adminDb
      .collection('document_pages')
      .where('documentId', '==', documentId)
      .where('versionId', '==', versionId)
      .orderBy('pageNumber', 'asc')
      .get();

    const pages = pagesSnap.docs.map((p) => p.data() as DocumentPage);
    const pageTexts = pages.map((p) => p.extractedText || '').filter(Boolean);

    const summary = generateDocumentSummary(documentId, pageTexts, docData.title);

    return { success: true, summary };
  } catch (err) {
    console.error('Error generating document summary:', err);
    return { success: false, error: 'Failed to generate document AI summary.' };
  }
}

export async function recommendDocumentHotspotsAction(
  workspaceId: string,
  documentId: string
): Promise<{ success: boolean; recommendations?: DocumentAiCtaRecommendation[]; error?: string }> {
  try {
    if (!workspaceId || !documentId) {
      return { success: false, error: 'Workspace ID and Document ID are required.' };
    }

    const docSnap = await adminDb.collection('documents').doc(documentId).get();
    if (!docSnap.exists) {
      return { success: false, error: 'Document not found.' };
    }
    const docData = docSnap.data() as Document;
    if (docData.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized.' };
    }

    const versionId = docData.activeVersionId;
    const pagesSnap = await adminDb
      .collection('document_pages')
      .where('documentId', '==', documentId)
      .where('versionId', '==', versionId)
      .orderBy('pageNumber', 'asc')
      .get();

    const pages = pagesSnap.docs.map((p) => {
      const data = p.data() as DocumentPage;
      return {
        pageNumber: data.pageNumber,
        text: data.extractedText || '',
      };
    });

    const recommendations = recommendDocumentHotspots(documentId, pages);

    return { success: true, recommendations };
  } catch (err) {
    console.error('Error recommending document hotspots:', err);
    return { success: false, error: 'Failed to generate CTA recommendations.' };
  }
}

export async function askDocumentQuestionAction(
  workspaceId: string,
  documentId: string,
  question: string,
  history: DocumentAiMessage[] = []
): Promise<{ success: boolean; response?: DocumentAiQaResponse; error?: string }> {
  try {
    if (!workspaceId || !documentId || !question.trim()) {
      return { success: false, error: 'Invalid parameters.' };
    }

    const docSnap = await adminDb.collection('documents').doc(documentId).get();
    if (!docSnap.exists) {
      return { success: false, error: 'Document not found.' };
    }
    const docData = docSnap.data() as Document;
    if (docData.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized.' };
    }

    const versionId = docData.activeVersionId;
    const pagesSnap = await adminDb
      .collection('document_pages')
      .where('documentId', '==', documentId)
      .where('versionId', '==', versionId)
      .orderBy('pageNumber', 'asc')
      .get();

    const pages = pagesSnap.docs.map((p) => {
      const data = p.data() as DocumentPage;
      return {
        pageNumber: data.pageNumber,
        text: data.extractedText || '',
      };
    });

    const response = answerDocumentQuestion({
      documentId,
      question,
      history,
      pages,
    });

    return { success: true, response };
  } catch (err) {
    console.error('Error answering document question:', err);
    return { success: false, error: 'Failed to answer document question.' };
  }
}

export async function applyAiRecommendedHotspotAction(
  workspaceId: string,
  documentId: string,
  recommendation: DocumentAiCtaRecommendation
): Promise<{ success: boolean; layerId?: string; error?: string }> {
  try {
    if (!workspaceId || !documentId || !recommendation) {
      return { success: false, error: 'Invalid recommendation parameters.' };
    }

    const docSnap = await adminDb.collection('documents').doc(documentId).get();
    if (!docSnap.exists) {
      return { success: false, error: 'Document not found.' };
    }
    const docData = docSnap.data() as Document;
    if (docData.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized.' };
    }

    // Find the page ID for this pageNumber
    const pageSnap = await adminDb
      .collection('document_pages')
      .where('documentId', '==', documentId)
      .where('versionId', '==', docData.activeVersionId)
      .where('pageNumber', '==', recommendation.pageNumber)
      .limit(1)
      .get();

    if (pageSnap.empty) {
      return { success: false, error: `Page ${recommendation.pageNumber} not found.` };
    }
    const pageDoc = pageSnap.docs[0];

    const layerRef = adminDb.collection('document_layers').doc();
    const newLayer: DocumentLayer = {
      id: layerRef.id,
      documentId,
      versionId: docData.activeVersionId,
      pageId: pageDoc.id,
      pageNumber: recommendation.pageNumber,
      type: recommendation.suggestedLayerType,
      x: recommendation.x,
      y: recommendation.y,
      width: recommendation.width,
      height: recommendation.height,
      visible: true,
      title: recommendation.buttonLabel,
      content: {
        text: recommendation.buttonLabel,
      },
      action: {
        type: recommendation.suggestedAction.type,
        targetUrl: recommendation.suggestedAction.targetUrl,
        phoneNumber: recommendation.suggestedAction.phoneNumber,
        emailAddress: recommendation.suggestedAction.emailAddress,
        whatsappNumber: recommendation.suggestedAction.whatsappNumber,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await layerRef.set(newLayer);

    return { success: true, layerId: layerRef.id };
  } catch (err) {
    console.error('Error applying AI recommended hotspot:', err);
    return { success: false, error: 'Failed to apply recommended hotspot layer.' };
  }
}

export async function saveAiSummaryToDocumentMetadataAction(
  workspaceId: string,
  documentId: string,
  summary: DocumentAiSummary
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('documents').doc(documentId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return { success: false, error: 'Document not found.' };
    }
    const docData = docSnap.data() as Document;
    if (docData.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized.' };
    }

    await docRef.update({
      description: summary.executiveSummary,
      tags: summary.topics,
      metadata: {
        ...(docData.metadata || {}),
        aiSummary: summary.executiveSummary,
        aiKeyTakeaways: summary.keyTakeaways,
        aiTargetAudience: summary.targetAudience,
        aiReadingTimeMinutes: summary.estimatedReadingTimeMinutes,
        aiSummaryGeneratedAt: summary.generatedAt,
      },
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    console.error('Error saving AI summary to document metadata:', err);
    return { success: false, error: 'Failed to save summary to document metadata.' };
  }
}
