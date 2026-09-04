/**
 * @fileoverview Domain Types & Schemas for SmartSapp Manager Command Center & Team Operational Intelligence (Phase 3).
 *
 * ARCHITECTURAL POINTER:
 * Establishes canonical contracts for:
 * 1. TeamMacroKPIs: High-level team revenue, pipeline, forecast, velocity, and quota pacing.
 * 2. AiTeamBrief: Executive synthesis of revenue risk attribution and manager priorities.
 * 3. AttentionItem: High-urgency operational alerts (at-risk deals, overloaded reps, breached SLAs).
 * 4. RepWorkloadSummary: Visual capacity, active queue burden, and pace health per salesperson.
 * 5. AtRiskDeal: Stalled or disengaged pipeline opportunities requiring managerial assistance.
 * 6. ManagerInterventionPayload: Operational overrides (hero elevation, reassignment, guidance notes).
 * 7. CoachingBrief1on1: Structured dossier combining Phase 1 scorecards and Phase 2 queue velocity.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Must strictly maintain backward-compatibility with Phase 0, 1, and 2 contracts.
 */

import type { PerformanceScorecard } from '@/lib/sales-performance/types';

export type WorkloadStatus = 'overloaded' | 'optimal' | 'underutilized';
export type AttentionItemType = 'at_risk_deal' | 'overloaded_rep' | 'underperforming_rep' | 'breached_sla';
export type AttentionSeverity = 'critical' | 'warning' | 'info';

export type ManagerInterventionType =
  | 'elevate_to_hero'
  | 'reassign'
  | 'inject_task'
  | 'add_guidance'
  | 'schedule_coaching';

export interface TeamMacroKPIs {
  closedRevenueWon: number;       // Revenue won in current period (GHS)
  activePipelineValue: number;    // Total value of open pipeline (GHS)
  weightedForecastValue: number;  // Probability-weighted forecast (GHS)
  quotaAttainmentPercent: number; // Aggregate team quota attainment % (0 - 100+)
  averageVelocityDays: number;    // Average days from creation to win/close
  winRatePercent: number;         // Closed won deals / (Won + Lost) %
  dealsAtRiskCount: number;       // Number of open deals flagged as at-risk
  overloadedRepsCount: number;    // Reps exceeding capacity threshold
}

export interface AiTeamBrief {
  headline: string;               // e.g. "Pipeline is 8% below monthly target."
  summary: string;                // Contextual summary of risks and deal bottlenecks
  keyRisks: string[];             // Top 2-3 risk attribution bullets
  recommendedActions: string[];   // Managerial action steps
  confidenceScore: number;        // AI confidence percentage (0 - 100)
  generatedAt: string;            // ISO 8601 timestamp
}

export interface AttentionItem {
  id: string;
  type: AttentionItemType;
  severity: AttentionSeverity;
  title: string;
  subtitle: string;
  entityName?: string;
  entityId?: string;
  repId?: string;
  repName?: string;
  dealValue?: number;
  dealId?: string;
  actionLabel: string;
  interventionType: ManagerInterventionType;
  createdAt: string;
}

export interface RepWorkloadSummary {
  userId: string;
  userName: string;
  userEmail: string;
  photoURL?: string;
  teamId?: string;
  teamName?: string;
  role: string;

  // Capacity & Workload Metrics
  weeklyCapacityHours: number;
  activeLeadsCount: number;
  maxOpenLeads: number;
  activeDealsCount: number;
  maxOpenDeals: number;
  activeQueueItemsCount: number;  // Pending items in their Phase 2 My Day queue
  workloadStatus: WorkloadStatus;
  capacityUtilizationPercent: number; // (Current / Max) %

  // Performance Pacing from Phase 1 & 2
  performanceIndex: number;       // 0 - 100 composite index
  targetAttainmentPercent: number;// % toward quota
  paceStatus: 'on_track' | 'at_risk' | 'behind' | 'achieved';
  scorecard: PerformanceScorecard;
  recentPointsEarned: number;

  // Overdue & SLA Burden
  slaBreachCount: number;
  stalledTasksCount: number;
}

export interface AtRiskDeal {
  id: string;
  name: string;
  value: number;
  stage: string;
  stageName: string;
  daysInCurrentStage: number;
  assignedRepId: string;
  assignedRepName: string;
  riskScore: number;              // 0 - 100
  riskReasons: string[];          // e.g. ["Stalled for 18 days", "No buyer signals in 14 days"]
  lastActivityAt?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  isManagerElevated?: boolean;
}

export interface ManagerInterventionPayload {
  workspaceId: string;
  organizationId: string;
  managerId: string;
  managerName: string;
  type: ManagerInterventionType;

  // Target Entity context
  targetRepId: string;
  targetRepName?: string;
  targetDealId?: string;
  targetDealName?: string;
  targetTaskId?: string;

  // Reassignment payload
  newAssigneeRepId?: string;
  newAssigneeRepName?: string;

  // Strategic guidance note
  managerNote?: string;

  // Priority Elevation
  reason: string;
  suggestedAction?: string;
}

export interface ManagerInterventionRecord {
  id: string;
  workspaceId: string;
  organizationId: string;
  managerId: string;
  managerName: string;
  type: ManagerInterventionType;
  targetRepId: string;
  targetRepName?: string;
  targetDealId?: string;
  targetDealName?: string;
  targetTaskId?: string;
  newAssigneeRepId?: string;
  newAssigneeRepName?: string;
  managerNote?: string;
  reason: string;
  status: 'active' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
}

export interface CoachingBrief1on1 {
  repId: string;
  repName: string;
  repEmail: string;
  photoURL?: string;
  generatedAt: string;

  // Scorecard & Velocity Review
  performanceIndex: number;
  scorecard: PerformanceScorecard;
  quotaAttainmentPercent: number;
  dailyRequiredPace: number;
  pointsLast7Days: number;
  completedTasksLast7Days: number;

  // Bottleneck & Execution Analysis
  strongestDimension: string;
  weakestDimension: string;
  queueCompletionVelocity: string; // e.g. "Avg 3.2 tasks/day"
  overdueTasksCount: number;

  // Deals Requiring Manager Assist
  stalledDeals: Array<{
    id: string;
    name: string;
    value: number;
    stage: string;
    daysStalled: number;
    recommendedAssist: string;
  }>;

  // AI Discussion Agenda
  discussionPoints: string[];
  suggestedCommitments: string[];
}

export interface WorkloadRebalanceProposal {
  itemId: string;
  itemType: 'deal' | 'task';
  itemTitle: string;
  dealValue?: number;
  fromRepId: string;
  fromRepName: string;
  toRepId: string;
  toRepName: string;
  reason: string;
}

export interface ManagerCommandOverview {
  workspaceId: string;
  organizationId: string;
  activeTeamId?: string;
  activeTeamName?: string;
  dateString: string;

  teamMacroKPIs: TeamMacroKPIs;
  aiTeamBrief: AiTeamBrief;
  attentionItems: AttentionItem[];
  reps: RepWorkloadSummary[];
  atRiskDeals: AtRiskDeal[];
  recentInterventions: ManagerInterventionRecord[];
}
