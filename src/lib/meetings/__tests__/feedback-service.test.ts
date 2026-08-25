import { describe, it, expect } from 'vitest';
import {
  classifyNPSScore,
  aggregateFeedbackResponses,
  mapFeedbackToAutoTags,
} from '../feedback-service';
import type { MeetingFeedbackResponse } from '../types/feedback';

describe('Post-Meeting Feedback & NPS Service', () => {
  it('classifies NPS ratings into promoters, passives, and detractors', () => {
    expect(classifyNPSScore(10)).toBe('promoter');
    expect(classifyNPSScore(9)).toBe('promoter');
    expect(classifyNPSScore(8)).toBe('passive');
    expect(classifyNPSScore(7)).toBe('passive');
    expect(classifyNPSScore(6)).toBe('detractor');
    expect(classifyNPSScore(0)).toBe('detractor');
  });

  it('aggregates responses and calculates net promoter score %', () => {
    const responses: MeetingFeedbackResponse[] = [
      {
        id: 'r1',
        meetingId: 'm1',
        workspaceId: 'w1',
        participantId: 'p1',
        ratingType: 'nps',
        score: 10, // promoter
        submittedAt: '2026-08-25T10:00:00Z',
      },
      {
        id: 'r2',
        meetingId: 'm1',
        workspaceId: 'w1',
        participantId: 'p2',
        ratingType: 'nps',
        score: 9, // promoter
        submittedAt: '2026-08-25T10:05:00Z',
      },
      {
        id: 'r3',
        meetingId: 'm1',
        workspaceId: 'w1',
        participantId: 'p3',
        ratingType: 'nps',
        score: 8, // passive
        submittedAt: '2026-08-25T10:10:00Z',
      },
      {
        id: 'r4',
        meetingId: 'm1',
        workspaceId: 'w1',
        participantId: 'p4',
        ratingType: 'nps',
        score: 5, // detractor
        submittedAt: '2026-08-25T10:15:00Z',
      },
    ];

    const summary = aggregateFeedbackResponses('m1', responses);

    expect(summary.totalResponses).toBe(4);
    // (10 + 9 + 8 + 5) / 4 = 8.0
    expect(summary.averageScore).toBe(8);
    expect(summary.promotersCount).toBe(2);
    expect(summary.passivesCount).toBe(1);
    expect(summary.detractorsCount).toBe(1);
    // NPS = ((2 - 1) / 4) * 100 = +25
    expect(summary.npsScore).toBe(25);
  });

  it('maps feedback scores to CRM tags', () => {
    const promoterResp: MeetingFeedbackResponse = {
      id: 'r1',
      meetingId: 'm1',
      workspaceId: 'w1',
      participantId: 'p1',
      ratingType: 'nps',
      score: 10,
      submittedAt: '2026-08-25T10:00:00Z',
    };

    const tags = mapFeedbackToAutoTags(promoterResp);
    expect(tags).toContain('feedback:completed');
    expect(tags).toContain('nps:promoter');
    expect(tags).toContain('advocate');

    const detractorResp: MeetingFeedbackResponse = {
      id: 'r2',
      meetingId: 'm1',
      workspaceId: 'w1',
      participantId: 'p2',
      ratingType: 'nps',
      score: 4,
      submittedAt: '2026-08-25T10:00:00Z',
    };

    const detractorTags = mapFeedbackToAutoTags(detractorResp);
    expect(detractorTags).toContain('nps:detractor');
    expect(detractorTags).toContain('at-risk');
  });
});
