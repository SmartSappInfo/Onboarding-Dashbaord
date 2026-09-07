/**
 * @fileoverview Type definitions and strict schema contracts for Sales Orchestration & Governance (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain F / Phase 8:
 * 1. Governed Sales Plays & Deterministic State Machine (Hot Lead, Stalled Deal, Proposal Viewed).
 * 2. Visual & Mobile Dual-Mode Play Builder (Canvas on Desktop >= 1024px, Step Sequence on Mobile < 1024px).
 * 3. Signal & Event Triggers (Buyer Signals from Phase 6, Deal Slippage from Phase 7, SLA Breaches).
 * 4. Intelligent Workload & Capacity Routing (Round-Robin, Capacity-Weighted, Tier/Territory).
 * 5. SLA Breach & Escalation Matrix (Untouched Lead, Stalled Deal, Single-Threaded Deal, Cooldown Digest).
 * 6. Human-in-the-Loop Approval Queue (Discount Overrides, Stage Skip, Reassignment with 24h Auto-Escalation).
 * 7. Backoffice No-Code Governance Control Plane (Emergency Kill Switch, Global SLA Matrix, Capacity Caps, FER Seeder).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - All timestamps must be ISO 8601 strings.
 * - Cascade depth is bounded (MAX_CASCADE_DEPTH = 3) to prevent runaway execution storms.
 * - Concurrency during routing requires atomic transactional capacity increments.
 *
 * @testability Pure data structures designed for deterministic unit testing in Vitest.
 */

export type PlayTriggerType =
  | 'buyer_signal'
  | 'deal_health_drop'
  | 'deal_stage_changed'
  | 'deal_slipped'
  | 'lead_created'
  | 'proposal_viewed'
  | 'sla_breached'
  | 'manual_launch';

export type PlayActionType =
  | 'create_task'
  | 'generate_ai_brief'
  | 'enroll_sequence'
  | 'request_approval'
  | 'escalate_to_manager'
  | 'route_deal'
  | 'update_stage';

export type PlayCategory =
  | 'inbound_lead'
  | 'deal_acceleration'
  | 'deal_recovery'
  | 'account_expansion'
  | 'governance';

export type PlayExecutionStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RoutingStrategy =
  | 'round_robin'
  | 'capacity_weighted'
  | 'tier_territory';

export type EscalationSeverity =
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical';

export type EscalationTriggerCondition =
  | 'lead_untouched'
  | 'deal_stalled'
  | 'single_threaded_risk'
  | 'proposal_unanswered'
  | 'approval_overdue';

export type ApprovalType =
  | 'discount_override'
  | 'stage_bypass'
  | 'deal_reassignment'
  | 'custom';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'expired';

export type TaskPriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent';

export interface PlayStepConfig {
  taskTitle?: string;
  taskPriority?: TaskPriority;
  taskInstructions?: string;
  approvalType?: ApprovalType;
  approvalThreshold?: number;
  escalationSeverity?: EscalationSeverity;
  escalationMessage?: string;
  sequenceId?: string;
  targetStage?: string;
  targetOwnerRole?: 'account_executive' | 'sales_manager' | 'sdr';
}

export interface PlayStep {
  id: string;
  stepIndex: number;
  title: string;
  description: string;
  actionType: PlayActionType;
  delayHours: number;
  timeoutHours?: number;
  config: PlayStepConfig;
  requiredForNextStep: boolean;
  onFailureAction?: 'halt' | 'skip' | 'escalate';
}

export interface PlayTrigger {
  type: PlayTriggerType;
  thresholdValue?: number;
  targetStage?: string;
  signalType?: string;
}

export interface PlayCondition {
  field:
    | 'deal_value'
    | 'deal_stage'
    | 'stakeholder_count'
    | 'lead_score'
    | 'slip_count'
    | 'health_score';
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: string | number | string[];
}

export interface PlayExitCondition {
  condition: 'deal_won' | 'deal_lost' | 'lead_contacted' | 'manual_cancel';
}

export interface SalesPlayExecutionStats {
  totalTriggered: number;
  completed: number;
  inProgress: number;
  convertedWon: number;
  avgDurationHours: number;
}

export interface SalesPlay {
  id: string;
  workspaceId: string;
  organizationId: string;
  title: string;
  description: string;
  category: PlayCategory;
  triggers: PlayTrigger[];
  conditions: PlayCondition[];
  steps: PlayStep[];
  exitConditions: PlayExitCondition[];
  enabled: boolean;
  version: number;
  allowReentry: boolean;
  reentryCooldownHours: number;
  maxCascadeDepth: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  executionStats?: SalesPlayExecutionStats;
}

export interface PlayStepExecutionLog {
  stepId: string;
  stepTitle: string;
  actionType: PlayActionType;
  executedAt: string;
  executedBy: string;
  status: 'pending' | 'completed' | 'skipped' | 'failed' | 'escalated';
  outcomeNote?: string;
}

