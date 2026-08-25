/**
 * @fileoverview Pure Post-Meeting Feedback & NPS Aggregator.
 * Calculates Net Promoter Scores, CSAT averages, and assigns automatic CRM tags.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - NPS formula: % Promoters (9-10) - % Detractors (0-6).
 * - 100% pure with zero side-effects.
 */

import type {
  MeetingFeedbackResponse,
  MeetingFeedbackSummary,
  NPSCategory,
} from './types/feedback';

/**
 * Classifies an NPS score (0-10) into Promoter, Passive, or Detractor.
 */
export function classifyNPSScore(score: number): NPSCategory {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

/**
 * Aggregates a list of feedback responses into a comprehensive summary.
 */
export function aggregateFeedbackResponses(
  meetingId: string,
  responses: MeetingFeedbackResponse[]
): MeetingFeedbackSummary {
  if (responses.length === 0) {
    return {
      meetingId,
      totalResponses: 0,
      averageScore: 0,
      npsScore: undefined,
      promotersCount: 0,
      passivesCount: 0,
      detractorsCount: 0,
      responses: [],
    };
  }

  let totalScore = 0;
  let promotersCount = 0;
  let passivesCount = 0;
  let detractorsCount = 0;

  for (const r of responses) {
    totalScore += r.score;
    const cat = r.npsCategory || classifyNPSScore(r.score);
    if (cat === 'promoter') promotersCount++;
    else if (cat === 'passive') passivesCount++;
    else detractorsCount++;
  }

  const total = responses.length;
  const averageScore = Math.round((totalScore / total) * 10) / 10;
  const npsScore = Math.round(((promotersCount - detractorsCount) / total) * 100);

  return {
    meetingId,
    totalResponses: total,
    averageScore,
    npsScore,
    promotersCount,
    passivesCount,
    detractorsCount,
    responses,
  };
}

/**
 * Generates appropriate CRM tags based on customer feedback score.
 */
export function mapFeedbackToAutoTags(response: MeetingFeedbackResponse): string[] {
  const tags: string[] = ['feedback:completed'];

  if (response.ratingType === 'nps') {
    const cat = response.npsCategory || classifyNPSScore(response.score);
    if (cat === 'promoter') {
      tags.push('nps:promoter', 'advocate');
    } else if (cat === 'detractor') {
      tags.push('nps:detractor', 'at-risk');
    } else {
      tags.push('nps:passive');
    }
  } else if (response.ratingType === 'csat' || response.ratingType === 'star') {
    if (response.score >= 4) {
      tags.push('csat:satisfied');
    } else if (response.score <= 2) {
      tags.push('csat:unsatisfied', 'at-risk');
    }
  }

  return tags;
}
