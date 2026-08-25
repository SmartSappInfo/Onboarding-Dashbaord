'use server';

/**
 * @fileoverview Server Actions for Conference Sessions in SmartSapp Meetings 2.0.
 * Handles conference session persistence, link resolution, and provider status updates.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { ConferenceSession } from '@/lib/meetings/types';
import {
  generateConferenceSession,
  type GenerateConferenceSessionInput,
} from '@/lib/meetings/conference-adapters';
import { logMeetingActivity } from '@/lib/meetings/activity-logger';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Retrieves the ConferenceSession associated with a meeting.
 */
export async function getConferenceSessionAction(
  meetingId: string
): Promise<{ success: boolean; session?: ConferenceSession; error?: string }> {
  try {
    const snap = await adminDb
      .collection('conference_sessions')
      .where('meetingId', '==', meetingId)
      .limit(1)
      .get();

    if (snap.empty) {
      return { success: false, error: 'Conference session not found.' };
    }

    const session = snap.docs[0].data() as ConferenceSession;
    return { success: true, session };
  } catch (error) {
    console.error('[getConferenceSessionAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Creates or updates a ConferenceSession document for a meeting occurrence.
 */
export async function createOrUpdateConferenceSessionAction(
  input: GenerateConferenceSessionInput
): Promise<{ success: boolean; session?: ConferenceSession; error?: string }> {
  try {
    const existingSnap = await adminDb
      .collection('conference_sessions')
      .where('meetingId', '==', input.meetingId)
      .limit(1)
      .get();

    const now = new Date().toISOString();

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      const docRef = adminDb.collection('conference_sessions').doc(doc.id);

      const generated = generateConferenceSession(input);
      const updates: Partial<ConferenceSession> = {
        provider: input.provider,
        externalMeetingId: input.externalMeetingId,
        joinUrl: generated.joinUrl,
        hostUrl: input.hostUrl,
        dialIn: input.dialIn,
        physicalAddress: input.physicalAddress,
        providerMetadata: input.providerMetadata || {},
        updatedAt: now,
      };

      await docRef.update(updates);
      const updatedSnap = await docRef.get();
      return { success: true, session: updatedSnap.data() as ConferenceSession };
    }

    const newSession = generateConferenceSession(input);
    await adminDb.collection('conference_sessions').doc(newSession.id).set(newSession);

    // Also update meeting document join link
    if (newSession.joinUrl) {
      await adminDb
        .collection('meetings')
        .doc(input.meetingId)
        .update({
          meetingLink: newSession.joinUrl,
          updatedAt: now,
        })
        .catch(() => {});
    }

    await logMeetingActivity({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      type: 'meeting_created',
      description: `Configured conference session provider as ${input.provider}.`,
      metadata: { provider: input.provider },
    });

    return { success: true, session: newSession };
  } catch (error) {
    console.error('[createOrUpdateConferenceSessionAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
