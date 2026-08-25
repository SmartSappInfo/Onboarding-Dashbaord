/**
 * @fileoverview Domain types for Meeting Polls, Instant Drop-In Office Hours & Meeting Workflows.
 * Follows PRD §36, §38 and UI guide with strictly typed contracts (no 'any' or 'any[]').
 */

import type { ConferenceProvider } from './index';

// ---------------------------------------------------------------------------
// 1. Meeting Polls (Consensus Scheduling)
// ---------------------------------------------------------------------------

export interface MeetingPollSlot {
  id: string;
  startAt: string; // ISO 8601 UTC
  endAt: string; // ISO 8601 UTC
  votesYes: number;
  votesMaybe: number;
  votesNo: number;
}

export type PollVoteChoice = 'yes' | 'maybe' | 'no';

export interface MeetingPollVote {
  id: string;
  pollId: string;
  voterName: string;
  voterEmail: string;
  voterPhone?: string;
  slotVotes: Record<string, PollVoteChoice>; // slotId -> 'yes' | 'maybe' | 'no'
  comments?: string;
  votedAt: string; // ISO 8601 UTC
}

export type PollStatus = 'open' | 'finalized' | 'cancelled';

export interface MeetingPoll {
  id: string;
  workspaceId: string;
  organizationId?: string;
  title: string;
  description?: string;
  hostUserId: string;
  hostName: string;
  hostEmail?: string;
  slug: string;
  durationMinutes: number;
  proposedSlots: MeetingPollSlot[];
  status: PollStatus;
  winningSlotId?: string;
  finalizedBookingId?: string;
  totalVotersCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 2. Instant Drop-In & Office Hours Live Queue
// ---------------------------------------------------------------------------

export type OfficeHoursStatus = 'available' | 'busy' | 'offline';

export interface OfficeHoursRoom {
  id: string;
  workspaceId: string;
  organizationId?: string;
  hostUserId: string;
  hostName: string;
  title: string;
  description?: string;
  slug: string;
  status: OfficeHoursStatus;
  currentSessionId?: string;
  maxQueueSize: number;
  conferenceProvider: ConferenceProvider;
  joinUrl: string;
  activeVisitorsCount: number;
  averageCallDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export type QueueEntryStatus = 'waiting' | 'admitted' | 'completed' | 'abandoned';

export interface OfficeHoursQueueEntry {
  id: string;
  roomId: string;
  workspaceId: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  topic?: string;
  status: QueueEntryStatus;
  position: number;
  admissionToken?: string;
  joinedQueueAt: string; // ISO 8601 UTC
  lastHeartbeatAt: string; // ISO 8601 UTC
  admittedAt?: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// 3. Automated Event Type Workflows & CRM Attribution
// ---------------------------------------------------------------------------

export type MeetingWorkflowTrigger =
  | 'on_booking'
  | 'before_24h'
  | 'before_1h'
  | 'after_attended'
  | 'on_no_show'
  | 'on_cancellation';

export type MeetingWorkflowActionType =
  | 'send_whatsapp'
  | 'send_sms'
  | 'send_email'
  | 'create_crm_task'
  | 'update_lead_score'
  | 'add_contact_tag';

export interface MeetingWorkflowConfig {
  templateId?: string;
  customMessage?: string;
  tagIds?: string[];
  scoreDelta?: number;
  taskTitle?: string;
  channel?: 'whatsapp' | 'sms' | 'email';
}

export interface MeetingWorkflowRule {
  id: string;
  workspaceId: string;
  eventTypeId: string;
  trigger: MeetingWorkflowTrigger;
  offsetMinutes?: number; // e.g. 1440 for 24h before, 60 for 1h before
  actionType: MeetingWorkflowActionType;
  config: MeetingWorkflowConfig;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
