/**
 * @fileoverview Contracts and Strict Types for Phase 10: Advanced Revenue Operating System.
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 10 / PRD Section 123 (Phase 10):
 * - Real-time scenario simulation ("What-If" Sensitivity Engine)
 * - Multi-cohort ramp-weighted team capacity planning
 * - Predictive quota attainment and early-warning churn/slippage radar
 * - Organizational behavioral execution archetypes
 * - AI strategic executive recommendations and boardroom briefings
 * - No-code Backoffice platform governance
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - All numeric inputs must be defensively clamped against NaN and division-by-zero.
 *
 * @testability Pure data contracts with zero side effects.
 */

export interface SimulationParameters {
  winRateModifierPercent: number;    // e.g. +5 means baseline win rate + 5%
  dealSizeModifierPercent: number;   // e.g. +10 means avg deal size + 10%
  slippageModifierPercent: number;   // e.g. -5 means slipped deal rate reduced by 5%
  cycleTimeModifierPercent: number;  // e.g. -10 means velocity increased by 10% (cycle shortened)
  headcountDelta: number;            // e.g. +3 reps hired
  sdrToAeRatio: number;              // e.g. 1.5 SDRs per AE
}

export interface RevenueScenario {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  description: string;
  isBaseline?: boolean;
  parameters: SimulationParameters;
  simulatedQuarterlyRevenue: number;
  deltaVsTargetDollars: number;
  deltaVsTargetPercent: number;
  confidenceLowerBound: number;
  confidenceUpperBound: number;
  sensitivityFactors: {
    winRateElasticity: number;
    dealSizeElasticity: number;
    headcountElasticity: number;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RampTier = 'onboarding' | 'ramping' | 'ramped';

export interface RepCapacityCohort {
  repId: string;
  repName: string;
  teamId?: string;
  tenureMonths: number;
  rampTier: RampTier;
  rampFactor: number;             // 0.35 (onboarding), 0.70 (ramping), or 1.00 (ramped)
  assignedQuota: number;          // e.g. $250,000 / quarter
  effectiveCapacityQuota: number; // assignedQuota * rampFactor
  activeDealsCount: number;
  dealCapacityLimit: number;      // e.g. 25 max concurrent opportunities
  utilizationPercent: number;     // (activeDealsCount / dealCapacityLimit) * 100
}

export interface CapacityPlan {
  id: string;
  workspaceId: string;
  organizationId: string;
  quarterLabel: string;           // e.g. "Q4 2026"
  targetRevenue: number;
  totalReps: number;
  rampedRepsCount: number;
  rampingRepsCount: number;
  effectiveCapacityTotal: number;
  quotaCoverageRatio: number;     // total pipeline / targetRevenue
  capacityShortfallDollars: number; // Math.max(0, targetRevenue - effectiveCapacityTotal)
  recommendedHiresCount: number;
  cohorts: RepCapacityCohort[];
  updatedAt: string;
}

export type AttainmentCategory = 'exceeding' | 'on_track' | 'at_risk' | 'critical';

export interface PredictiveAttainmentRecord {
  repId: string;
  repName: string;
  teamId?: string;
  quota: number;
  closedRevenue: number;
  weightedPipeline: number;
  predictedAttainmentDollars: number;
  predictedAttainmentPercent: number;
  category: AttainmentCategory;
  primaryRiskFactor?: string;
  pacingTrend: 'accelerating' | 'steady' | 'decelerating';
}

export interface PredictiveChurnRisk {
  id: string;
  workspaceId: string;
  organizationId: string;
  dealId: string;
  dealName: string;
  dealValue: number;
  accountId?: string;
  accountName?: string;
  churnProbabilityPercent: number; // 0 - 100
  riskSeverity: 'critical' | 'high' | 'medium';
  touchDecayDays: number;
  primaryDriver: string;
  suggestedIntervention: string;
  detectedAt: string;
}

export interface OrganizationalBehaviorArchetype {
  id: string;
  name: string;
  description: string;
  repCount: number;
  percentageOfTeam: number;
  averageWinRate: number;
  averageCycleDays: number;
  keyBehaviors: string[];
  revenueCorrelationScore: number; // -1.0 to +1.0
  recommendedShift?: string;
}

export type StrategicRecCategory = 'capacity' | 'territory' | 'enablement' | 'escalation';

export interface AiStrategicRecommendation {
  id: string;
  workspaceId: string;
  organizationId: string;
  category: StrategicRecCategory;
  title: string;
  description: string;
  rationale: string;
  projectedRevenueImpactDollars: number;
  confidenceScore: number;
  priority: 'critical' | 'high' | 'medium';
  actionPayload?: {
    actionType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  };
  status: 'active' | 'applied' | 'dismissed';
  createdAt: string;
  appliedAt?: string;
  appliedBy?: string;
}

export interface PacingTrajectoryPoint {
  dayNumber: number;
  targetDollars: number;
  actualDollars: number;
  projectedDollars: number;
}

export interface ExecutiveBoardroomSummary {
  totalPipelineDollars: number;
  targetRevenueDollars: number;
  weightedForecastDollars: number;
  predictedPacingPercent: number;
  quotaCoverageRatio: number;
  activeScenariosCount: number;
  aiExecutiveBriefing: string;
  pacingTrajectory: PacingTrajectoryPoint[];
}

export interface RevenueOsGovernance {
  workspaceId: string;
  organizationId: string;
  maxWinRateModifierPercent: number;   // default 20%
  maxDealSizeModifierPercent: number;  // default 30%
  targetQuotaCoverageRatio: number;    // default 3.5
  rampModel: 'standard_3month' | 'enterprise_6month';
  executiveAiModel: string;            // 'googleai/gemini-1.5-pro'
  updatedAt: string;
  updatedBy: string;
}

export interface BaselineRevenueContext {
  baselineQuarterlyRevenue: number;
  targetQuarterlyRevenue: number;
  baselineWinRatePercent: number;
  baselineAverageDealSize: number;
  baselineQuarterlyDealsCount: number;
  baselineSlippageRatePercent: number;
  baselineSalesCycleDays: number;
  activeRepsCount: number;
}
