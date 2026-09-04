/**
 * @fileoverview Domain Schemas & Contracts for SmartSapp Buyer & Deal Intelligence (Phase 6).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Sections 44, 53, 60, 4009-4024 and UI Specifications Sections 23-28, 770-860, 3127-3156:
 * 1. BuyerSignal: Ingestion and real-time classification of customer intent signals (spikes, proposal views, pricing visits).
 * 2. DealHealthScorecard: Pure 4-pillar algorithmic deal health evaluation (Recency, Stakeholders, Velocity, Sentiment).
 * 3. StakeholderMap: Multi-threading power matrix (Economic Buyer, Champion, Evaluator, Blocker, Gatekeeper).
 * 4. AccountIntelligenceDossier: Account 360, firmographics, tech stack, and 4-party timeline (Human vs Buyer vs AI vs Automation).
 * 5. MeetingBrief: Pre-meeting briefing studio with past objections, strategic talk track, and desired outcomes.
 * 6. PostMeetingIntelligence: Sentiment rating, detected buying signals, commitments, and 1-click CRM auto-sync.
 * 7. DealIntelligenceGovernance: Backoffice platform configuration for health factor weights, stagnation days, and single-thread thresholds.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. The use of 'any' or 'any[]' or 'as any' is strictly prohibited.
 * - All timestamps must be ISO 8601 strings or Firestore Timestamps converted to strings.
 * - Factor weights in DealHealthScorecard must always sum to 1.0 (Σ = 1.0).
 */

export type SignalType =
  | 'intent_spike'
  | 'pricing_page_view'
  | 'proposal_open'
  | 'proposal_shared'
  | 'executive_engagement'
  | 'competitor_mention'
  | 'content_download'
  | 'stalled_cadence'
  | 'contract_view';

export type SignalIntentLevel = 'high' | 'medium' | 'low';
export type SignalSentiment = 'positive' | 'neutral' | 'negative';
export type SignalSource = 'web' | 'proposal' | 'email' | 'call' | 'meeting' | 'manual';
export type SignalStatus = 'active' | 'actioned' | 'dismissed';

