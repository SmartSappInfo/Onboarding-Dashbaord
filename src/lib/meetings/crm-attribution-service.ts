/**
 * @fileoverview Pure Lead Scoring & Deal Revenue Attribution Engine.
 * Calculates contact lead scores based on meeting engagement events,
 * and aggregates attributed revenue across CRM deals.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Score is strictly lower-bounded at 0 to avoid negative score drift.
 */

import type {
  MeetingScoreEvent,
  ScoreWeightsConfig,
  MeetingDealAttribution,
} from './types/crm-attribution';

export const DEFAULT_SCORE_WEIGHTS: ScoreWeightsConfig = {
  booking_created: 5,
  booking_confirmed: 10,
  meeting_attended: 20,
  meeting_completed: 10,
  no_show: -5,
  cancelled: -2,
  high_intent_AI_signal: 25,
};

/**
 * Calculates deterministic lead score delta from meeting events.
 */
export function calculateLeadMeetingScore(
  events: MeetingScoreEvent[],
  customWeights?: Partial<ScoreWeightsConfig>
): number {
  const weights: ScoreWeightsConfig = {
    ...DEFAULT_SCORE_WEIGHTS,
    ...customWeights,
  };

  let totalScore = 0;

  for (const evt of events) {
    if (typeof evt.weight === 'number') {
      totalScore += evt.weight;
    } else {
      const delta = weights[evt.eventType] || 0;
      totalScore += delta;
    }
  }

  return Math.max(0, totalScore);
}

/**
 * Aggregates total pipeline revenue attributed to meeting touchpoints.
 */
export function computeDealAttributionRevenue(
  deals: MeetingDealAttribution[]
): { totalAttributedValue: number; dealsCount: number } {
  let totalAttributedValue = 0;

  for (const deal of deals) {
    totalAttributedValue += deal.dealValue || 0;
  }

  return {
    totalAttributedValue,
    dealsCount: deals.length,
  };
}
