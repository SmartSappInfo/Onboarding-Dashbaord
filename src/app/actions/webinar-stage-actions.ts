'use server';

/**
 * @fileoverview Server Actions for Live Webinar & Broadcast Stage Moderation.
 * Provides real-time stage roster updates, hand raising, audience Q&A, and waitlist promotions.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Uses atomic operations for question upvoting to prevent race conditions.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  WebinarStageState,
  WebinarPresenter,
  WebinarQuestion,
  PresenterStageStatus,
} from '@/lib/meetings/types/webinar-stage';
import {
  promoteWaitlistRegistrants,
  rankWebinarQuestions,
} from '@/lib/meetings/webinar-stage-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Retrieves full live webinar stage state for moderation console.
 */
export async function getWebinarStageStateAction(
  meetingId: string,
  workspaceId: string
): Promise<{ success: boolean; state?: WebinarStageState; error?: string }> {
  try {
    const meetingDoc = await adminDb.collection('meetings').doc(meetingId).get();
    if (!meetingDoc.exists) throw new Error('Meeting not found.');
    const mData = meetingDoc.data();

    // 1. Fetch participants (registered, attending, waitlisted)
    const participantsSnap = await adminDb
      .collection('meeting_participants')
      .where('meetingId', '==', meetingId)
      .where('workspaceId', '==', workspaceId)
      .get();

    let totalRegistered = 0;
    let totalAttending = 0;
    let waitlistedCount = 0;
    const presenters: WebinarPresenter[] = [];
    const raisedHands: WebinarStageState['raisedHands'] = [];

    for (const doc of participantsSnap.docs) {
      const p = doc.data();
      if (p.status === 'registered' || p.status === 'accepted') totalRegistered++;
      if (p.status === 'in_session') totalAttending++;
      if (p.status === 'waitlisted') waitlistedCount++;

      if (p.role === 'host' || p.role === 'co_host' || p.role === 'guest_speaker') {
        presenters.push({
          userId: p.userId || doc.id,
          name: p.name || 'Presenter',
          email: p.email || '',
          role: p.role,
          status: (p.stageStatus as PresenterStageStatus) || 'on_stage',
          avatarUrl: p.avatarUrl,
        });
      }

      if (p.isHandRaised) {
        raisedHands.push({
          participantId: doc.id,
          participantName: p.name || 'Attendee',
          participantEmail: p.email,
          raisedAt: p.handRaisedAt || new Date().toISOString(),
          isInvitedToStage: Boolean(p.isInvitedToStage),
        });
      }
    }

    // Default presenter if none set
    if (presenters.length === 0) {
      presenters.push({
        userId: mData?.hostUserId || 'host',
        name: mData?.hostName || 'Main Host',
        email: mData?.hostEmail || '',
        role: 'host',
        status: 'on_stage',
      });
    }

    // 2. Fetch Q&A questions
    const questionsSnap = await adminDb
      .collection('webinar_questions')
      .where('meetingId', '==', meetingId)
      .get();

    const rawQuestions: WebinarQuestion[] = questionsSnap.docs.map(doc => ({
      ...(doc.data() as WebinarQuestion),
      id: doc.id,
    }));

    const questions = rankWebinarQuestions(rawQuestions);

    const state: WebinarStageState = {
      meetingId,
      isLive: mData?.status === 'in_progress',
      capacityLimit: Number(mData?.capacityLimit) || 100,
      totalRegistered,
      totalAttending,
      waitlistedCount,
      presenters,
      raisedHands,
      questions,
    };

    return { success: true, state };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Updates a presenter's stage status (e.g. backstage, on_stage).
 */
export async function togglePresenterStageStatusAction(
  meetingId: string,
  workspaceId: string,
  userId: string,
  newStatus: PresenterStageStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_participants')
      .where('meetingId', '==', meetingId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!snap.empty) {
      await snap.docs[0].ref.update({
        stageStatus: newStatus,
        updatedAt: new Date().toISOString(),
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Posts a new audience Q&A question.
 */
export async function postWebinarQuestionAction(
  meetingId: string,
  workspaceId: string,
  participantId: string,
  participantName: string,
  questionText: string
): Promise<{ success: boolean; questionId?: string; error?: string }> {
  try {
    if (!questionText.trim()) throw new Error('Question text is required.');

    const docRef = adminDb.collection('webinar_questions').doc();
    const qData: WebinarQuestion & { workspaceId: string } = {
      id: docRef.id,
      meetingId,
      workspaceId,
      participantId,
      participantName: participantName.trim(),
      questionText: questionText.trim(),
      upvotesCount: 0,
      upvoterParticipantIds: [],
      isAnswered: false,
      createdAt: new Date().toISOString(),
    };

    await docRef.set(qData);
    return { success: true, questionId: docRef.id };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Upvotes a webinar Q&A question atomically.
 */
export async function upvoteWebinarQuestionAction(
  questionId: string,
  participantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('webinar_questions').doc(questionId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error('Question not found.');

    const data = snap.data();
    const upvoters = Array.isArray(data?.upvoterParticipantIds) ? data.upvoterParticipantIds : [];

    if (upvoters.includes(participantId)) {
      // Remove upvote
      await docRef.update({
        upvotesCount: FieldValue.increment(-1),
        upvoterParticipantIds: FieldValue.arrayRemove(participantId),
      });
    } else {
      // Add upvote
      await docRef.update({
        upvotesCount: FieldValue.increment(1),
        upvoterParticipantIds: FieldValue.arrayUnion(participantId),
      });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Promotes waitlisted registrants automatically if capacity allows.
 */
export async function promoteWaitlistRegistrantsAction(
  meetingId: string,
  workspaceId: string,
  capacityLimit: number
): Promise<{ success: boolean; promotedCount?: number; error?: string }> {
  try {
    const participantsSnap = await adminDb
      .collection('meeting_participants')
      .where('meetingId', '==', meetingId)
      .where('workspaceId', '==', workspaceId)
      .get();

    const confirmed = participantsSnap.docs.filter(
      d => d.data().status === 'registered' || d.data().status === 'accepted'
    );
    const waitlisted = participantsSnap.docs
      .filter(d => d.data().status === 'waitlisted')
      .map(d => ({
        id: d.id,
        registeredAt: d.data().createdAt || d.data().registeredAt || new Date().toISOString(),
      }));

    const promotions = promoteWaitlistRegistrants(capacityLimit, confirmed.length, waitlisted);

    const batch = adminDb.batch();
    for (const promo of promotions) {
      batch.update(adminDb.collection('meeting_participants').doc(promo.id), {
        status: 'registered',
        promotedAt: new Date().toISOString(),
      });
    }

    await batch.commit();

    return { success: true, promotedCount: promotions.length };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
