'use server';

/**
 * @file src/lib/insight-actions.ts
 * @description Next.js Server Actions for managing `page_insights` in Firestore.
 * Supports diagnostic insight persistence, dismissal, and 1-click recommendation execution.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Input validation & security checks prior to adminDb execution.
 * - Exception isolation returning `{ success, data, error }`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { AIInsight } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/**
 * Saves or updates an AIInsight in Firestore.
 */
export async function saveInsightAction(insight: AIInsight): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  try {
    if (
      !insight.id ||
      !insight.pageId ||
      !insight.organizationId ||
      !insight.title
    ) {
      return { success: false, error: 'Unauthorized or missing required insight parameters' };
    }

    const docRef = adminDb.collection('page_insights').doc(insight.id);
    await docRef.set(insight, { merge: true });

    revalidatePath(`/admin/pages/${insight.pageId}/builder`);
    return { success: true, id: insight.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save insight';
    console.error('>>> [INSIGHT] Save Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Fetches active AI Insights for a landing page.
 */
export async function fetchPageInsightsAction(
  pageId: string,
): Promise<{ success: boolean; insights?: AIInsight[]; error?: string }> {
  try {
    if (!pageId) {
      return { success: false, error: 'Page ID is required' };
    }

    const snap = await adminDb
      .collection('page_insights')
      .where('pageId', '==', pageId)
      .where('status', '==', 'active')
      .orderBy('severity', 'asc')
      .get();

    const insights = snap.docs.map((doc) => doc.data() as AIInsight);
    return { success: true, insights };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch insights';
    console.error('>>> [INSIGHT] Fetch Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Dismisses an AI Insight so it no longer appears in the Builder Studio drawer.
 */
export async function dismissInsightAction(
  insightId: string,
  pageId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!insightId || !pageId) {
      return { success: false, error: 'Missing required dismissal parameters' };
    }

    const docRef = adminDb.collection('page_insights').doc(insightId);
    await docRef.update({
      status: 'dismissed',
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/admin/pages/${pageId}/builder`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to dismiss insight';
    console.error('>>> [INSIGHT] Dismiss Failed:', message);
    return { success: false, error: message };
  }
}
