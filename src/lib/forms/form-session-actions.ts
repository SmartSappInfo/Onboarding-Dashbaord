'use server';

/**
 * Forms 2.0 Session & Event Tracking Actions
 * 
 * Records form view sessions and interaction milestones to support
 * conversion funnel intelligence and abandonment drop-off analytics.
 */

import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '../collection-constants';
import type { FormSession, FormEvent } from './form-types';

/**
 * Initializes a new FormSession when a respondent opens a form.
 */
export async function initializeFormSessionAction(input: {
  formId: string;
  versionId?: string;
  workspaceId: string;
  organizationId: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  ipAddress?: string;
  userAgent?: string;
  device?: 'desktop' | 'tablet' | 'mobile';
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const timestamp = new Date().toISOString();
    const sessionRef = adminDb.collection('form_sessions').doc();

    const session: FormSession = {
      id: sessionRef.id,
      formId: input.formId,
      versionId: input.versionId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      startedAt: timestamp,
      status: 'in_progress',
      pagesViewed: ['page_1'],
      lastActivePageId: 'page_1',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      device: input.device,
    };

    await sessionRef.set(session);
    return { success: true, sessionId: sessionRef.id };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [FORMS:INIT_SESSION] Failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Records a session interaction event (e.g. page transition, abandon).
 */
export async function recordFormEventAction(input: {
  sessionId: string;
  formId: string;
  eventType: 'page_view' | 'page_next' | 'page_back' | 'form_submit' | 'form_abandon';
  pageId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const timestamp = new Date().toISOString();
    const eventRef = adminDb.collection('form_events').doc();

    const event: FormEvent = {
      id: eventRef.id,
      sessionId: input.sessionId,
      formId: input.formId,
      eventType: input.eventType,
      pageId: input.pageId,
      timestamp,
      metadata: input.metadata,
    };

    await eventRef.set(event);

    // If submit or complete event, update the parent session
    if (input.eventType === 'form_submit') {
      await adminDb.collection('form_sessions').doc(input.sessionId).update({
        status: 'completed',
        completedAt: timestamp,
      });
    }

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [FORMS:RECORD_EVENT] Failed:', msg);
    return { success: false, error: msg };
  }
}
