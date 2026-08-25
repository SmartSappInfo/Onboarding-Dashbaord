'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Workspace-Wide Advanced Analytics Server Actions:
 *    Fetches documents, sessions, events, and leads for an entire workspace,
 *    computing portfolio KPIs, 5-stage conversion funnels, and multi-document comparison matrices (PRD Sections 22–24, 76–85 & 100–110).
 * 2. Multi-Tenant Authorization Invariant:
 *    All queries strictly filter by `workspaceId`.
 * 3. High-Load Resilience:
 *    Limits unconstrained data pulls by enforcing date range boundaries (`last_7_days`, `last_30_days`, `all_time`).
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Document, DocumentEvent, ViewerSession, WorkspaceAdvancedAnalyticsSummary } from '@/lib/types/document-types';
import { aggregateWorkspaceAdvancedAnalytics } from './advanced-analytics-service';

export async function getWorkspaceAdvancedAnalyticsAction(
  workspaceId: string,
  period: 'last_7_days' | 'last_30_days' | 'all_time' = 'last_30_days'
): Promise<{ success: boolean; analytics?: WorkspaceAdvancedAnalyticsSummary; error?: string }> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'Workspace ID is required.' };
    }

    // 1. Fetch all documents in workspace
    const docsSnap = await adminDb
      .collection('documents')
      .where('workspaceId', '==', workspaceId)
      .get();

    const documents = docsSnap.docs.map((d) => d.data() as Document);

    // 2. Compute date cutoff
    let dateCutoff: string | null = null;
    if (period === 'last_7_days') {
      dateCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === 'last_30_days') {
      dateCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // 3. Query sessions
    let sessionsQuery = adminDb
      .collection('viewer_sessions')
      .where('workspaceId', '==', workspaceId);

    if (dateCutoff) {
      sessionsQuery = sessionsQuery.where('startedAt', '>=', dateCutoff);
    }

    const sessionsSnap = await sessionsQuery.get();
    const sessions = sessionsSnap.docs.map((d) => d.data() as ViewerSession);

    // 4. Query events
    let eventsQuery = adminDb
      .collection('document_events')
      .where('workspaceId', '==', workspaceId);

    if (dateCutoff) {
      eventsQuery = eventsQuery.where('occurredAt', '>=', dateCutoff);
    }

    const eventsSnap = await eventsQuery.get();
    const events = eventsSnap.docs.map((d) => d.data() as DocumentEvent);

    // 5. Query leads
    const leadsSnap = await adminDb
      .collection('flipbook_leads')
      .where('workspaceId', '==', workspaceId)
      .get();

    const leads = leadsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        documentId: data.documentId as string | undefined,
        campaignId: data.campaignId as string | undefined,
        createdAt: data.createdAt as string,
      };
    });

    // 6. Aggregate analytics
    const analytics = aggregateWorkspaceAdvancedAnalytics({
      workspaceId,
      period,
      documents,
      sessions,
      events,
      leads,
    });

    return { success: true, analytics };
  } catch (err) {
    console.error('Error fetching workspace advanced analytics:', err);
    return { success: false, error: 'Failed to fetch workspace advanced analytics.' };
  }
}
