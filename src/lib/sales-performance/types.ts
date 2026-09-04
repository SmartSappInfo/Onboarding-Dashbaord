/**
 * @fileoverview Domain Types for SmartSapp Sales Performance & Intelligence 2.0 (Phase 1)
 *
 * ARCHITECTURAL POINTER:
 * Establishes the canonical types for human sales workforce modeling, multi-dimensional
 * performance evaluation (Activity, Effort, Quality, Effectiveness, Outcome), targets/quotas,
 * daily time-series aggregates, and explainable performance drivers.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced.
 * - Zero 'any' or 'any[]' allowed.
 * - Conforms to PRD sections 8, 9, 27, and 69.
 */

export type SalesPerformanceDimension =
  | 'activity'
  | 'effort'
  | 'quality'
  | 'effectiveness'
  | 'outcome';

export type TimeRangeFilter = 'today' | 'week' | 'month' | 'quarter' | 'custom';

export type TargetMetric =
  | 'revenue'
  | 'pipeline'
  | 'meetings'
  | 'calls'
  | 'deals'
  | 'tasks'
  | 'points';

export type TargetPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

export type TargetStatus = 'upcoming' | 'active' | 'achieved' | 'missed' | 'closed';

export type TargetOwnerType = 'agent' | 'team' | 'workspace';

export type ActorType = 'User' | 'Automation' | 'API' | 'System';

/**
 * Multi-dimensional Performance Scorecard for an individual sales executive or team.
 */
export interface PerformanceScorecard {
  activityScore: number;       // 0–100 (Volume of touches)
  effortScore: number;         // 0–100 (Intentional human work)
  qualityScore: number;        // 0–100 (Adherence to execution standards)
  effectivenessScore: number;  // 0–100 (Buyer response & conversion)
  outcomeScore: number;        // 0–100 (Commercial pipeline & won deals)
  compositeIndex: number;      // 0–100 (Weighted average across the 5 dimensions)
  dimensionWeights: {
    activity: number;
    effort: number;
    quality: number;
    effectiveness: number;
    outcome: number;
  };
}

/**
 * Driver analysis explaining why a performance score changed ("Why?" action).
 */
export interface PerformanceDriver {
  dimension: SalesPerformanceDimension;
  label: string;
  impactPercent: number; // e.g. +14 or -8
  type: 'positive' | 'negative' | 'neutral';
  explanation: string;
}

export interface WhyExplanation {
  overallScore: number;
  compositeIndex?: number;
  trendText: string;
  drivers: PerformanceDriver[];
  aiRecommendation?: string;
}

/**
 * Sales Agent Profile (Human Workforce Entity).
 */
export interface SalesAgent {
  id: string; // Composite key: `${workspaceId}_${userId}`
  organizationId: string;
  workspaceId: string;
  userId: string;
  userName: string;
  userEmail: string;
  photoURL?: string;
  jobTitle?: string;
  teamId?: string;
  status: 'active' | 'inactive' | 'archived';
  capacity: {
    weeklyHours: number;
    maxOpenLeads?: number;
    maxOpenDeals?: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Sales Team Entity.
 */
export interface SalesTeam {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  description?: string;
  managerIds: string[];
  memberIds: string[];
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/**
 * Workspace Performance Policy configuration.
 */
export interface PerformancePolicy {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  dimensions: {
    activityWeight: number;
    effortWeight: number;
    qualityWeight: number;
    effectivenessWeight: number;
    outcomeWeight: number;
  };
  antiGamingRules: {
    dailyCallCap?: number;
    minCallDurationSeconds?: number;
    requireNotesForCompletion?: boolean;
  };
  leaderboardMode: 'disabled' | 'private' | 'team' | 'organization';
  status: 'active' | 'draft' | 'archived';
  version: number;
  updatedAt: string;
}

/**
 * Sales Target / Quota Entity.
 */
export interface SalesTarget {
  id: string;
  organizationId: string;
  workspaceId: string;
  ownerType: TargetOwnerType;
  ownerId: string;
  ownerName: string;
  metric: TargetMetric;
  period: TargetPeriod;
  baseline?: number;
  targetValue: number;
  stretchTarget?: number;
  actualValue: number;
  attainmentPercent: number; // e.g. 78 (%)
  requiredDailyPace: number;  // remaining needed pace per working day
  paceStatus: 'on_track' | 'at_risk' | 'behind' | 'achieved';
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  status: TargetStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pre-aggregated Daily Bucket for high-scale, zero-waterfall analytics.
 * Stored under: `salesPerformanceDaily/${workspaceId}_${userId}_${YYYY-MM-DD}`
 */
export interface SalesPerformanceDaily {
  id: string; // `${workspaceId}_${userId}_${date}`
  organizationId: string;
  workspaceId: string;
  userId: string;
  date: string; // YYYY-MM-DD

  activityCount: number;
  points: number;

  calls: number;
  meetings: number;
  tasks: number;
  deals: number;
  emails: number;
  campaigns: number;

  effortScore: number;
  qualityScore: number;
  effectivenessScore: number;
  outcomeScore: number;

  pipelineCreatedValue: number;
  dealsWonCount: number;

  updatedAt: string;
}

/**
 * Canonical Sales Performance Event (Immutable Ledger Fact).
 */
export interface SalesPerformanceEvent {
  id: string;
  organizationId: string;
  workspaceId: string;
  teamId?: string;

  actorId: string;
  actorType: ActorType;

  eventType: string;
  entityType: string;
  entityId: string;

  contactId?: string;
  opportunityId?: string;

  occurredAt: string;
  recordedAt: string;

  points: number;
  durationSeconds?: number;

  isMachine: boolean;

  metadata: Record<string, string | number | boolean>;
  idempotencyKey?: string;
}

/**
 * Leaderboard Row ViewModel.
 */
export interface LeaderboardRepSummary {
  userId: string;
  userName: string;
  userEmail: string;
  photoURL?: string;
  totalPoints: number;
  performanceIndex: number;
  meetings: number;
  calls: number;
  deals: number;
  tasks: number;
  targetAttainmentPercent?: number;
  scorecard: PerformanceScorecard;
  lastUpdated: string;
}

/**
 * Complete Performance Overview Response for the Client Dashboard.
 */
export interface PerformanceOverviewData {
  timeRange: TimeRangeFilter;
  startDate: string;
  endDate: string;
  workspaceId: string;

  teamKPIs: {
    averagePerformanceIndex: number;
    totalWorkspaceEffortPoints: number;
    activeRepsCount: number;
    topRep: {
      userId: string;
      userName: string;
      photoURL?: string;
      totalPoints: number;
      performanceIndex: number;
    } | null;
    targetPaceAttainment: number; // average target attainment %
  };

  teamScorecard: PerformanceScorecard;

  leaderboard: LeaderboardRepSummary[];

  chartDataTopReps: Array<{
    name: string;
    points: number;
    performanceIndex: number;
  }>;

  chartDataActionMix: Array<{
    name: string;
    count: number;
  }>;

  dailyTrends: Array<{
    date: string;
    points: number;
    activities: number;
  }>;

  activeTargets: SalesTarget[];
}
