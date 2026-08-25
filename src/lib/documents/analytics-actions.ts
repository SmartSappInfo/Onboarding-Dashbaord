'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Analytics Server Actions:
 *    Fetches telemetry events, viewer sessions, and captured leads from Firestore,
 *    computing multi-layer business intelligence summaries (PRD Sections 21–24, 30 & 87).
 * 2. Multi-Tenant Authorization Invariant:
 *    All analytics queries enforce `workspaceId` tenant scoping.
 * 3. High-Load Resilience:
 *    Uses indexed queries and pre-aggregations, capped to date-filtered ranges.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { DocumentAnalyticsSummary, DocumentEvent, ViewerSession } from '@/lib/types/document-types';
import { aggregateTelemetryData } from './analytics-service';

export interface GetAnalyticsOptions {
  workspaceId: string;
  documentId: string;
  period?: 'last_7_days' | 'last_30_days' | 'all_time';
}

export async function getDocumentAnalyticsAction(
  options: GetAnalyticsOptions
): Promise<{ success: boolean; analytics?: DocumentAnalyticsSummary; error?: string }> {
  try {
    const { workspaceId, documentId, period = 'all_time' } = options;

    if (!workspaceId || !documentId) {
      return { success: false, error: 'Workspace ID and Document ID are required.' };
    }

    // 1. Fetch document metadata for pageCount
    const docSnap = await adminDb.collection('documents').doc(documentId).get();
    if (!docSnap.exists || docSnap.data()?.workspaceId !== workspaceId) {
      return { success: false, error: 'Document not found or access denied.' };
    }

    const docData = docSnap.data();
    const pageCount = docData?.pageCount || 1;

    // 2. Compute date cutoff
    let dateCutoff: string | null = null;
    if (period === 'last_7_days') {
      dateCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === 'last_30_days') {
      dateCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // 3. Query events
    let eventsQuery = adminDb
      .collection('document_events')
      .where('workspaceId', '==', workspaceId)
      .where('documentId', '==', documentId);

    if (dateCutoff) {
      eventsQuery = eventsQuery.where('occurredAt', '>=', dateCutoff);
    }

    const eventsSnap = await eventsQuery.get();
    const events = eventsSnap.docs.map((d) => d.data() as DocumentEvent);

    // 4. Query sessions
    let sessionsQuery = adminDb
      .collection('viewer_sessions')
      .where('workspaceId', '==', workspaceId)
      .where('documentId', '==', documentId);

    if (dateCutoff) {
      sessionsQuery = sessionsQuery.where('startedAt', '>=', dateCutoff);
    }

    const sessionsSnap = await sessionsQuery.get();
    const sessions = sessionsSnap.docs.map((d) => d.data() as ViewerSession);

    // 5. Query leads count
    const leadsSnap = await adminDb
      .collection('flipbook_leads')
      .where('workspaceId', '==', workspaceId)
      .where('documentId', '==', documentId)
      .get();

    const leadsCount = leadsSnap.size;

    // 6. Aggregate data
    const analytics = aggregateTelemetryData({
      documentId,
      workspaceId,
      pageCount,
      events,
      sessions,
      leadsCount,
      period,
    });

    return { success: true, analytics };
  } catch (err) {
    console.error('Error fetching document analytics:', err);
    return { success: false, error: 'Failed to fetch document analytics.' };
  }
}
