/**
 * @fileoverview Domain Types & Schemas for SmartSapp Performance Policy Studio (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Establishes canonical contracts for:
 * 1. PerformancePolicy: Multi-dimensional scoring, anti-gaming, and leaderboard configuration.
 * 2. PolicyScoringRule: Granular WHEN/IF/AWARD/CAP/MULTIPLIER rule definitions.
 * 3. AntiGamingPolicy: Tiered daily caps, repetition cooldowns, minimum duration hurdles.
 * 4. LeaderboardPolicy: Privacy, anonymization, and ranking metrics.
 * 5. PolicyVersionRecord: Immutable historical audit snapshots for one-click rollback.
 * 6. PolicySimulationResult: Pre-publish impact analysis, score deltas, and distribution shifts.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Must strictly maintain backward-compatibility with Phase 0, 1, 2, and 3 contracts.
 */

import type { SalesPerformanceDimension, SalesPerformanceDaily } from '@/lib/sales-performance/types';

export type RuleConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'in';

export interface RuleCondition {
  field: string; // e.g. 'durationSeconds', 'outcome', 'dealValue', 'stage', 'status'
  operator: RuleConditionOperator;
  value: string | number | boolean;
}

export interface RuleMultiplier {
  conditionField: string; // e.g. 'dealValue' or 'stage'
  conditionOperator?: RuleConditionOperator;
  conditionValue?: string | number | boolean;
  multiplier: number; // e.g. 1.5, 2.0
  label: string; // e.g. "Enterprise Deal (> $25k)" or "Proposal Stage"
}

export interface RuleCap {
  maxPerEntityPerDay?: number; // e.g. 1 per deal per day
  maxPerRepPerDay?: number;    // e.g. 20 per rep per day
}

export interface PolicyScoringRule {
  id: string;
  eventType: string; // e.g. 'phone_call_completed', 'meeting_completed', 'deal_stage_changed'
  entityType: 'Lead' | 'Contact' | 'Meeting' | 'Task' | 'Deal' | 'Document' | 'Survey';
  category: 'crm' | 'communication' | 'meetings' | 'tasks' | 'deals' | 'documents' | 'surveys' | 'system';
  description: string;
  enabled: boolean;
  basePoints: number;
  targetDimension: SalesPerformanceDimension; // 'activity' | 'effort' | 'quality' | 'effectiveness' | 'outcome'
  conditions: RuleCondition[];
  multipliers: RuleMultiplier[];
  cap?: RuleCap;
  updatedAt: string;
}

export interface TieredDailyCap {
  eventType: string; // e.g. 'phone_call_completed' or '*' for all
  tier1Limit: number; // e.g. 40
  tier1Rate: number;  // e.g. 1.0 (100% credit)
  tier2Limit: number; // e.g. 70
  tier2Rate: number;  // e.g. 0.5 (50% credit)
  tier3Rate: number;  // e.g. 0.0 (0% credit beyond tier2Limit)
}

export interface AntiGamingPolicy {
  tieredDailyCaps: TieredDailyCap[];
  repetitionCooldownSeconds: number; // e.g. 180s cooldown between events on the exact same entity
  minCallDurationSeconds: number;    // e.g. calls < 45s earn 0 effort points
  requireNotesForCompletion: boolean; // tasks/calls without notes receive 0 quality points
  excludeMachineEffort: boolean;      // non-human events (automation/api) earn 0 human effort points
}

export type LeaderboardMode = 'organization' | 'team' | 'private' | 'disabled';
export type LeaderboardRankingMetric = 'compositeIndex' | 'totalPoints' | 'targetAttainment';

export interface LeaderboardPolicy {
  mode: LeaderboardMode;
  anonymizePeers: boolean; // Peers appear as "Representative A", "Representative B" for non-managers
  rankingMetric: LeaderboardRankingMetric;
  allowOptOut: boolean;
}

export interface PolicyDimensionWeights {
  activityWeight: number;      // e.g. 0.25 (25%)
  effortWeight: number;        // e.g. 0.25 (25%)
  qualityWeight: number;       // e.g. 0.20 (20%)
  effectivenessWeight: number; // e.g. 0.15 (15%)
  outcomeWeight: number;       // e.g. 0.15 (15%)
}

export interface PerformancePolicy {
  id: string; // `${workspaceId}_active_policy`
  workspaceId: string;
  organizationId: string;
  name: string;
  description?: string;
  status: 'active' | 'draft' | 'archived';
  version: number;
  effectiveFrom: string; // ISO 8601
  effectiveTo?: string;  // ISO 8601

  // 1. Dimension Weights (Must strictly sum to 1.0 / 100%)
  dimensions: PolicyDimensionWeights;

  // 2. Anti-Gaming Protections
  antiGaming: AntiGamingPolicy;

  // 3. Scoring Rules Catalog
  scoringRules: PolicyScoringRule[];

  // 4. Leaderboard Governance
  leaderboardPolicy: LeaderboardPolicy;

  createdAt: string;
  updatedAt: string;
  updatedBy: {
    userId: string;
    userName: string;
    userEmail?: string;
  };
}

export interface PolicyVersionRecord {
  id: string;
  policyId: string;
  workspaceId: string;
  organizationId: string;
  version: number;
  policySnapshot: PerformancePolicy;
  changeSummary: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  createdAt: string;
}

export interface RepSimulationMetric {
  userId: string;
  userName: string;
  userEmail: string;
  photoURL?: string;
  currentScore: number;
  projectedScore: number;
  scoreDelta: number;
  scoreDeltaPercent: number;
  currentRank: number;
  projectedRank: number;
  rankDelta: number;
  antiGamingFlagsCount: number;
}

export interface DistributionQuartiles {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface PolicySimulationResult {
  simulatedAt: string;
  sampleDaysCount: number;
  repsCount: number;
  repsAffectedCount: number;
  averageScoreDeltaPercent: number;
  antiGamingInterventionsCount: number;

  reps: RepSimulationMetric[];

  distribution: {
    current: DistributionQuartiles;
    projected: DistributionQuartiles;
  };

  warnings: string[];
}

export interface PolicySimulationInput {
  proposedPolicy: PerformancePolicy;
  currentPolicy: PerformancePolicy;
  repsDaily: SalesPerformanceDaily[];
  sampleEvents: Array<{
    eventType: string;
    entityId: string;
    actorId: string;
    points: number;
    durationSeconds?: number;
    occurredAt: string;
    metadata?: Record<string, string | number | boolean>;
  }>;
}

export interface PolicyChangeDiff {
  dimensionChanges: Array<{
    dimension: string;
    oldWeightPercent: number;
    newWeightPercent: number;
  }>;
  ruleChanges: Array<{
    eventType: string;
    changeType: 'added' | 'modified' | 'removed' | 'toggled';
    detail: string;
  }>;
  antiGamingChanges: string[];
  leaderboardChanges: string[];
}
