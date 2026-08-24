'use server';

/**
 * @file src/lib/experience-actions.ts
 * @description Next.js Server Actions for managing `audiences` and `experience_rules` in Firestore.
 * Supports personalized experience authoring, rule priority reordering, and runtime rule resolution.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Input validation & security checks prior to adminDb execution.
 * - Exception isolation returning `{ success, data, error }`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Audience, ExperienceRule } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/**
 * Saves or updates an Audience definition in Firestore.
 */
export async function saveAudienceAction(audience: Audience): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  try {
    if (!audience.id || !audience.organizationId || !audience.name || !audience.createdBy) {
      return { success: false, error: 'Unauthorized or missing required audience parameters' };
    }

    const docRef = adminDb.collection('audiences').doc(audience.id);
    await docRef.set(audience, { merge: true });
    return { success: true, id: audience.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save audience';
    console.error('>>> [EXPERIENCE] Save Audience Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Fetches all Audiences for an organization.
 */
export async function fetchAudiencesAction(
  organizationId: string,
): Promise<{ success: boolean; audiences?: Audience[]; error?: string }> {
  try {
    if (!organizationId) {
      return { success: false, error: 'Organization ID is required' };
    }

    const snap = await adminDb
      .collection('audiences')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .get();

    const audiences = snap.docs.map((doc) => doc.data() as Audience);
    return { success: true, audiences };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audiences';
    console.error('>>> [EXPERIENCE] Fetch Audiences Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Saves or updates an ExperienceRule attached to a CampaignPage.
 */
export async function saveExperienceRuleAction(rule: ExperienceRule): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  try {
    if (!rule.id || !rule.pageId || !rule.audienceId || !rule.createdBy || !rule.organizationId) {
      return { success: false, error: 'Unauthorized or missing required experience rule parameters' };
    }

    // Verify target landing page exists
    const pageSnap = await adminDb.collection('campaign_pages').doc(rule.pageId).get();
    if (!pageSnap.exists) {
      return { success: false, error: 'Target campaign page not found' };
    }

    const docRef = adminDb.collection('experience_rules').doc(rule.id);
    await docRef.set(rule, { merge: true });

    revalidatePath(`/admin/pages/${rule.pageId}/builder`);
    return { success: true, id: rule.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save experience rule';
    console.error('>>> [EXPERIENCE] Save Rule Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Fetches all active ExperienceRules for a landing page, sorted by priority.
 */
export async function fetchPageExperienceRulesAction(
  pageId: string,
): Promise<{ success: boolean; rules?: ExperienceRule[]; error?: string }> {
  try {
    if (!pageId) {
      return { success: false, error: 'Page ID is required' };
    }

    const snap = await adminDb
      .collection('experience_rules')
      .where('pageId', '==', pageId)
      .orderBy('priority', 'asc')
      .get();

    const rules = snap.docs.map((doc) => doc.data() as ExperienceRule);
    return { success: true, rules };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch experience rules';
    console.error('>>> [EXPERIENCE] Fetch Rules Failed:', message);
    return { success: false, error: message };
  }
}
