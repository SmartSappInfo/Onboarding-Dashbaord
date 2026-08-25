'use server';

/**
 * @fileoverview Server Actions for AI Action Item Extraction & Human-in-the-Loop CRM Sync.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Actions are saved in `meeting_action_items` sub-collection or root collection with meetingId.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { AIActionItemDraft } from '@/lib/meetings/types/ai-assistant';
import { extractActionItemsFromTranscript } from '@/lib/meetings/action-items-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Extracts action items from transcript and saves them in meeting_action_items.
 */
export async function extractAndSaveMeetingActionItemsAction(payload: {
  meetingId: string;
  workspaceId: string;
  transcriptText: string;
}): Promise<{ success: boolean; items?: AIActionItemDraft[]; error?: string }> {
  try {
    const { meetingId, workspaceId, transcriptText } = payload;

    const extracted = extractActionItemsFromTranscript(transcriptText, meetingId, workspaceId);

    const batch = adminDb.batch();
    for (const item of extracted) {
      const ref = adminDb.collection('meeting_action_items').doc(item.id);
      batch.set(ref, item);
    }
    await batch.commit();

    return { success: true, items: extracted };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Fetches all extracted action items for a meeting.
 */
export async function getMeetingActionItemsAction(
  meetingId: string,
  workspaceId: string
): Promise<{ success: boolean; items?: AIActionItemDraft[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_action_items')
      .where('meetingId', '==', meetingId)
      .where('workspaceId', '==', workspaceId)
      .get();

    const items: AIActionItemDraft[] = snap.docs.map(doc => ({
      ...(doc.data() as AIActionItemDraft),
      id: doc.id,
    }));

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { success: true, items };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Approves an action item and marks it as synced to CRM.
 */
export async function approveAndSyncActionItemAction(payload: {
  itemId: string;
  workspaceId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { itemId, workspaceId } = payload;
    const docRef = adminDb.collection('meeting_action_items').doc(itemId);
    const snap = await docRef.get();

    if (!snap.exists) throw new Error('Action item not found.');
    if (snap.data()?.workspaceId !== workspaceId) throw new Error('Unauthorized workspace.');

    await docRef.update({
      isApproved: true,
      syncedToCRM: true,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
