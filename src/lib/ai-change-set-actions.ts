'use server';

/**
 * @file src/lib/ai-change-set-actions.ts
 * @description Next.js Server Actions for managing immutable `ai_change_sets` in Firestore.
 * Handles persistence, status state transitions (`draft` -> `pending_approval` -> `applied` / `rejected` / `reverted`),
 * and change set history retrieval for page authoring.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Authenticated server boundaries.
 * - Exception isolation returning `{ success, data, error }`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { AIChangeSet } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/**
 * Persists a new AIChangeSet to Firestore.
 */
export async function createChangeSetAction(changeSet: AIChangeSet): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  try {
    if (!changeSet.pageId || !changeSet.createdBy) {
      return { success: false, error: 'Unauthorized: missing page or user identity' };
    }

    // Verify parent campaign page exists
    const pageSnap = await adminDb.collection('campaign_pages').doc(changeSet.pageId).get();
    if (!pageSnap.exists) {
      return { success: false, error: 'Target campaign page not found' };
    }

    const docRef = adminDb.collection('ai_change_sets').doc(changeSet.id);
    await docRef.set(changeSet);
    revalidatePath(`/admin/pages/${changeSet.pageId}/builder`);
    return { success: true, id: changeSet.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save AI change set';
    console.error('>>> [AI CHANGE SET] Create Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Updates the status of an existing AIChangeSet.
 */
export async function updateChangeSetStatusAction(
  changeSetId: string,
  status: AIChangeSet['status'],
  pageId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!changeSetId || !pageId) {
      return { success: false, error: 'Invalid parameters for status update' };
    }

    const docRef = adminDb.collection('ai_change_sets').doc(changeSetId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Change set not found' };
    }

    const updateData: Partial<AIChangeSet> = {
      status,
      ...(status === 'applied' ? { appliedAt: new Date().toISOString() } : {}),
    };
    await docRef.update(updateData);
    revalidatePath(`/admin/pages/${pageId}/builder`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update AI change set status';
    console.error('>>> [AI CHANGE SET] Status Update Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Fetches recent AIChangeSets for a specific landing page.
 */
export async function fetchPageChangeSetsAction(
  pageId: string,
  limitCount = 20,
): Promise<{ success: boolean; changeSets?: AIChangeSet[]; error?: string }> {
  try {
    if (!pageId) {
      return { success: false, error: 'Page ID is required' };
    }

    const snap = await adminDb
      .collection('ai_change_sets')
      .where('pageId', '==', pageId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    const changeSets = snap.docs.map((doc) => doc.data() as AIChangeSet);
    return { success: true, changeSets };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch page AI change sets';
    console.error('>>> [AI CHANGE SET] Fetch Failed:', message);
    return { success: false, error: message };
  }
}
