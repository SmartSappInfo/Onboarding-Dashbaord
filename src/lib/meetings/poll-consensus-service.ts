/**
 * @fileoverview Pure Meeting Poll Consensus & Vote Aggregation Service.
 * Implements weighted voting algorithms (Yes=+2, If Need Be=+1, No=-5) and generates voter matrices.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Negative weighting on 'no' ensures times that block any participant are deprioritized.
 */

import type {
  MeetingPollSlot,
  MeetingPollVote,
  PollVoteChoice,
} from './types/polls';

export interface RankedPollSlot extends MeetingPollSlot {
  score: number;
  consensusPercentage: number;
  totalResponses: number;
}

export interface VoterMatrixRow {
  voterName: string;
  voterEmail: string;
  slotVotes: Record<string, PollVoteChoice>;
  votedAt: string;
}

export interface PollVoteMatrix {
  voters: VoterMatrixRow[];
  slotTotals: Record<string, { yes: number; maybe: number; no: number; score: number }>;
  bestSlotId: string | null;
}

/**
 * Re-aggregates vote counters (`votesYes`, `votesMaybe`, `votesNo`) across all proposed slots.
 */
export function aggregateSlotVoteCounts(
  slots: MeetingPollSlot[],
  votes: MeetingPollVote[]
): MeetingPollSlot[] {
  const countsMap = new Map<string, { yes: number; maybe: number; no: number }>();

  for (const slot of slots) {
    countsMap.set(slot.id, { yes: 0, maybe: 0, no: 0 });
  }

  for (const vote of votes) {
    for (const [slotId, choice] of Object.entries(vote.slotVotes)) {
      const current = countsMap.get(slotId);
      if (current) {
        if (choice === 'yes') current.yes += 1;
        else if (choice === 'maybe') current.maybe += 1;
        else if (choice === 'no') current.no += 1;
      }
    }
  }

  return slots.map(slot => {
    const c = countsMap.get(slot.id) || { yes: 0, maybe: 0, no: 0 };
    return {
      ...slot,
      votesYes: c.yes,
      votesMaybe: c.maybe,
      votesNo: c.no,
    };
  });
}

/**
 * Calculates weighted consensus scores for each candidate slot.
 * Weights:
 * - 'yes': +2 points
 * - 'maybe': +1 point
 * - 'no': -5 points (harsh penalty for conflicting participants)
 */
export function calculatePollConsensus(
  slots: MeetingPollSlot[],
  votes: MeetingPollVote[]
): {
  winningSlotId: string | null;
  rankedSlots: RankedPollSlot[];
} {
  if (!slots || slots.length === 0) {
    return { winningSlotId: null, rankedSlots: [] };
  }

  const aggregatedSlots = aggregateSlotVoteCounts(slots, votes);
  const totalVoters = votes.length;

  const ranked: RankedPollSlot[] = aggregatedSlots.map(slot => {
    const score = slot.votesYes * 2 + slot.votesMaybe * 1 - slot.votesNo * 5;
    const maxPossibleScore = totalVoters > 0 ? totalVoters * 2 : 1;
    const normalizedScore = Math.max(0, score);
    const consensusPercentage =
      totalVoters > 0 ? Math.min(100, Math.round((normalizedScore / maxPossibleScore) * 100)) : 0;

    return {
      ...slot,
      score,
      consensusPercentage,
      totalResponses: slot.votesYes + slot.votesMaybe + slot.votesNo,
    };
  });

  // Sort by highest score descending, then by most 'yes' votes, then earliest startAt
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.votesYes !== a.votesYes) return b.votesYes - a.votesYes;
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });

  const winningSlotId = ranked.length > 0 && ranked[0].score > -100 ? ranked[0].id : null;

  return { winningSlotId, rankedSlots: ranked };
}

/**
 * Constructs a tabular voter-by-slot comparison matrix for rendering consensus heat maps.
 */
export function generateVoteMatrix(
  slots: MeetingPollSlot[],
  votes: MeetingPollVote[]
): PollVoteMatrix {
  const voters: VoterMatrixRow[] = votes.map(v => ({
    voterName: v.voterName,
    voterEmail: v.voterEmail,
    slotVotes: v.slotVotes,
    votedAt: v.votedAt,
  }));

  const { winningSlotId, rankedSlots } = calculatePollConsensus(slots, votes);

  const slotTotals: Record<string, { yes: number; maybe: number; no: number; score: number }> = {};
  for (const r of rankedSlots) {
    slotTotals[r.id] = {
      yes: r.votesYes,
      maybe: r.votesMaybe,
      no: r.votesNo,
      score: r.score,
    };
  }

  return {
    voters,
    slotTotals,
    bestSlotId: winningSlotId,
  };
}
