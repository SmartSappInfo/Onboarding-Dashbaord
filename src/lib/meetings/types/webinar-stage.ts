/**
 * @fileoverview Domain Types for Live Webinar & Broadcast Stage Moderation.
 * Models for presenter backstage/on-stage status, raise hand queues, audience Q&A, and live polls.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Real-time state transitions must be idempotent.
 */

export type PresenterStageStatus = 'backstage' | 'on_stage' | 'screen_sharing';

export interface WebinarPresenter {
  userId: string;
  name: string;
  email: string;
  role: 'host' | 'co_host' | 'guest_speaker';
  status: PresenterStageStatus;
  avatarUrl?: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
}

export interface WebinarHandRaise {
  participantId: string;
  participantName: string;
  participantEmail?: string;
  raisedAt: string;
  isInvitedToStage: boolean;
}

export interface WebinarQuestion {
  id: string;
  meetingId: string;
  participantId: string;
  participantName: string;
  questionText: string;
  upvotesCount: number;
  upvoterParticipantIds: string[];
  isAnswered: boolean;
  answeredAt?: string;
  createdAt: string;
}

export interface WebinarLivePollOption {
  id: string;
  text: string;
  votesCount: number;
}

export interface WebinarLivePoll {
  id: string;
  meetingId: string;
  question: string;
  options: WebinarLivePollOption[];
  isActive: boolean;
  totalVotes: number;
  createdAt: string;
}

export interface WebinarStageState {
  meetingId: string;
  isLive: boolean;
  capacityLimit: number;
  totalRegistered: number;
  totalAttending: number;
  waitlistedCount: number;
  presenters: WebinarPresenter[];
  raisedHands: WebinarHandRaise[];
  questions: WebinarQuestion[];
  activePoll?: WebinarLivePoll;
}
