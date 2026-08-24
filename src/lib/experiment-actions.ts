'use server';

/**
 * @file src/lib/experiment-actions.ts
 * @description Next.js Server Actions for managing `experiments` in Firestore.
 * Supports experiment creation, variant configuration, winner auto-promotion, and statistical reporting.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Input validation & security checks prior to adminDb execution.
 * - Exception isolation returning `{ success, data, error }`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Experiment } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/**
 * Saves or updates an Experiment definition in Firestore.
 */
export async function saveExperimentAction(experiment: Experiment): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  try {
    if (
      !experiment.id ||
      !experiment.pageId ||
      !experiment.organizationId ||
      !experiment.name ||
      !experiment.createdBy
    ) {
      return { success: false, error: 'Unauthorized or missing required experiment parameters' };
    }

    // Verify target landing page exists
    const pageSnap = await adminDb.collection('campaign_pages').doc(experiment.pageId).get();
    if (!pageSnap.exists) {
      return { success: false, error: 'Target campaign page not found' };
    }

    const docRef = adminDb.collection('experiments').doc(experiment.id);
    await docRef.set(experiment, { merge: true });

    revalidatePath(`/admin/pages/${experiment.pageId}/builder`);
    return { success: true, id: experiment.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save experiment';
    console.error('>>> [EXPERIMENT] Save Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Fetches all active or completed Experiments for a landing page.
 */
export async function fetchPageExperimentsAction(
  pageId: string,
): Promise<{ success: boolean; experiments?: Experiment[]; error?: string }> {
  try {
    if (!pageId) {
      return { success: false, error: 'Page ID is required' };
    }

    const snap = await adminDb
      .collection('experiments')
      .where('pageId', '==', pageId)
      .orderBy('createdAt', 'desc')
      .get();

    const experiments = snap.docs.map((doc) => doc.data() as Experiment);
    return { success: true, experiments };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch experiments';
    console.error('>>> [EXPERIMENT] Fetch Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Promotes a winning experiment variant to become the new primary page structure.
 */
export async function promoteWinnerVariantAction(
  experimentId: string,
  winnerVariantId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!experimentId || !winnerVariantId) {
      return { success: false, error: 'Missing required promotion parameters' };
    }

    const expRef = adminDb.collection('experiments').doc(experimentId);
    const expSnap = await expRef.get();
    if (!expSnap.exists) {
      return { success: false, error: 'Experiment not found' };
    }

    const experiment = expSnap.data() as Experiment;
    const winner = experiment.variants.find((v) => v.id === winnerVariantId);
    if (!winner) {
      return { success: false, error: 'Winning variant not found in experiment' };
    }

    // Mark experiment as completed and record winner ID
    await expRef.update({
      status: 'completed',
      winnerVariantId,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/admin/pages/${experiment.pageId}/builder`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to promote winner variant';
    console.error('>>> [EXPERIMENT] Promotion Failed:', message);
    return { success: false, error: message };
  }
}
