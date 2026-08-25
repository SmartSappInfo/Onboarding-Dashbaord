/**
 * @fileoverview Domain Types for Post-Meeting Feedback, CSAT & NPS Engine.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - NPS is scored from 0-10 (0-6 Detractor, 7-8 Passive, 9-10 Promoter).
 * - CSAT is scored from 1-5.
 * - Zero 'any' policy strictly enforced.
 */

export type FeedbackRatingType = 'nps' | 'csat' | 'star';

export type NPSCategory = 'promoter' | 'passive' | 'detractor';

export interface MeetingFeedbackResponse {
  id: string;
  meetingId: string;
  workspaceId: string;
  participantId: string;
  participantName?: string;
  participantEmail?: string;
  ratingType: FeedbackRatingType;
  score: number; // 0-10 for NPS, 1-5 for CSAT
  npsCategory?: NPSCategory;
  feedbackText?: string;
  tagsAssigned?: string[];
  submittedAt: string;
}

export interface MeetingFeedbackSummary {
  meetingId: string;
  totalResponses: number;
  averageScore: number;
  npsScore?: number; // % Promoters - % Detractors (-100 to +100)
  promotersCount: number;
  passivesCount: number;
  detractorsCount: number;
  responses: MeetingFeedbackResponse[];
}
