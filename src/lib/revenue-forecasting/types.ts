/**
 * @fileoverview Type definitions and schemas for Revenue Attribution & Predictive Forecasting (Phase 7).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 7:
 * 1. Multi-Touch Attribution Engine (First-Touch, Last-Touch, Linear, Time-Decay, Position-Based, Custom-Weighted).
 * 2. Multi-Rep & Multi-Channel Revenue Credit Splits with integer-cent reconciliation.
 * 3. Monte Carlo Predictive Pipeline Simulation (10,000 iterations, P10/P50/P90 distributions).
 * 4. Clari-style Forecast Categories (Committed, Likely, Best Case, Upside, Omitted).
 * 5. Deal Close-Date Slippage Velocity Radar & AI Natural Language Forecast Explanations.
 * 6. Target Attainment Daily Pace Tracker (Required Daily Pace vs. Run-Rate Pacing).
 * 7. Backoffice No-Code Governance Control Plane (/backoffice/revenue-attribution).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. The use of 'any' or 'any[]' or 'as any' is strictly prohibited.
 * - All timestamps must be ISO 8601 strings.
 * - Stage weights in RevenueForecastingGovernance must strictly normalize to 1.0 (Σ = 1.00).
 * - Multi-rep attribution splits must reconcile to the exact penny with zero float drift.
 */

export type AttributionModelType =
  | 'first_touch'
  | 'last_touch'
  | 'linear'
  | 'time_decay'
  | 'position_based'
  | 'custom_weighted';

export type ForecastCategory =
  | 'committed'
  | 'likely'
  | 'best_case'
  | 'upside'
  | 'omitted';

export type TouchpointChannel =
  | 'whatsapp'
  | 'phone'
  | 'in_person'
  | 'email'
  | 'web'
  | 'document';

export type TouchpointType =
  | 'call'
  | 'meeting'
  | 'proposal'
  | 'email'
  | 'demo'
  | 'document'
  | 'contract';

export type TouchpointActorRole =
  | 'sdr'
  | 'bdr'
  | 'ae'
  | 'se'
  | 'csm'
  | 'exec';

export type DealLifecycleStage =
  | 'lead'
  | 'discovery'
  | 'demo'
  | 'proposal'
  | 'negotiation'
  | 'closing';

export type SlippageSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type PaceHealthStatus = 'ahead' | 'on_track' | 'behind' | 'critical';

/**
 * An individual validated buyer interaction touchpoint along a deal's lifecycle.
 */
export interface AttributionTouchpoint {
  id: string;
  workspaceId: string;
  organizationId: string;
  dealId: string;
  touchType: TouchpointType;
  channel: TouchpointChannel;
  actorId: string;
  actorName: string;
  actorRole: TouchpointActorRole;
  title: string;
  notes?: string;
  timestamp: string; // ISO 8601
  lifecycleStage: DealLifecycleStage;
  weight?: number; // Calculated dynamically by attribution engine
  attributedRevenue?: number; // In currency units
}

/**
 * Breakdown of revenue credit assigned to an individual representative.
 */
export interface RepRevenueSplit {
  actorId: string;
  actorName: string;
  actorRole: TouchpointActorRole;
  touchCount: number;
  percentageCredit: number; // 0 to 100
  attributedAmount: number; // In currency units (exact penny reconciliation)
}

/**
 * Breakdown of revenue credit assigned to a channel.
 */
export interface ChannelRevenueSplit {
  channel: TouchpointChannel;
  touchCount: number;
  percentageCredit: number; // 0 to 100
  attributedAmount: number; // In currency units
}

/**
 * Breakdown of revenue credit assigned to an individual touchpoint.
 */
export interface TouchpointSplit {
  touchpointId: string;
  title: string;
  touchType: TouchpointType;
  channel: TouchpointChannel;
  actorName: string;
  actorRole: TouchpointActorRole;
  timestamp: string;
  lifecycleStage: DealLifecycleStage;
  weight: number; // Normalized weight (0 to 1)
  attributedAmount: number; // In currency units
}

/**
 * Comprehensive multi-touch revenue attribution record for a won or in-flight deal.
 */
export interface RevenueAttributionRecord {
  id: string;
  workspaceId: string;
  organizationId: string;
  dealId: string;
  dealName: string;
  dealValue: number;
  currency: string;
  modelUsed: AttributionModelType;
  status: 'preliminary' | 'final_won';
  closedAt?: string;
  touchpoints: AttributionTouchpoint[];
  touchpointSplits: TouchpointSplit[];
  repSplits: RepRevenueSplit[];
  channelSplits: ChannelRevenueSplit[];
  calculatedAt: string;
  updatedAt: string;
}

/**
 * Distribution bucket for Monte Carlo simulation histograms.
 */
export interface MonteCarloDistributionBucket {
  rangeStart: number;
  rangeEnd: number;
  frequency: number; // Number of simulation runs falling in this bucket
  percentage: number; // 0 to 100
}

/**
 * Complete statistical result of a 10,000-run Monte Carlo simulation.
 */
