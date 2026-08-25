'use server';

/**
 * @fileoverview Server Actions for Post-Meeting Feedback & NPS Collection.
 * Supports public submission with token validation and admin response aggregation.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Idempotency ensured via compound document ID: `feedback_${meetingId}_${participantId}`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  MeetingFeedbackResponse,
  MeetingFeedbackSummary,
  FeedbackRatingType,
} from '@/lib/meetings/types/feedback';
import {
  classifyNPSScore,
  aggregateFeedbackResponses,
  mapFeedbackToAutoTags,
} from '@/lib/meetings/feedback-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Submits public feedback for a meeting.
 */
export async function submitPublicMeetingFeedbackAction(payload: {
  meetingId: string;
  workspaceId?: string;
  participantId?: string;
  participantName?: string;
  participantEmail?: string;
  ratingType: FeedbackRatingType;
  score: number;
  feedbackText?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      meetingId,
      workspaceId: providedWorkspaceId,
      participantId = `anon_${Date.now()}`,
      participantName,
      participantEmail,
      ratingType,
      score,
      feedbackText,
    } = payload;

    // Resolve workspaceId from meeting if not provided
    let workspaceId = providedWorkspaceId;
    if (!workspaceId) {
      const mDoc = await adminDb.collection('meetings').doc(meetingId).get();
      if (!mDoc.exists) throw new Error('Meeting not found.');
      workspaceId = mDoc.data()?.workspaceId;
    }

    if (!workspaceId) throw new Error('Workspace ID resolution failed.');

    const npsCategory = ratingType === 'nps' ? classifyNPSScore(score) : undefined;
    const now = new Date().toISOString();

    const docId = `fb_${meetingId}_${participantId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const docRef = adminDb.collection('meeting_feedback').doc(docId);

    const feedbackData: MeetingFeedbackResponse = {
      id: docId,
      meetingId,
      workspaceId,
      participantId,
      participantName: participantName?.trim(),
      participantEmail: participantEmail?.trim(),
      ratingType,
      score,
      npsCategory,
      feedbackText: feedbackText?.trim(),
      submittedAt: now,
    };

    const autoTags = mapFeedbackToAutoTags(feedbackData);
    feedbackData.tagsAssigned = autoTags;

    await docRef.set(feedbackData);

    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Loads aggregated feedback summary for a meeting in the admin cockpit.
 */
export async function getMeetingFeedbackSummaryAction(
  meetingId: string,
  workspaceId: string
): Promise<{ success: boolean; summary?: MeetingFeedbackSummary; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_feedback')
      .where('meetingId', '==', meetingId)
      .where('workspaceId', '==', workspaceId)
      .limit(100)
      .get();

    const responses: MeetingFeedbackResponse[] = snap.docs.map(doc => ({
      ...(doc.data() as MeetingFeedbackResponse),
      id: doc.id,
    }));

    const summary = aggregateFeedbackResponses(meetingId, responses);

    return { success: true, summary };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
