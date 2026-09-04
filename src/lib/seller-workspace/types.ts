/**
 * @fileoverview Domain Types & Schemas for SmartSapp Seller Workspace ("My Day") (Phase 2).
 *
 * ARCHITECTURAL POINTER:
 * Establishes canonical contracts for:
 * 1. WorkQueueItem: Ranked actionable work items derived from CRM tasks, buyer signals, and meetings.
 * 2. MyDayOverview: Complete daily payload for the seller command surface.
 * 3. PriorityScoreBreakdown: Transparent, multi-factor attribution for item priority rank (0–100).
 * 4. QuickActionPayload: Universal execution payload for completing actions directly from the surface.
 * 5. SlaPolicyConfig: SLA rules governing urgency and countdown badges.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Any new queue item attributes must maintain backward-compatibility with CRM tasks and lead signals.
 */

export type QueueItemType =
  | 'call'
  | 'follow_up'
  | 'meeting_prep'
  | 'deal_action'
  | 'task'
  | 'buyer_signal';

export type PriorityImpact = 'critical' | 'high' | 'medium' | 'low';
export type PriorityUrgency = 'immediate' | 'today' | 'this_week' | 'scheduled';
export type SlaStatus = 'on_track' | 'at_risk' | 'breached';
export type QueueItemStatus = 'pending' | 'completed' | 'snoozed' | 'dismissed';

export interface PriorityScoreBreakdown {
  baseScore: number;
  dealValueBoost: number;
  signalStrengthBoost: number;
  slaUrgencyBoost: number;
  quotaDeficitBoost: number;
  totalScore: number; // Clamped to [0, 100]
}

export interface WorkQueueItem {
  id: string;
  workspaceId: string;
  organizationId: string;
  assignedTo: string;

  type: QueueItemType;
  title: string;
  description: string;

  // Associated CRM Entities
  entityId?: string;
  entityName?: string;
  entityType?: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  dealId?: string;
  dealName?: string;
  dealValue?: number;
  dealStage?: string;

  // AI Prioritization Attributes (PRD Section 31)
  priorityScore: number; // 0 - 100
  scoreBreakdown?: PriorityScoreBreakdown;
  impact: PriorityImpact;
  urgency: PriorityUrgency;
  confidence: number; // Percentage 0 - 100
  reason: string; // e.g. "Proposal viewed 4× today. Decision maker engaged."
  recommendedAction: string;
  suggestedTalkingPoint?: string;

  // SLA & Timing
  slaStatus: SlaStatus;
  slaDueAt?: string;
  dueDate: string;

  // Execution Status
  status: QueueItemStatus;
  snoozedUntil?: string;
  completedAt?: string;
  createdAt: string;
}

export interface MyDaySnapshot {
  performanceIndex: number; // 0 - 100 from Phase 1 engine
  targetAttainmentPercent: number; // % toward current monthly target
  dailyRequiredPace: number; // e.g. 1.4 meetings/day needed
  activePipelineValue: number; // Total value of open deals owned by rep
  todayPointsEarned: number; // Cumulative effort points logged today
  todayPointsTarget: number; // Daily pace benchmark (e.g. 25 pts)
  completedActionsToday: number;
  pendingActionsToday: number;
}

export interface UpcomingMeetingBrief {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendeesCount: number;
  brief?: string;
  dealContext?: {
    dealId: string;
    name: string;
    value: number;
    stage: string;
  };
  contactContext?: {
    contactId: string;
    name: string;
    email?: string;
    phone?: string;
  };
}

export interface MyDayOverview {
  greeting: string;
  dateString: string;
  repProfile: {
    userId: string;
    userName: string;
    userEmail: string;
    photoURL?: string;
  };
  snapshot: MyDaySnapshot;
  topPriority: WorkQueueItem | null;
  queue: WorkQueueItem[];
  upcomingMeetings: UpcomingMeetingBrief[];
  slaSummary: {
    onTrackCount: number;
    atRiskCount: number;
    breachedCount: number;
  };
}

export interface QuickActionPayload {
  itemId: string;
  actionType: 'call' | 'note' | 'task_complete' | 'deal_advance' | 'snooze' | 'dismiss';
  workspaceId: string;
  organizationId: string;
  actorId: string;

  // Optional contextual payloads
  callDurationSeconds?: number;
  callOutcome?: string;
  noteText?: string;
  targetStageId?: string;
  snoozeHours?: number;
}

export interface QuickActionResult {
  success: boolean;
  pointsEarned?: number;
  message?: string;
  error?: string;
  updatedItem?: WorkQueueItem;
}

export interface SlaPolicyConfig {
  id: string;
  workspaceId: string;
  channel: 'inbound_lead' | 'proposal_follow_up' | 'meeting_prep' | 'general_task';
  targetHours: number; // Max allowed hours before breach
  warningThresholdPercent: number; // Percentage elapsed before marking at_risk (e.g. 75%)
}