export interface MonteCarloSimulationResult {
  iterations: number;
  p10Floor: number; // 90% probability floor (conservative)
  p50Likely: number; // 50% median expected outcome (most likely)
  p90Ceiling: number; // 10% stretch ceiling (optimistic)
  mean: number;
  standardDeviation: number;
  confidenceInterval95: {
    lower: number;
    upper: number;
  };
  distributionBuckets: MonteCarloDistributionBucket[];
  totalPipelineValue: number;
  dealCount: number;
  runTimestamp: string;
}

/**
 * Opportunity close-date slip metrics and push velocity.
 */
export interface DealSlippageModel {
  dealId: string;
  dealName: string;
  dealValue: number;
  ownerId: string;
  ownerName: string;
  stageName: string;
  originalCloseDate: string; // ISO 8601
  currentCloseDate: string; // ISO 8601
  slipCount: number; // Number of times close date was pushed
  daysSlipped: number; // Total calendar days delayed
  slipVelocity: number; // slipCount * (daysSlipped / 30)
  severity: SlippageSeverity;
  isPushedPastQuarterEnd: boolean;
  recommendedMitigation: string;
}

/**
 * Tracking of daily pace against active quota targets.
 */
export interface TargetAttainmentPacing {
  targetId: string;
  targetName: string;
  targetQuota: number;
  actualWon: number;
  committedPipeline: number;
  attainmentPercentage: number; // 0 to 100+
  daysElapsed: number;
  daysRemaining: number;
  totalDaysInPeriod: number;
  requiredDailyPace: number; // (targetQuota - actualWon) / daysRemaining
  currentDailyPace: number; // actualWon / daysElapsed
  projectedRunRateOutcome: number; // actualWon + (currentDailyPace * daysRemaining)
  projectedP50Outcome: number; // actualWon + Monte Carlo P50 pipeline
  paceHealth: PaceHealthStatus;
  quotaGap: number; // Math.max(0, targetQuota - actualWon)
}

/**
 * Explainable AI forecast synthesis providing natural language rationale.
 */
export interface AiForecastExplanation {
  overallConfidenceScore: number; // 0 to 100
  weeklyConfidenceDelta: number; // e.g. -4% or +6%
  headline: string;
  explanationSummary: string;
  keyPositiveDrivers: string[];
  keyRiskDeals: {
    dealId: string;
    dealName: string;
    dealValue: number;
    riskReason: string;
  }[];
  recommendedActions: string[];
  generatedAt: string;
}

/**
 * Deal summary representation for forecast category rollups.
 */
export interface ForecastDealItem {
  id: string;
  name: string;
  value: number;
  stageId: string;
  stageName: string;
  ownerId: string;
  ownerName: string;
  healthScore: number; // 0 to 100 (from Phase 6)
  forecastCategory: ForecastCategory;
  expectedCloseDate: string;
  isSingleThreaded: boolean;
  slipCount: number;
  lastActivityAt?: string;
}

/**
 * Aggregate summary for a single forecast category.
 */
export interface ForecastCategorySummary {
  category: ForecastCategory;
  label: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
  confidenceScore: number; // 0 to 100
  percentageOfTarget: number;
}

/**
 * Full master overview payload for the Revenue & Forecasting Cockpit.
 */
export interface RevenueForecastOverview {
  workspaceId: string;
  organizationId: string;
  activePeriod: string; // e.g. '2026-Q3'
  targetPacing: TargetAttainmentPacing;
  monteCarloResult: MonteCarloSimulationResult;
  categories: {
    committed: ForecastCategorySummary;
    likely: ForecastCategorySummary;
    bestCase: ForecastCategorySummary;
    upside: ForecastCategorySummary;
    omitted: ForecastCategorySummary;
  };
  totalPipelineValue: number;
  totalCommittedValue: number;
  aiExplanation: AiForecastExplanation;
  slippageRadar: DealSlippageModel[];
  recentAttributions: RevenueAttributionRecord[];
  allDeals: ForecastDealItem[];
  updatedAt: string;
}

/**
 * Stage weights configuration for the Custom Weighted attribution model.
 */
export interface CustomStageAttributionWeights {
  lead: number;
  discovery: number;
  demo: number;
  proposal: number;
  closing: number;
}

/**
 * Workspace and Backoffice Governance configuration for Revenue Attribution & Forecasting.
 */
export interface RevenueForecastingGovernance {
  workspaceId: string;
  organizationId: string;
  defaultAttributionModel: AttributionModelType;
  customStageWeights: CustomStageAttributionWeights;
  timeDecayHalfLifeDays: number; // Default: 14 days
  positionBasedWeights: {
    firstTouch: number; // Default: 0.40
    lastTouch: number; // Default: 0.40
    middleTouches: number; // Default: 0.20
  };
  commitProbabilityThreshold: number; // Default: 0.85 (85%)
  monteCarloIterations: number; // Default: 10,000
  slippageAlertThresholdDays: number; // Default: 14 days
  updatedAt: string;
  updatedBy: string;
}
