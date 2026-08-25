import { describe, it, expect } from 'vitest';
import {
  calculateLeadMeetingScore,
  computeDealAttributionRevenue,
  DEFAULT_SCORE_WEIGHTS,
} from '../crm-attribution-service';
import type { MeetingScoreEvent, MeetingDealAttribution } from '../types/crm-attribution';

describe('CRM Attribution & Lead Scoring Service', () => {
  it('calculates deterministic lead score delta from engagement events', () => {
    const events: MeetingScoreEvent[] = [
      { eventType: 'booking_created', occurredAt: '2026-08-24T10:00:00Z' }, // +5
      { eventType: 'booking_confirmed', occurredAt: '2026-08-24T10:05:00Z' }, // +10
      { eventType: 'meeting_attended', occurredAt: '2026-08-25T14:00:00Z' }, // +20
      { eventType: 'meeting_completed', occurredAt: '2026-08-25T14:30:00Z' }, // +10
      { eventType: 'high_intent_AI_signal', occurredAt: '2026-08-25T14:35:00Z' }, // +25
    ];

    const score = calculateLeadMeetingScore(events);
    // 5 + 10 + 20 + 10 + 25 = 70
    expect(score).toBe(70);
  });

  it('clamps lead score to zero on heavy negative events', () => {
    const events: MeetingScoreEvent[] = [
      { eventType: 'no_show', occurredAt: '2026-08-24T10:00:00Z' }, // -5
      { eventType: 'cancelled', occurredAt: '2026-08-24T11:00:00Z' }, // -2
    ];

    const score = calculateLeadMeetingScore(events);
    expect(score).toBe(0);
  });

  it('aggregates pipeline revenue attributed to meeting deals', () => {
    const deals: MeetingDealAttribution[] = [
      {
        dealId: 'd1',
        dealTitle: 'Enterprise License',
        dealValue: 15000,
        dealStage: 'closed_won',
        associatedAt: '2026-08-25T10:00:00Z',
        attributionModel: 'last_touch',
      },
      {
        dealId: 'd2',
        dealTitle: 'Onboarding Package',
        dealValue: 3500,
        dealStage: 'proposal',
        associatedAt: '2026-08-25T10:00:00Z',
        attributionModel: 'linear',
      },
    ];

    const res = computeDealAttributionRevenue(deals);
    expect(res.totalAttributedValue).toBe(18500);
    expect(res.dealsCount).toBe(2);
  });
});
