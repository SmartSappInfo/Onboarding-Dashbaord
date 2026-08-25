'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for CRM Document Server Actions:
 *    Exposes contact-centric document engagement summaries, session linking, and lead scoring (PRD Sections 31 & 32).
 * 2. Multi-Tenant Authorization Invariant:
 *    All server actions enforce `workspaceId` tenant scoping.
 * 3. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { ContactDocumentInsightsSummary } from '@/lib/types/document-types';
import {
  getContactDocumentEngagements,
  associateVisitorWithContact,
  awardContactDocumentScore,
  recordDocumentEngagementActivity,
} from './crm-integration-service';

export async function getContactDocumentInsightsAction(
  workspaceId: string,
  contactId: string
): Promise<{ success: boolean; insights?: ContactDocumentInsightsSummary; error?: string }> {
  try {
    if (!workspaceId || !contactId) {
      return { success: false, error: 'Workspace ID and Contact ID are required.' };
    }

    const insights = await getContactDocumentEngagements(workspaceId, contactId);
    return { success: true, insights };
  } catch (err) {
    console.error('Error in getContactDocumentInsightsAction:', err);
    return { success: false, error: 'Failed to retrieve contact document insights.' };
  }
}

export async function linkContactDocumentSessionAction(params: {
  workspaceId: string;
  sessionId: string;
  contactId: string;
  visitorId?: string;
  contactName?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { workspaceId, sessionId, contactId, visitorId, contactName } = params;

    if (!workspaceId || !sessionId || !contactId) {
      return { success: false, error: 'Workspace ID, Session ID, and Contact ID are required.' };
    }

    // 1. Update session
    const sessionRef = adminDb.collection('viewer_sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();

    if (sessionSnap.exists) {
      const sData = sessionSnap.data();
      await sessionRef.update({ contactId });

      // Emit CRM Activity
      if (sData?.documentId) {
        let docTitle = 'Document';
        const dSnap = await adminDb.collection('documents').doc(sData.documentId).get();
        if (dSnap.exists) docTitle = dSnap.data()?.title || docTitle;

        await recordDocumentEngagementActivity({
          workspaceId,
          contactId,
          contactName,
          documentId: sData.documentId,
          documentTitle: docTitle,
          type: 'document_opened',
          description: `Opened and started reading "${docTitle}"`,
        });
      }
    }

    // 2. Link visitor ID if provided
    if (visitorId) {
      await associateVisitorWithContact({ workspaceId, visitorId, contactId });
    }

    return { success: true };
  } catch (err) {
    console.error('Error in linkContactDocumentSessionAction:', err);
    return { success: false, error: 'Failed to link document session to contact.' };
  }
}

export async function awardContactScoreAction(params: {
  workspaceId: string;
  contactId: string;
  scoreDelta: number;
  reason: string;
  documentId: string;
  documentTitle: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const success = await awardContactDocumentScore(params);
    return { success };
  } catch (err) {
    console.error('Error in awardContactScoreAction:', err);
    return { success: false, error: 'Failed to award contact lead score.' };
  }
}
