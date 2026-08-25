'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Backward Compatibility Wrapper for Flipbook Actions:
 *    Delegates all operations to `document-actions.ts` and `event-collector.ts`
 *    while preserving legacy action signatures for existing callers and test suites.
 * 2. Multi-Tenant Workspace Authorization:
 *    All server actions strictly validate workspace boundaries before mutating resources.
 * 3. High-Load Resilience:
 *    Chunked batch limits (150 ops) and atomic increments are enforced across all operations.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { 
  createDocumentAction, 
  updateDocumentAction, 
  deleteDocumentAction, 
  submitDocumentLeadAction,
  verifyDocumentPasscodeAction,
  recordDocumentEventAction
} from '@/lib/document-actions';
import { ingestDocumentEvent } from '@/lib/documents/event-collector';
import type { 
  FlipbookConfig, 
  FlipbookAnalyticsEvent 
} from '@/lib/types/flipbook-types';
import type { DocumentSourceType, DocumentEventType } from '@/lib/types/document-types';

export interface CreateFlipbookPayload {
  workspaceId: string;
  title: string;
  description?: string;
  sourceFileUrl: string;
  sourceFileType: 'pdf' | 'docx' | 'epub' | 'media';
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

export interface UpdateFlipbookPayload {
  flipbookId: string;
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
 * Legacy wrapper: Creates a new flipbook (and its underlying Document aggregate).
 */
export async function createFlipbookAction(payload: CreateFlipbookPayload): Promise<{ success: boolean; flipbookId?: string; error?: string }> {
  const result = await createDocumentAction({
    workspaceId: payload.workspaceId,
    title: payload.title,
    description: payload.description,
    sourceFileUrl: payload.sourceFileUrl,
    sourceFileType: payload.sourceFileType as DocumentSourceType,
    sourceFileName: payload.sourceFileName,
    pageCount: payload.pageCount,
    aspectRatio: payload.aspectRatio,
    userId: payload.userId,
    pages: payload.pages,
  });

  return {
    success: result.success,
    flipbookId: result.documentId,
    error: result.error,
  };
}

/**
 * Legacy wrapper: Updates an existing flipbook.
 */
export async function updateFlipbookAction(payload: UpdateFlipbookPayload): Promise<{ success: boolean; error?: string }> {
  return updateDocumentAction({
    documentId: payload.flipbookId,
    workspaceId: payload.workspaceId,
    title: payload.title,
    description: payload.description,
    slug: payload.slug,
    status: payload.status,
    style: payload.style,
    hotspots: payload.hotspots,
    leadGate: payload.leadGate,
    password: payload.password,
    userId: payload.userId,
  });
}

/**
 * Legacy wrapper: Deletes a flipbook.
 */
export async function deleteFlipbookAction(flipbookId: string, workspaceId: string): Promise<{ success: boolean; error?: string }> {
  return deleteDocumentAction(flipbookId, workspaceId);
}

/**
 * Legacy wrapper: Submits a flipbook lead.
 */
export async function submitFlipbookLeadAction(payload: {
  flipbookId: string;
  workspaceId: string;
  name?: string;
  email: string;
  phone?: string;
}): Promise<{ success: boolean; submissionId?: string; error?: string }> {
  return submitDocumentLeadAction({
    documentId: payload.flipbookId,
    workspaceId: payload.workspaceId,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
  });
}

/**
 * Legacy wrapper: Logs an analytics event.
 */
export async function logFlipbookAnalyticsAction(event: Omit<FlipbookAnalyticsEvent, 'id' | 'timestamp'>): Promise<{ success: boolean }> {
  const eventTypeMap: Record<string, string> = {
    view: 'document_opened',
    flip: 'page_flipped',
    hotspot_click: 'cta_clicked',
    lead_captured: 'lead_gate_submitted',
    download: 'document_downloaded',
  };

  const eventType = (eventTypeMap[event.eventType] || 'page_viewed') as DocumentEventType;

  const result = await ingestDocumentEvent({
    workspaceId: event.workspaceId,
    documentId: event.flipbookId,
    sessionId: event.sessionId || `ses_${Date.now()}`,
    visitorId: `vis_${Date.now()}`,
    eventType,
    pageNumber: event.pageNumber,
    elementId: event.hotspotId,
  });

  return { success: result.success };
}

export { verifyDocumentPasscodeAction, recordDocumentEventAction };
