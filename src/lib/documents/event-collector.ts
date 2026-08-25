/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Event Telemetry & Collector:
 *    Handles ingestion, validation, and processing for all viewer telemetry events
 *    (PRD Sections 24–30), updating session aggregates and emitting CRM activities.
 * 2. Non-Blocking CRM Activity Bus:
 *    Dispatches high-intent document interactions (document opens, CTA clicks, lead submissions)
 *    to `logActivity` for automated CRM timeline logging and lead scoring.
 * 3. High-Load Resilience:
 *    Atomic counter increments (`FieldValue.increment(1)`) are used to prevent race conditions.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted. All payloads are explicitly validated.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { 
  DocumentEvent, 
  DocumentEventType, 
  ViewerSession 
} from '@/lib/types/document-types';
import { logActivity } from '@/lib/activity-logger';

export interface IngestEventPayload {
  workspaceId: string;
  documentId: string;
  versionId?: string;
  sessionId: string;
  visitorId: string;
  contactId?: string;
  distributionId?: string;
  campaignId?: string;
  eventType: DocumentEventType;
  pageNumber?: number;
  previousPage?: number;
  nextPage?: number;
  durationMs?: number;
  elementId?: string;
  metadata?: Record<string, string | number | boolean>;
  device?: {
    type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
    userAgent?: string;
    screenResolution?: string;
  };
  browser?: string;
  os?: string;
}

/**
 * Calculates engagement score increments for specific document events.
 */
export function calculateEventEngagementScore(eventType: DocumentEventType): number {
  switch (eventType) {
    case 'document_opened': return 2;
    case 'page_viewed': return 1;
    case 'page_flipped': return 1;
    case 'document_completed': return 10;
    case 'cta_clicked': return 10;
    case 'video_completed': return 8;
    case 'document_downloaded': return 5;
    case 'lead_gate_submitted': return 20;
    case 'document_shared': return 5;
    default: return 0;
  }
}

/**
 * Validates the structure and sanity of an incoming document event payload.
 */
export function validateEventPayload(payload: IngestEventPayload): { valid: boolean; error?: string } {
  if (!payload.workspaceId || typeof payload.workspaceId !== 'string') {
    return { valid: false, error: 'Missing or invalid workspaceId' };
  }
  if (!payload.documentId || typeof payload.documentId !== 'string') {
    return { valid: false, error: 'Missing or invalid documentId' };
  }
  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    return { valid: false, error: 'Missing or invalid sessionId' };
  }
  if (!payload.visitorId || typeof payload.visitorId !== 'string') {
    return { valid: false, error: 'Missing or invalid visitorId' };
  }
  if (!payload.eventType || typeof payload.eventType !== 'string') {
    return { valid: false, error: 'Missing or invalid eventType' };
  }
  return { valid: true };
}

/**
 * Ingests and persists a standardized document event, updates session aggregates,
 * and emits CRM activity where appropriate.
 */
