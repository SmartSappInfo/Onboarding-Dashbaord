/**
 * @fileoverview Domain types for Meeting Intelligence, Recordings, Transcripts, AI Briefs & Recurrence.
 * Follows PRD §24–§27, §30 with strictly typed contracts (no 'any' or 'any[]').
 */

import type { ConferenceProvider } from './index';

export type RecordingStatus = 'pending' | 'processing' | 'available' | 'failed' | 'deleted';

export interface MeetingRecording {
  id: string;
  workspaceId: string;
  organizationId?: string;
  meetingId: string;
  provider: ConferenceProvider;
  externalRecordingId?: string;
  mediaUrl: string;
  storagePath?: string;
  durationSeconds: number;
  fileSizeBytes?: number;
  format?: string; // 'mp4', 'webm', 'mp3', 'm4a'
  status: RecordingStatus;
  playbackUrl?: string;
  shareToken?: string;
  retentionUntil?: string; // ISO 8601 UTC
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptSpeaker {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  isHost?: boolean;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export type TranscriptStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface MeetingTranscript {
  id: string;
  workspaceId: string;
  organizationId?: string;
  meetingId: string;
  recordingId?: string;
  language: string;
  segments: TranscriptSegment[];
  speakers: TranscriptSpeaker[];
  wordCount: number;
  status: TranscriptStatus;
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
}

export type ActionItemPriority = 'low' | 'medium' | 'high';
export type ActionItemStatus = 'open' | 'completed' | 'converted_to_crm_task' | 'dismissed';

export interface MeetingActionItem {
  id: string;
  text: string;
  assigneeName?: string;
  assigneeEmail?: string;
  assigneeUserId?: string;
  dueDate?: string; // ISO 8601 UTC
  priority: ActionItemPriority;
  status: ActionItemStatus;
  crmTaskId?: string;
  /** v2 analysis (M2 · T3): needs a person's review before any one-click action. */
  needsReview?: boolean;
  /** v2 analysis: the quoted words this item is based on. */
  evidenceQuote?: string;
}

export type SentimentCategory = 'positive' | 'neutral' | 'negative' | 'mixed';

export interface SentimentAnalysis {
  category: SentimentCategory;
  score: number; // -1.0 to 1.0
  explanation: string;
}

export interface BuyingSignal {
  topic: string;
  quote: string;
  strength: 'weak' | 'moderate' | 'strong';
  timestampMs?: number;
}

export interface CustomerObjection {
  category: 'pricing' | 'timing' | 'feature' | 'competitor' | 'authority' | 'other';
  statement: string;
  severity: 'low' | 'medium' | 'high';
  suggestedResponse?: string;
}

export type IntelligenceStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface MeetingIntelligence {
  id: string;
  workspaceId: string;
  organizationId?: string;
  meetingId: string;
  recordingId?: string;
  transcriptId?: string;
  executiveSummary: string;
  keyTopics: string[];
  keyDecisions: string[];
  actionItems: MeetingActionItem[];
  buyingSignals: BuyingSignal[];
  objections: CustomerObjection[];
  dealRisks: string[];
  /** Absent for v2 analysis, which does not assess sentiment (never shown as a guessed value). */
  sentiment?: SentimentAnalysis;
  recommendedFollowUp: string;
  modelUsed?: string;
  status: IntelligenceStatus;
  generatedAt: string;
  updatedAt: string;
}

/**
 * Grounded prep brief (Phase 11 M2 · T2): every item cites its sources, or the brief is labelled
 * facts-only. Type-only re-export so client components never import server code.
 */
export type { PrepBrief as MeetingPrepBrief } from '@/lib/meetings/prep-brief-service';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type RecurringSeriesStatus = 'active' | 'paused' | 'cancelled';

export interface RecurringSeries {
  id: string;
  workspaceId: string;
  organizationId?: string;
  eventTypeId: string;
  frequency: RecurrenceFrequency;
  interval: number; // e.g. 1 = every week, 2 = every 2 weeks
  daysOfWeek?: number[]; // [1, 3] = Mon, Wed
  startDate: string; // YYYY-MM-DD
  untilDate?: string; // YYYY-MM-DD
  count?: number; // Total max instances
  status: RecurringSeriesStatus;
  createdBookingsCount: number;
  createdAt: string;
  updatedAt: string;
}
