/**
 * @fileoverview Domain Types for Meeting CRM Deep Attribution & Lead Scoring.
 * Strictly typed interfaces for lead scoring events, deal revenue attribution,
 * and contact interaction timelines.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Score calculations are deterministic and lower-bounded at 0.
 */

export type MeetingScoreEventType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'meeting_attended'
  | 'meeting_completed'
  | 'no_show'
  | 'cancelled'
  | 'high_intent_AI_signal';

export interface ScoreWeightsConfig {
  booking_created: number;       // default +5
  booking_confirmed: number;     // default +10
  meeting_attended: number;      // default +20
  meeting_completed: number;     // default +10
  no_show: number;               // default -5
  cancelled: number;             // default -2
  high_intent_AI_signal: number; // default +25
}

export interface MeetingScoreEvent {
  eventType: MeetingScoreEventType;
  occurredAt: string;
  weight?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface MeetingDealAttribution {
  dealId: string;
  dealTitle: string;
  dealValue: number;
  dealStage: string;
  currency?: string;
  associatedAt: string;
  attributionModel: 'first_touch' | 'last_touch' | 'linear';
}

export interface CRMContactContext {
  contactId: string;
  contactName: string;
  contactEmail: string;
  organizationName?: string;
  stageBadge?: string;
  currentLeadScore: number;
  tags: string[];
  associatedDeals: MeetingDealAttribution[];
  previousInteractions: Array<{
    type: 'meeting' | 'email' | 'survey' | 'call' | 'task';
    title: string;
    occurredAt: string;
    summary?: string;
  }>;
}
