'use server';

/**
 * @file src/lib/orchestration-actions.ts
 * @description Next.js Server Actions for managing `campaign_orchestrations` in Firestore.
 * Supports cross-channel campaign creation, automated WhatsApp/email triggers, and CRM revenue sync.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Input validation & security checks prior to adminDb execution.
 * - Exception isolation returning `{ success, data, error }`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { CampaignOrchestration, PageEvent } from '@/lib/types';
import { orchestrateCampaignEvent } from '@/lib/page-builder/orchestration-engine';
import { revalidatePath } from 'next/cache';

/**
 * Saves or updates a CampaignOrchestration definition in Firestore.
 */
export async function saveCampaignOrchestrationAction(
  orchestration: CampaignOrchestration,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (
      !orchestration.id ||
      !orchestration.pageId ||
      !orchestration.organizationId ||
      !orchestration.name ||
      !orchestration.createdBy
    ) {
      return { success: false, error: 'Unauthorized or missing required orchestration parameters' };
    }

    const docRef = adminDb.collection('campaign_orchestrations').doc(orchestration.id);
    await docRef.set(orchestration, { merge: true });

    revalidatePath(`/admin/pages/${orchestration.pageId}/builder`);
    return { success: true, id: orchestration.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save orchestration';
    console.error('>>> [ORCHESTRATION] Save Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Triggers cross-channel automations (CRM tagging, WhatsApp outreach, email sequences) upon lead conversion.
 */
export async function triggerCrossChannelSyncAction(
  pageId: string,
  event: PageEvent,
): Promise<{ success: boolean; triggersCount?: number; error?: string }> {
  try {
    if (!pageId || !event) {
      return { success: false, error: 'Missing required sync parameters' };
    }

    const snap = await adminDb
      .collection('campaign_orchestrations')
      .where('pageId', '==', pageId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snap.empty) {
      return { success: true, triggersCount: 0 };
    }

    const orchestrationRef = snap.docs[0].ref;
    const orchestration = snap.docs[0].data() as CampaignOrchestration;

    const { triggersDispatched, updatedMetrics } = orchestrateCampaignEvent(event, orchestration);

    // Persist updated metrics back to Firestore
    await orchestrationRef.update({
      metrics: updatedMetrics,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, triggersCount: triggersDispatched.length };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to trigger cross-channel sync';
    console.error('>>> [ORCHESTRATION] Sync Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Fetches active Campaign Orchestrations for a landing page.
 */
export async function fetchCampaignOrchestrationsAction(
  pageId: string,
): Promise<{ success: boolean; orchestrations?: CampaignOrchestration[]; error?: string }> {
  try {
    if (!pageId) {
      return { success: false, error: 'Page ID is required' };
    }

    const snap = await adminDb
      .collection('campaign_orchestrations')
      .where('pageId', '==', pageId)
      .orderBy('createdAt', 'desc')
      .get();

    const orchestrations = snap.docs.map((doc) => doc.data() as CampaignOrchestration);
    return { success: true, orchestrations };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch orchestrations';
    console.error('>>> [ORCHESTRATION] Fetch Failed:', message);
    return { success: false, error: message };
  }
}