export interface BuyerSignal {
  id: string;
  workspaceId: string;
  organizationId: string;
  entityId: string; // Deal ID, Account ID, or Contact ID
  entityType: 'deal' | 'account' | 'contact';
  entityName: string;
  signalType: SignalType;
  intentLevel: SignalIntentLevel;
  sentiment: SignalSentiment;
  confidenceScore: number; // 0 to 100
  source: SignalSource;
  title: string;
  description: string;
  actionRequired: boolean;
  suggestedAction?: {
    actionType: 'call' | 'email' | 'task' | 'meeting' | 'exec_sponsor';
    title: string;
    priority: 'urgent' | 'high' | 'medium';
    recommendedOwnerId?: string;
  };
  status: SignalStatus;
  actionedAt?: string;
  actionedBy?: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export type DealHealthTier = 'healthy' | 'warning' | 'at_risk';

export interface DealHealthFactorScore {
  score: number; // 0 to 100
  weight: number; // e.g. 0.25 (sum = 1.0)
  status: 'healthy' | 'warning' | 'at_risk';
  details: string;
}

export interface DealHealthScorecard {
  id: string;
  dealId: string;
  dealName: string;
  workspaceId: string;
  organizationId: string;
  ownerId: string;
  ownerName: string;
  dealValue: number;
  stageId: string;
  stageName: string;
  overallHealthScore: number; // 0 to 100
  healthTier: DealHealthTier;
  factors: {
    engagementRecency: DealHealthFactorScore & {
      daysSinceLastTouch: number;
      touchesLast14Days: number;
    };
    stakeholderBreadth: DealHealthFactorScore & {
      totalStakeholders: number;
      isSingleThreaded: boolean;
      economicBuyerIdentified: boolean;
      championIdentified: boolean;
    };
    stageVelocity: DealHealthFactorScore & {
      daysInCurrentStage: number;
      stageBenchmarkDays: number;
      slipCount: number;
    };
    conversationSentiment: DealHealthFactorScore & {
      netSentiment: number; // -1.0 to +1.0
      unresolvedObjectionsCount: number;
      lastCallScore?: number;
    };
  };
  explainableDrivers: string[]; // e.g. ["11 days without meaningful progression", "Only 1 stakeholder engaged (Single-threaded)"]
  aiRecommendedAction: {
    actionType: 'engage_stakeholder' | 'unblock_pricing' | 'reschedule_demo' | 'executive_sponsor' | 'follow_up';
    title: string;
    rationale: string;
    urgency: 'immediate' | 'high' | 'medium';
  };
  calculatedAt: string;
  updatedAt: string;
}

export type StakeholderRole =
  | 'economic_buyer'
  | 'champion'
  | 'evaluator'
  | 'influencer'
  | 'blocker'
  | 'technical_gatekeeper';

export type StakeholderSentiment = 'champion' | 'supporter' | 'neutral' | 'skeptic' | 'blocker';
export type StakeholderEngagement = 'active' | 'passive' | 'unresponsive';

export interface StakeholderPerson {
  contactId: string;
  name: string;
  title: string;
  email?: string;
  phone?: string;
  role: StakeholderRole;
  sentiment: StakeholderSentiment;
  engagement: StakeholderEngagement;
  isPrimaryContact: boolean;
  notes?: string;
  lastInteractedAt?: string;
}

export interface StakeholderMap {
  id: string;
  dealId: string;
  dealName: string;
  workspaceId: string;
  organizationId: string;
  multiThreadingScore: number; // 0 to 100
  isSingleThreaded: boolean;
  stakeholders: StakeholderPerson[];
  missingCrucialRoles: StakeholderRole[];
  updatedAt: string;
}

export type ActivityActorType = 'human' | 'buyer' | 'ai' | 'automation';

export interface UnifiedTimelineEvent {
  id: string;
  timestamp: string;
  actorType: ActivityActorType;
  actorName: string;
  title: string;
  description: string;
  channel?: 'email' | 'call' | 'meeting' | 'web' | 'document' | 'system';
  metadata?: Record<string, string | number | boolean>;
}

export interface AccountIntelligenceDossier {
  id: string;
  accountId: string;
  accountName: string;
  workspaceId: string;
  organizationId: string;
  industry?: string;
  employeeCount?: number;
  estimatedRevenue?: string;
  techStack: string[];
  growthSignals: string[];
  openDealsCount: number;
  totalPipelineValue: number;
  relationshipHealthScore: number; // 0 to 100
  recentSignals: BuyerSignal[];
  timeline: UnifiedTimelineEvent[];
  updatedAt: string;
}

export interface MeetingAttendeeDetail {
  contactId: string;
  name: string;
  title: string;
  role?: StakeholderRole;
  sentiment?: StakeholderSentiment;
  recentNotes?: string;
}

export interface MeetingBrief {
  id: string;
  meetingId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  dealId?: string;
  dealName?: string;
  accountId?: string;
  accountName?: string;
  workspaceId: string;
  organizationId: string;
  hostRepId: string;
  hostRepName: string;
  attendees: MeetingAttendeeDetail[];
  previousCallTakeaways: string[]; // Open objections & insights from Phase 5 calls
  strategicTalkTrack: string[]; // Key discussion points tailored to persona
  recommendedQuestions: string[]; // Probing discovery questions
  desiredOutcomeChecklist: {
    id: string;
    label: string;
    completed: boolean;
  }[];
  meetingNotesSummary?: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface PostMeetingCommitment {
  id: string;
  who: string;
  what: string;
  dueDate?: string;
}

export interface PostMeetingCrmSyncDraft {
  suggestedStageId?: string;
  suggestedStageName?: string;
  stageProgressionRationale?: string;
  dealHealthDelta: number; // e.g. +8 or -5
  tasksToCreate: {
    title: string;
    dueDate: string;
    priority: 'urgent' | 'high' | 'medium';
  }[];
  followUpEmailDraft: {
    subject: string;
    body: string;
    recipientEmails: string[];
  };
}

export interface PostMeetingIntelligence {
  id: string;
  meetingId: string;
  meetingTitle: string;
  dealId?: string;
  workspaceId: string;
  organizationId: string;
  repId: string;
  repName: string;
  completedAt: string;
  sentimentRating: 'positive' | 'neutral' | 'challenging';
  executiveSummary: string;
  detectedBuyingSignals: BuyerSignal[];
  detectedObjections: string[];
  commitmentsMade: PostMeetingCommitment[];
  nextSteps: string[];
  crmSyncDraft: PostMeetingCrmSyncDraft;
  syncStatus: 'pending_approval' | 'synced' | 'dismissed';
  syncedAt?: string;
}

export interface DealIntelligenceGovernance {
  workspaceId: string;
  organizationId: string;
  healthWeights: {
    engagementRecency: number; // default 0.25
    stakeholderBreadth: number; // default 0.25
    stageVelocity: number; // default 0.25
    conversationSentiment: number; // default 0.25
  };
  stageStagnationDays: Record<string, number>; // e.g. { discovery: 14, demo: 10, proposal: 7, negotiation: 7 }
  singleThreadedValueThreshold: number; // default 10000
  minimumTouchFrequencyDays: number; // default 10
  highIntentConfidenceThreshold: number; // default 70
  updatedAt: string;
  updatedBy: string;
}

export interface DealIntelligenceOverview {
  activeSignalsCount: number;
  highIntentSignalsCount: number;
  atRiskDealsCount: number;
  atRiskPipelineValue: number;
  upcomingBriefsCount: number;
  averageDealHealth: number;
  recentSignals: BuyerSignal[];
  atRiskDeals: DealHealthScorecard[];
  upcomingBriefs: MeetingBrief[];
  healthDistribution: {
    healthy: number;
    warning: number;
    at_risk: number;
  };
}
