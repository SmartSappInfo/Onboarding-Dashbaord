import { describe, it, expect } from 'vitest';
import {
  calculatePollConsensus,
  generateVoteMatrix,
  aggregateSlotVoteCounts,
} from '../poll-consensus-service';
import type { MeetingPollSlot, MeetingPollVote } from '../types/polls';

describe('Meeting Poll Consensus & Voting Service', () => {
  const slotA: MeetingPollSlot = {
    id: 'slot_a',
    startAt: '2026-09-10T10:00:00Z',
    endAt: '2026-09-10T10:30:00Z',
    votesYes: 0,
    votesMaybe: 0,
    votesNo: 0,
  };

  const slotB: MeetingPollSlot = {
    id: 'slot_b',
    startAt: '2026-09-10T14:00:00Z',
    endAt: '2026-09-10T14:30:00Z',
    votesYes: 0,
    votesMaybe: 0,
    votesNo: 0,
  };

  const slotC: MeetingPollSlot = {
    id: 'slot_c',
    startAt: '2026-09-11T09:00:00Z',
    endAt: '2026-09-11T09:30:00Z',
    votesYes: 0,
    votesMaybe: 0,
    votesNo: 0,
  };

  const votes: MeetingPollVote[] = [
    {
      id: 'v1',
      pollId: 'p1',
      voterName: 'Alice',
      voterEmail: 'alice@example.com',
      slotVotes: { slot_a: 'yes', slot_b: 'yes', slot_c: 'no' },
      votedAt: '2026-09-01T12:00:00Z',
    },
    {
      id: 'v2',
      pollId: 'p1',
      voterName: 'Bob',
      voterEmail: 'bob@example.com',
      slotVotes: { slot_a: 'yes', slot_b: 'maybe', slot_c: 'yes' },
      votedAt: '2026-09-01T12:05:00Z',
    },
    {
      id: 'v3',
      pollId: 'p1',
      voterName: 'Charlie',
      voterEmail: 'charlie@example.com',
      slotVotes: { slot_a: 'yes', slot_b: 'no', slot_c: 'yes' },
      votedAt: '2026-09-01T12:10:00Z',
    },
  ];

  it('aggregates slot votes accurately across all voters', () => {
    const aggregated = aggregateSlotVoteCounts([slotA, slotB, slotC], votes);

    const a = aggregated.find(s => s.id === 'slot_a')!;
    expect(a.votesYes).toBe(3);
    expect(a.votesMaybe).toBe(0);
    expect(a.votesNo).toBe(0);

    const b = aggregated.find(s => s.id === 'slot_b')!;
    expect(b.votesYes).toBe(1);
    expect(b.votesMaybe).toBe(1);
    expect(b.votesNo).toBe(1);

    const c = aggregated.find(s => s.id === 'slot_c')!;
    expect(c.votesYes).toBe(2);
    expect(c.votesMaybe).toBe(0);
    expect(c.votesNo).toBe(1);
  });

  it('identifies slot A as unanimous winner with 100% consensus', () => {
    const { winningSlotId, rankedSlots } = calculatePollConsensus([slotA, slotB, slotC], votes);

    expect(winningSlotId).toBe('slot_a');
    expect(rankedSlots[0].id).toBe('slot_a');
    expect(rankedSlots[0].score).toBe(6); // 3 * 2 = 6
    expect(rankedSlots[0].consensusPercentage).toBe(100);

    // Slot B score: 1*2 + 1*1 - 1*5 = -2
    const slotBRank = rankedSlots.find(s => s.id === 'slot_b')!;
    expect(slotBRank.score).toBe(-2);
  });

  it('generates complete tabular comparison matrix for heat map display', () => {
    const matrix = generateVoteMatrix([slotA, slotB, slotC], votes);

    expect(matrix.voters).toHaveLength(3);
    expect(matrix.voters[0].voterName).toBe('Alice');
    expect(matrix.bestSlotId).toBe('slot_a');
    expect(matrix.slotTotals['slot_a'].yes).toBe(3);
  });
});
