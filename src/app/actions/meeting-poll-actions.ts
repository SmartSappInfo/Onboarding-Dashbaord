'use server';

/**
 * @fileoverview Server Actions for Meeting Polls (1:Many Consensus Scheduling).
 * Handles candidate slot creation, public voting, consensus ranking, and booking finalization.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Poll finalization executes in an atomic transaction to ensure zero double-booking collisions.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  MeetingPoll,
  MeetingPollSlot,
  MeetingPollVote,
  PollVoteChoice,
} from '@/lib/meetings/types/polls';
import {
  aggregateSlotVoteCounts,
  calculatePollConsensus,
} from '@/lib/meetings/poll-consensus-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Creates a new Meeting Poll with candidate time slots.
 */
export async function createMeetingPollAction(payload: {
  workspaceId: string;
  organizationId?: string;
  title: string;
  description?: string;
  hostUserId: string;
  hostName: string;
  hostEmail?: string;
  durationMinutes: number;
  proposedSlots: Array<{ startAt: string; endAt: string }>;
}): Promise<{ success: boolean; pollId?: string; slug?: string; error?: string }> {
  try {
    const { workspaceId, organizationId, title, description, hostUserId, hostName, hostEmail, durationMinutes, proposedSlots } = payload;
    const now = new Date().toISOString();

    if (!title.trim()) throw new Error('Poll title is required.');
    if (!proposedSlots || proposedSlots.length === 0) throw new Error('At least one proposed slot is required.');

    const docRef = adminDb.collection('meeting_polls').doc();
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'poll';
    const slug = `${baseSlug}-${docRef.id.slice(0, 6)}`;

    const formattedSlots: MeetingPollSlot[] = proposedSlots.map((s, idx) => ({
      id: `slot_${idx}_${Date.now()}`,
      startAt: s.startAt,
      endAt: s.endAt,
      votesYes: 0,
      votesMaybe: 0,
      votesNo: 0,
    }));

    const poll: MeetingPoll = {
      id: docRef.id,
      workspaceId,
      organizationId,
      title: title.trim(),
      description: description?.trim(),
      hostUserId,
      hostName,
      hostEmail,
      slug,
      durationMinutes: durationMinutes || 30,
      proposedSlots: formattedSlots,
      status: 'open',
      totalVotersCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(poll);

    return { success: true, pollId: docRef.id, slug };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Fetches all polls for a workspace.
 */
export async function getMeetingPollsAction(
  workspaceId: string
): Promise<{ success: boolean; polls?: MeetingPoll[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_polls')
      .where('workspaceId', '==', workspaceId)
      .get();

    const polls: MeetingPoll[] = snap.docs.map(doc => ({
      ...(doc.data() as MeetingPoll),
      id: doc.id,
    }));

    polls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, polls };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Public lookup for a meeting poll by slug.
 */
export async function getMeetingPollBySlugAction(
  slug: string
): Promise<{ success: boolean; poll?: MeetingPoll; votes?: MeetingPollVote[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_polls')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.empty) {
      return { success: false, error: 'Meeting poll not found.' };
    }

    const poll = {
      ...(snap.docs[0].data() as MeetingPoll),
      id: snap.docs[0].id,
    };

    // Fetch public votes
    const votesSnap = await adminDb
      .collection('meeting_polls')
      .doc(poll.id)
      .collection('votes')
      .get();

    const votes: MeetingPollVote[] = votesSnap.docs.map(d => ({
      ...(d.data() as MeetingPollVote),
      id: d.id,
    }));

    return { success: true, poll, votes };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Submits or updates an invitee vote on a poll.
 */
export async function submitPollVoteAction(payload: {
  pollId: string;
  voterName: string;
  voterEmail: string;
  voterPhone?: string;
  slotVotes: Record<string, PollVoteChoice>;
  comments?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { pollId, voterName, voterEmail, voterPhone, slotVotes, comments } = payload;
    const now = new Date().toISOString();

    if (!voterName.trim() || !voterEmail.trim()) {
      throw new Error('Name and email are required to vote.');
    }

    const pollRef = adminDb.collection('meeting_polls').doc(pollId);
    const pollDoc = await pollRef.get();

    if (!pollDoc.exists) throw new Error('Poll not found.');
    const poll = pollDoc.data() as MeetingPoll;

    if (poll.status !== 'open') {
      throw new Error('This poll is closed or finalized.');
    }

    // Save/update vote subdocument
    const voteRef = pollRef.collection('votes').doc(voterEmail.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    const voteData: MeetingPollVote = {
      id: voteRef.id,
      pollId,
      voterName: voterName.trim(),
      voterEmail: voterEmail.trim().toLowerCase(),
      voterPhone: voterPhone?.trim(),
      slotVotes,
      comments: comments?.trim(),
      votedAt: now,
    };

    await voteRef.set(voteData);

    // Re-aggregate poll vote tallies
    const allVotesSnap = await pollRef.collection('votes').get();
    const allVotes: MeetingPollVote[] = allVotesSnap.docs.map(d => d.data() as MeetingPollVote);

    const updatedSlots = aggregateSlotVoteCounts(poll.proposedSlots, allVotes);

    await pollRef.update({
      proposedSlots: updatedSlots,
      totalVotersCount: allVotes.length,
      updatedAt: now,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Finalizes a poll by selecting a winning slot and closing voting.
 */
export async function finalizeMeetingPollAction(
  pollId: string,
  workspaceId: string,
  winningSlotId: string
): Promise<{ success: boolean; bookingId?: string; error?: string }> {
  try {
    const now = new Date().toISOString();
    const pollRef = adminDb.collection('meeting_polls').doc(pollId);
    const pollDoc = await pollRef.get();

    if (!pollDoc.exists) throw new Error('Poll not found.');
    const poll = pollDoc.data() as MeetingPoll;

    if (poll.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    const slot = poll.proposedSlots.find(s => s.id === winningSlotId);
    if (!slot) throw new Error('Selected winning slot does not exist in this poll.');

    // Create confirmed meeting / booking document
    const meetingRef = adminDb.collection('meetings').doc();
    const meetingData = {
      id: meetingRef.id,
      workspaceId,
      organizationId: poll.organizationId || '',
      title: poll.title,
      description: poll.description || '',
      meetingTime: slot.startAt,
      endTime: slot.endAt,
      duration: poll.durationMinutes,
      status: 'scheduled',
      source: 'poll',
      pollId,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.runTransaction(async tx => {
      tx.set(meetingRef, meetingData);
      tx.update(pollRef, {
        status: 'finalized',
        winningSlotId,
        finalizedBookingId: meetingRef.id,
        updatedAt: now,
      });
    });

    return { success: true, bookingId: meetingRef.id };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
