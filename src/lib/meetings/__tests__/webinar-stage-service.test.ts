import { describe, it, expect } from 'vitest';
import {
  promoteWaitlistRegistrants,
  rankWebinarQuestions,
} from '../webinar-stage-service';
import type { WebinarQuestion } from '../types/webinar-stage';

describe('Webinar Stage & Moderation Service', () => {
  it('promotes waitlisted registrants in FIFO order up to capacity limit', () => {
    const capacityLimit = 10;
    const confirmedCount = 8; // 2 open seats

    const waitlist = [
      { id: 'w1', registeredAt: '2026-08-25T10:00:00Z' },
      { id: 'w2', registeredAt: '2026-08-25T09:30:00Z' }, // Earlier! Should be first
      { id: 'w3', registeredAt: '2026-08-25T11:00:00Z' },
    ];

    const promoted = promoteWaitlistRegistrants(capacityLimit, confirmedCount, waitlist);
    expect(promoted).toHaveLength(2);
    expect(promoted[0].id).toBe('w2');
    expect(promoted[1].id).toBe('w1');
  });

  it('ranks Q&A questions by answered status, upvotes, and creation timestamp', () => {
    const questions: WebinarQuestion[] = [
      {
        id: 'q1',
        meetingId: 'm1',
        participantId: 'p1',
        participantName: 'Alice',
        questionText: 'Can you explain pricing?',
        upvotesCount: 2,
        upvoterParticipantIds: ['p1', 'p2'],
        isAnswered: true, // Already answered
        createdAt: '2026-08-25T10:00:00Z',
      },
      {
        id: 'q2',
        meetingId: 'm1',
        participantId: 'p2',
        participantName: 'Bob',
        questionText: 'Is there an API?',
        upvotesCount: 5, // Top upvotes unanswered
        upvoterParticipantIds: [],
        isAnswered: false,
        createdAt: '2026-08-25T10:05:00Z',
      },
      {
        id: 'q3',
        meetingId: 'm1',
        participantId: 'p3',
        participantName: 'Charlie',
        questionText: 'Do you support SSO?',
        upvotesCount: 1, // Unanswered low upvotes
        upvoterParticipantIds: [],
        isAnswered: false,
        createdAt: '2026-08-25T10:10:00Z',
      },
    ];

    const ranked = rankWebinarQuestions(questions);
    expect(ranked[0].id).toBe('q2'); // 5 upvotes, unanswered
    expect(ranked[1].id).toBe('q3'); // 1 upvote, unanswered
    expect(ranked[2].id).toBe('q1'); // answered comes last
  });
});
