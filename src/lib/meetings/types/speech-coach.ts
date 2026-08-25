/**
 * @fileoverview Domain Types for AI Meeting Speech Coach & Conversation Dynamics.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure schemas.
 * - Zero 'any' policy strictly enforced.
 */

export interface SpeakerTalkMetrics {
  speakerId: string;
  speakerName: string;
  isHost: boolean;
  totalSpokenMs: number;
  talkPercentage: number; // 0 to 100
  wordsSpoken: number;
  wordsPerMinute: number;
  longestMonologueMs: number;
  questionsAskedCount: number;
}

export interface SpeechCoachingScorecard {
  meetingId: string;
  workspaceId: string;
  overallCoachScore: number; // 0 to 100
  talkToListenRatio: {
    hostPercentage: number;
    attendeesPercentage: number;
    evaluation: 'optimal' | 'host_dominating' | 'attendees_dominating';
  };
  pacingEvaluation: {
    avgWordsPerMinute: number;
    verdict: 'too_slow' | 'ideal' | 'too_fast';
  };
  monologueAlerts: Array<{
    speakerName: string;
    durationSeconds: number;
    timestampMs: number;
  }>;
  questionsDetectedCount: number;
  strengths: string[];
  tacticalRecommendations: string[];
  createdAt: string;
}