export interface PlayExecutionInstance {
  id: string;
  workspaceId: string;
  organizationId: string;
  playId: string;
  playTitle: string;
  entityType: 'deal' | 'lead' | 'contact';
  entityId: string;
  entityName: string;
  entityValue?: number;
  currentStepIndex: number;
  totalSteps: number;
  status: PlayExecutionStatus;
  assignedTo: string;
  assignedToName: string;
  triggeredBy: 'system' | 'signal' | 'user' | 'manager';
  triggerType: PlayTriggerType;
  cascadeDepth: number;
  idempotencyKey: string;
  startedAt: string;
  completedAt?: string;
  lastStepExecutedAt?: string;
  nextStepDueAt?: string;
  stepHistory: PlayStepExecutionLog[];
}

export interface RepRoutingConfig {
  userId: string;
  userName: string;
  userEmail: string;
  maxActiveWorkload: number;
  currentActiveCount: number;
  weight: number; // 1 to 10
  tier?: 'enterprise' | 'mid_market' | 'commercial' | 'sdr';
  isAvailable: boolean;
}

export interface RoutingRule {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  strategy: RoutingStrategy;
  enabled: boolean;
  repRoster: RepRoutingConfig[];
  fallbackOwnerId: string;
  fallbackOwnerName: string;
  tierConditions?: {
    minDealValue?: number;
    maxDealValue?: number;
    dealType?: string;
  };
  updatedAt: string;
}

export interface EscalationRule {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  triggerCondition: EscalationTriggerCondition;
  thresholdHours: number;
  severity: EscalationSeverity;
  notifyRoles: ('sales_manager' | 'department_head' | 'account_executive')[];
  autoReassign: boolean;
  reassignToRole?: 'sales_manager' | 'next_available_rep';
  cooldownMinutes: number;
  enabled: boolean;
}

export interface EscalationIncident {
  id: string;
  workspaceId: string;
  organizationId: string;
  ruleId: string;
  ruleName: string;
  severity: EscalationSeverity;
  entityType: 'deal' | 'lead';
  entityId: string;
  entityName: string;
  ownerId: string;
  ownerName: string;
  managerId: string;
  triggerReason: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface ApprovalRequestDetails {
  discountPercent?: number;
  originalAmount?: number;
  requestedAmount?: number;
  fromStage?: string;
  toStage?: string;
  fromOwnerId?: string;
  toOwnerId?: string;
  justification: string;
}

export interface ApprovalRequest {
  id: string;
  workspaceId: string;
  organizationId: string;
  entityType: 'deal' | 'proposal';
  entityId: string;
  entityName: string;
  dealValue: number;
  requestType: ApprovalType;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  details: ApprovalRequestDetails;
  approverRole: 'sales_manager' | 'vp_sales' | 'finance_admin';
  assignedApproverId?: string;
  assignedApproverName?: string;
  status: ApprovalStatus;
  decisionAt?: string;
  decisionBy?: string;
  decisionByName?: string;
  decisionNote?: string;
  expiresAt: string;
  autoEscalateAt: string;
  verificationToken?: string; // Token-scoped access for secure email/public one-click review
}

export interface SalesOrchestrationGovernance {
  workspaceId: string;
  organizationId: string;
  emergencyKillSwitch: boolean; // Circuit breaker: true pauses all autonomous play triggers
  maxCascadeDepth: number; // Default 3
  globalSlaUntouchedLeadMinutes: number; // Default 30m
  globalSlaStalledDealDays: number; // Default 14d
  globalSlaProposalResponseHours: number; // Default 48h
  managerEscalationDigestCooldownMinutes: number; // Default 60m
  approvalTimeoutHours: number; // Default 24h
  maxPlaysPointsPerDay: number; // Default 50 pts
  updatedAt: string;
  updatedBy: string;
}

export interface OrchestrationDashboardData {
  plays: SalesPlay[];
  activeExecutions: PlayExecutionInstance[];
  routingRules: RoutingRule[];
  escalationRules: EscalationRule[];
  activeEscalations: EscalationIncident[];
  pendingApprovals: ApprovalRequest[];
  governance: SalesOrchestrationGovernance;
}

export const DEFAULT_ORCHESTRATION_GOVERNANCE: Omit<
  SalesOrchestrationGovernance,
  'workspaceId' | 'organizationId' | 'updatedAt' | 'updatedBy'
> = {
  emergencyKillSwitch: false,
  maxCascadeDepth: 3,
  globalSlaUntouchedLeadMinutes: 30,
  globalSlaStalledDealDays: 14,
  globalSlaProposalResponseHours: 48,
  managerEscalationDigestCooldownMinutes: 60,
  approvalTimeoutHours: 24,
  maxPlaysPointsPerDay: 50,
};
