'use server';

/**
 * @fileoverview Server Actions for AI Meeting Speech Coaching & Conversation Dynamics.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Scorecards are persisted to `meeting_speech_coaching` collection.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { SpeechCoachingScorecard } from '@/lib/meetings/types/speech-coach';
import type { TranscriptSegment, TranscriptSpeaker } from '@/lib/meetings/types/intelligence';
import { analyzeConversationDynamics } from '@/lib/meetings/speech-coach-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Analyzes transcript segments and saves an AI Speech Coaching scorecard.
 */
export async function analyzeMeetingSpeechCoachingAction(payload: {
  meetingId: string;
  workspaceId: string;
  segments: TranscriptSegment[];
  speakers: TranscriptSpeaker[];
}): Promise<{ success: boolean; scorecard?: SpeechCoachingScorecard; error?: string }> {
  try {
    const { meetingId, workspaceId, segments, speakers } = payload;
    const scorecard = analyzeConversationDynamics(segments, speakers, meetingId, workspaceId);

    const docRef = adminDb.collection('meeting_speech_coaching').doc(meetingId);
    await docRef.set(scorecard);

    return { success: true, scorecard };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Retrieves AI speech coaching scorecard for a meeting.
 */
export async function getMeetingSpeechCoachingAction(
  meetingId: string
): Promise<{ success: boolean; scorecard?: SpeechCoachingScorecard; error?: string }> {
  try {
    const doc = await adminDb.collection('meeting_speech_coaching').doc(meetingId).get();
    if (!doc.exists) {
      return { success: false, error: 'No coaching scorecard found for this meeting.' };
    }

    return { success: true, scorecard: doc.data() as SpeechCoachingScorecard };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