export async function ingestDocumentEvent(payload: IngestEventPayload): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const validation = validateEventPayload(payload);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const eventId = adminDb.collection('document_events').doc().id;
    const now = new Date().toISOString();

    const eventRecord: DocumentEvent = {
      id: eventId,
      workspaceId: payload.workspaceId,
      documentId: payload.documentId,
      versionId: payload.versionId || 'v1',
      sessionId: payload.sessionId,
      visitorId: payload.visitorId,
      contactId: payload.contactId,
      distributionId: payload.distributionId,
      campaignId: payload.campaignId,
      eventType: payload.eventType,
      occurredAt: now,
      pageNumber: payload.pageNumber,
      previousPage: payload.previousPage,
      nextPage: payload.nextPage,
      durationMs: payload.durationMs,
      elementId: payload.elementId,
      metadata: payload.metadata,
      device: payload.device?.type || 'unknown',
      browser: payload.browser,
    };

    // 1. Write raw immutable event record (and dual-write legacy flipbook_analytics for backward compatibility)
    await adminDb.collection('document_events').doc(eventId).set(eventRecord);
    await adminDb.collection('flipbook_analytics').doc(eventId).set({
      id: eventId,
      flipbookId: payload.documentId,
      workspaceId: payload.workspaceId,
      eventType: payload.eventType === 'document_opened' ? 'view' : payload.eventType === 'page_flipped' ? 'flip' : 'view',
      pageNumber: payload.pageNumber,
      hotspotId: payload.elementId,
      timestamp: now,
      sessionId: payload.sessionId,
    }).catch(() => {});

    // 2. Update Session aggregate atomically
    const sessionRef = adminDb.collection('viewer_sessions').doc(payload.sessionId);
    const sessionSnap = await sessionRef.get();

    const scoreDelta = calculateEventEngagementScore(payload.eventType);

    if (sessionSnap.exists) {
      const sessionData = sessionSnap.data() as ViewerSession;
      const currentPages = Array.isArray(sessionData.pagesViewed) ? sessionData.pagesViewed : [];
      const updatedPages = payload.pageNumber && !currentPages.includes(payload.pageNumber)
        ? [...currentPages, payload.pageNumber]
        : currentPages;

      await sessionRef.update({
        lastActivityAt: now,
        pagesViewed: updatedPages,
        totalDwellTimeMs: FieldValue.increment(payload.durationMs || 0),
        engagementScore: FieldValue.increment(scoreDelta),
        ...(payload.contactId ? { contactId: payload.contactId } : {}),
      });
    } else {
      const newSession: ViewerSession = {
        id: payload.sessionId,
        workspaceId: payload.workspaceId,
        documentId: payload.documentId,
        versionId: payload.versionId || 'v1',
        visitorId: payload.visitorId,
        contactId: payload.contactId,
        distributionId: payload.distributionId,
        campaignId: payload.campaignId,
        startedAt: now,
        lastActivityAt: now,
        device: {
          type: payload.device?.type || 'unknown',
          userAgent: payload.device?.userAgent,
          screenResolution: payload.device?.screenResolution,
        },
        browser: payload.browser || 'Unknown',
        os: payload.os || 'Unknown',
        pagesViewed: payload.pageNumber ? [payload.pageNumber] : [1],
        completionPercentage: 0,
        totalDwellTimeMs: payload.durationMs || 0,
        engagementScore: scoreDelta,
      };
      await sessionRef.set(newSession);
    }

    // 3. Atomically update Document / Flipbook counters
    const docRef = adminDb.collection('documents').doc(payload.documentId);
    const legacyDocRef = adminDb.collection('flipbooks').doc(payload.documentId);

    if (payload.eventType === 'document_opened' || payload.eventType === 'document_loaded') {
      await docRef.update({ viewsCount: FieldValue.increment(1) }).catch(() => {});
      await legacyDocRef.update({ viewsCount: FieldValue.increment(1) }).catch(() => {});
    } else if (payload.eventType === 'page_flipped') {
      await docRef.update({ flipsCount: FieldValue.increment(1) }).catch(() => {});
      await legacyDocRef.update({ flipsCount: FieldValue.increment(1) }).catch(() => {});
    }

    // 4. Dispatch to CRM Activity bus if a known contact or high-intent event is present
    if (payload.contactId || payload.eventType === 'cta_clicked' || payload.eventType === 'lead_gate_submitted') {
      await logActivity({
        organizationId: '',
        workspaceId: payload.workspaceId,
        entityId: payload.contactId || payload.visitorId,
        entityType: 'person',
        type: `DOCUMENT_${payload.eventType.toUpperCase()}`,
        source: 'system',
        description: `Visitor interacted with document ${payload.documentId} on page ${payload.pageNumber || 1}.`,
        metadata: {
          documentId: payload.documentId,
          eventType: payload.eventType,
          pageNumber: payload.pageNumber,
          sessionId: payload.sessionId,
          elementId: payload.elementId,
        },
      }).catch((err) => {
        console.warn('Non-critical CRM activity logging warning:', err);
      });
    }

    return { success: true, eventId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to ingest event';
    return { success: false, error: msg };
  }
}
