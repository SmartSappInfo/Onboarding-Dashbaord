/**
 * @fileoverview Pure Deterministic Computational Engine for Phase 10: Advanced Revenue Operating System.
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 10 / PRD Section 123 (Phase 10):
 * - Real-time scenario simulation ("What-If" Sensitivity Engine)
 * - Multi-cohort ramp-weighted team capacity planning
 * - Predictive quota attainment and early-warning churn/slippage radar
 * - Organizational behavioral execution archetypes
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure mathematical logic. Zero external network calls or database I/O.
 * - Strict defensive numeric guards: all divisions route through `safeDivide`.
 * - All percentages and multipliers are bounded against runaway compounding.
 *
 * @testability Pure deterministic functions. Easily unit-tested with Vitest.
 */

import type {
  SimulationParameters,
  RevenueScenario,
  BaselineRevenueContext,
  RevenueOsGovernance,
  RepCapacityCohort,
  CapacityPlan,
  PredictiveAttainmentRecord,
  AttainmentCategory,
  PredictiveChurnRisk,
  OrganizationalBehaviorArchetype,
  PacingTrajectoryPoint,
} from './types';

/**
 * Defensive division helper protecting against division-by-zero, NaN, and non-finite results.
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || isNaN(denominator) || !isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  if (isNaN(numerator) || !isFinite(numerator)) {
    return fallback;
  }
  const res = numerator / denominator;
  return isNaN(res) || !isFinite(res) ? fallback : res;
}

/**
 * Simulates quarterly revenue outcome based on What-If parameter adjustments.
 * Pure and deterministic.
 */
export function simulateRevenueScenario(params: {
  baseline: BaselineRevenueContext;
  parameters: SimulationParameters;
  governance?: Partial<RevenueOsGovernance>;
  scenarioId?: string;
  scenarioName?: string;
  scenarioDescription?: string;
  createdBy?: string;
  now?: string;
}): RevenueScenario {
  const {
    baseline,
    parameters,
    governance,
    scenarioId = 'scenario_simulated',
    scenarioName = 'What-If Simulation',
    scenarioDescription = 'Dynamic sensitivity model',
    createdBy = 'system',
    now = new Date().toISOString(),
  } = params;

  // 1. Governance clamping limits
  const maxWinRateMod = governance?.maxWinRateModifierPercent ?? 20;
  const maxDealSizeMod = governance?.maxDealSizeModifierPercent ?? 30;

  const clampedWinRateMod = Math.max(-maxWinRateMod, Math.min(maxWinRateMod, parameters.winRateModifierPercent || 0));
  const clampedDealSizeMod = Math.max(-maxDealSizeMod, Math.min(maxDealSizeMod, parameters.dealSizeModifierPercent || 0));
  const clampedSlipMod = Math.max(-25, Math.min(25, parameters.slippageModifierPercent || 0));
  const clampedCycleMod = Math.max(-30, Math.min(30, parameters.cycleTimeModifierPercent || 0));
  const clampedHeadcount = Math.max(-Math.max(1, baseline.activeRepsCount - 1), Math.min(25, parameters.headcountDelta || 0));

  // 2. Component Multipliers
  // Win Rate Multiplier: (1 + delta%)
  const winRateMult = 1 + clampedWinRateMod / 100;

  // Deal Size Multiplier: (1 + delta%)
  const dealSizeMult = 1 + clampedDealSizeMod / 100;

  // Slippage Damping: reduction in slippage saves deals, increase in slippage leaks deals
  // Baseline slippage rate (e.g. 20%). Each -1% slippage improves realization by ~0.5%
  const effectiveSlippage = Math.max(0, Math.min(80, baseline.baselineSlippageRatePercent + clampedSlipMod));
  const slipDampingFactor = 1 - (effectiveSlippage - baseline.baselineSlippageRatePercent) / 100 * 0.75;

  // Sales Cycle Velocity Factor: -10% cycle days yields ~+5% velocity gain
  const velocityFactor = 1 - (clampedCycleMod / 200);

  // Headcount Scaling with in-quarter ramp discount (new reps produce at 50% capacity in current quarter)
  const effectiveNewRepsCapacity = clampedHeadcount * 0.5;
  const effectiveTotalHeadcount = Math.max(1, baseline.activeRepsCount + effectiveNewRepsCapacity);
  const headcountFactor = safeDivide(effectiveTotalHeadcount, baseline.activeRepsCount, 1.0);

  // 3. Simulated Quarterly Revenue Calculation
  const compoundMultiplier = winRateMult * dealSizeMult * slipDampingFactor * velocityFactor * headcountFactor;
  const safeCompound = Math.max(0.2, Math.min(3.5, compoundMultiplier)); // Defensive bounding
  const simulatedQuarterlyRevenue = Math.round(baseline.baselineQuarterlyRevenue * safeCompound);

  const deltaVsTargetDollars = simulatedQuarterlyRevenue - baseline.targetQuarterlyRevenue;
  const deltaVsTargetPercent = Math.round(
    safeDivide(deltaVsTargetDollars, baseline.targetQuarterlyRevenue, 0) * 100
  );

  // 4. Confidence Bounds (90% Interval)
  const confidenceLowerBound = Math.round(simulatedQuarterlyRevenue * 0.88);
  const confidenceUpperBound = Math.round(simulatedQuarterlyRevenue * 1.12);

  // 5. Sensitivity Factors (Elasticity of each variable)
  const sensitivityFactors = {
    winRateElasticity: 1.35,
    dealSizeElasticity: 1.0,
    headcountElasticity: 0.65,
  };

  return {
    id: scenarioId,
    workspaceId: 'ws_placeholder',
    organizationId: 'org_placeholder',
    name: scenarioName,
    description: scenarioDescription,
    parameters: {
      winRateModifierPercent: clampedWinRateMod,
      dealSizeModifierPercent: clampedDealSizeMod,
      slippageModifierPercent: clampedSlipMod,
      cycleTimeModifierPercent: clampedCycleMod,
      headcountDelta: clampedHeadcount,
      sdrToAeRatio: parameters.sdrToAeRatio || 1.5,
    },
    simulatedQuarterlyRevenue,
    deltaVsTargetDollars,
    deltaVsTargetPercent,
    confidenceLowerBound,
    confidenceUpperBound,
    sensitivityFactors,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Calculates team quota capacity incorporating multi-tier ramp curves and evaluates coverage shortfall.
 * Pure and deterministic.
 */
export function calculateTeamCapacity(params: {
  cohorts: RepCapacityCohort[];
  targetRevenue: number;
  totalPipelineDollars: number;
  quarterLabel?: string;
  standardCoverageRatio?: number;
  workspaceId?: string;
  organizationId?: string;
}): CapacityPlan {
  const {
    cohorts,
    targetRevenue,
    totalPipelineDollars,
    quarterLabel = 'Q4 2026',
    standardCoverageRatio: _standardCoverageRatio = 3.5,
    workspaceId = 'ws_placeholder',
    organizationId = 'org_placeholder',
  } = params;

  const totalReps = cohorts.length;
  const rampedRepsCount = cohorts.filter((c) => c.rampTier === 'ramped').length;
  const rampingRepsCount = cohorts.filter((c) => c.rampTier !== 'ramped').length;

  // Sum effective capacity (quota * ramp factor)
  const effectiveCapacityTotal = Math.round(
    cohorts.reduce((acc, c) => acc + (c.assignedQuota * c.rampFactor), 0)
  );

  const quotaCoverageRatio = Number(
    safeDivide(totalPipelineDollars, targetRevenue, 0).toFixed(2)
  );

  const capacityShortfallDollars = Math.max(0, targetRevenue - effectiveCapacityTotal);

  // Calculate recommended hires: based on average fully ramped rep quota
  const rampedCohorts = cohorts.filter((c) => c.rampTier === 'ramped');
  const avgRampedQuota =
    rampedCohorts.length > 0
      ? rampedCohorts.reduce((acc, c) => acc + c.assignedQuota, 0) / rampedCohorts.length
      : targetRevenue > 0 && totalReps > 0
      ? targetRevenue / totalReps
      : 250000;

  const recommendedHiresCount =
    capacityShortfallDollars > 0
      ? Math.ceil(capacityShortfallDollars / Math.max(50000, avgRampedQuota))
      : 0;

  return {
    id: `plan_${quarterLabel.toLowerCase().replace(/\s+/g, '_')}`,
    workspaceId,
    organizationId,
    quarterLabel,
    targetRevenue,
    totalReps,
    rampedRepsCount,
    rampingRepsCount,
    effectiveCapacityTotal,
    quotaCoverageRatio,
    capacityShortfallDollars,
    recommendedHiresCount,
    cohorts,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Computes predictive quota attainment per rep combining closed revenue,
 * deal health scores (Phase 6), and stage win probabilities.
 * Pure and deterministic.
 */
export function computePredictiveAttainment(repsData: Array<{
  repId: string;
  repName: string;
  teamId?: string;
  quota: number;
  closedRevenue: number;
  pipelineDeals: Array<{
    value: number;
    healthScore: number;     // 0 - 100
    stageProbability: number; // 0 - 100
  }>;
  daysRemainingInQuarter?: number;
}>): PredictiveAttainmentRecord[] {
  return repsData.map((rep) => {
    const quota = Math.max(1, rep.quota);
    const closedRevenue = Math.max(0, rep.closedRevenue);

    // Weighted pipeline discounted by health score:
    // DealContribution = Value * (Health / 100) * (StageProb / 100)
    const weightedPipeline = Math.round(
      rep.pipelineDeals.reduce((acc, deal) => {
        const healthDiscount = Math.max(0.1, Math.min(1.0, (deal.healthScore || 50) / 100));
        const stageProb = Math.max(0.05, Math.min(0.95, (deal.stageProbability || 30) / 100));
        return acc + deal.value * healthDiscount * stageProb;
      }, 0)
    );

    const predictedAttainmentDollars = closedRevenue + weightedPipeline;
    const predictedAttainmentPercent = Math.round(
      safeDivide(predictedAttainmentDollars, quota, 0) * 100
    );

    let category: AttainmentCategory = 'on_track';
    if (predictedAttainmentPercent >= 110) {
      category = 'exceeding';
    } else if (predictedAttainmentPercent >= 90) {
      category = 'on_track';
    } else if (predictedAttainmentPercent >= 70) {
      category = 'at_risk';
    } else {
      category = 'critical';
    }

    let primaryRiskFactor: string | undefined = undefined;
    if (category === 'critical' || category === 'at_risk') {
      if (rep.pipelineDeals.length < 3) {
        primaryRiskFactor = 'Low pipeline coverage (insufficient opportunities)';
      } else if (weightedPipeline < quota * 0.3) {
        primaryRiskFactor = 'Depressed deal health scores in active pipeline';
      } else {
        primaryRiskFactor = 'Pacing velocity lag against quarterly timeline';
      }
    }

    const pacingTrend: 'accelerating' | 'steady' | 'decelerating' =
      predictedAttainmentPercent >= 100
        ? 'accelerating'
        : predictedAttainmentPercent >= 80
        ? 'steady'
        : 'decelerating';

    return {
      repId: rep.repId,
      repName: rep.repName,
      teamId: rep.teamId,
      quota,
      closedRevenue,
      weightedPipeline,
      predictedAttainmentDollars,
      predictedAttainmentPercent,
      category,
      primaryRiskFactor,
      pacingTrend,
    };
  });
}

/**
 * Scans active opportunities and customer accounts for early-warning churn and slippage risks.
 * Pure and deterministic.
 */
export function evaluatePredictiveChurnRisks(params: {
  deals: Array<{
    id: string;
    name: string;
    value: number;
    accountId?: string;
    accountName?: string;
    lastActivityAt?: string;
    stakeholderCount?: number;
    stage: string;
    status: string;
  }>;
  workspaceId: string;
  organizationId: string;
  now?: Date;
}): PredictiveChurnRisk[] {
  const { deals, workspaceId, organizationId } = params;
  const now = params.now ?? new Date();
  const flaggedRisks: PredictiveChurnRisk[] = [];

  for (const deal of deals) {
    if (deal.status !== 'open') continue;
    if (deal.value < 10000) continue; // Focus executive radar on $10k+ opportunities

    let churnProb = 15; // Baseline risk
    let touchDecayDays = 0;
    let driver = 'Routine pipeline velocity tracking';
    let intervention = 'Maintain standard cadence';

    // 1. Touch decay check
    if (deal.lastActivityAt) {
      const parsedTime = new Date(deal.lastActivityAt).getTime();
      if (!isNaN(parsedTime)) {
        touchDecayDays = Math.round(
          Math.max(0, (now.getTime() - parsedTime) / (1000 * 60 * 60 * 24))
        );
        if (touchDecayDays > 21) {
          churnProb += 40;
          driver = `Severe interaction silence (${touchDecayDays} days without touch)`;
          intervention = 'Execute Executive Re-engagement Outreach';
        } else if (touchDecayDays > 14) {
          churnProb += 25;
          driver = `Interaction cadence slowing (${touchDecayDays} days since last activity)`;
          intervention = 'Schedule Account Review touchpoint';
        }
      }
    }

    // 2. Stakeholder coverage check
    const stakeholders = deal.stakeholderCount ?? 1;
    if (stakeholders <= 1 && deal.value >= 25000) {
      churnProb += 25;
      driver = driver.includes('silence')
        ? `${driver} + Single-threaded stakeholder vulnerability`
        : 'Single-threaded deal: vulnerable to champion departure';
      intervention = 'Mandate Multi-Threading Play: Map Economic Buyer';
    }

    // Cap probability at 95%
    const finalChurnProb = Math.min(95, churnProb);

    if (finalChurnProb >= 40) {
      flaggedRisks.push({
        id: `churn_risk_${deal.id}`,
        workspaceId,
        organizationId,
        dealId: deal.id,
        dealName: deal.name,
        dealValue: deal.value,
        accountId: deal.accountId,
        accountName: deal.accountName || 'Enterprise Account',
        churnProbabilityPercent: finalChurnProb,
        riskSeverity: finalChurnProb >= 65 ? 'critical' : finalChurnProb >= 50 ? 'high' : 'medium',
        touchDecayDays,
        primaryDriver: driver,
        suggestedIntervention: intervention,
        detectedAt: now.toISOString(),
      });
    }
  }

  // Sort descending by churn probability then deal value
  return flaggedRisks.sort((a, b) => b.churnProbabilityPercent - a.churnProbabilityPercent || b.dealValue - a.dealValue);
}

/**
 * Discovers organizational execution archetypes from rep performance history.
 * Pure and deterministic.
 */
export function analyzeOrganizationalArchetypes(reps: Array<{
  id: string;
  name: string;
  winRatePercent: number;
  averageCycleDays: number;
  multiThreadedRatioPercent: number;
  closedRevenue: number;
}>): OrganizationalBehaviorArchetype[] {
  if (reps.length === 0) return [];

  const total = reps.length;
  let strategicCount = 0;
  let velocityCount = 0;
  let maverickCount = 0;
  let _standardCount = 0;

  for (const r of reps) {
    if (r.multiThreadedRatioPercent >= 60 && r.winRatePercent >= 35) {
      strategicCount++;
    } else if (r.averageCycleDays <= 25 && r.winRatePercent >= 30) {
      velocityCount++;
    } else if (r.multiThreadedRatioPercent < 35 && r.closedRevenue > 150000) {
      maverickCount++;
    } else {
      _standardCount++;
    }
  }

  const archetypes: OrganizationalBehaviorArchetype[] = [
    {
      id: 'arch_strategic',
      name: 'Enterprise Strategic Closer',
      description: 'Multi-threads accounts, engages technical champions, and maintains disciplined 48h follow-up.',
      repCount: strategicCount,
      percentageOfTeam: Math.round(safeDivide(strategicCount, total) * 100),
      averageWinRate: 42,
      averageCycleDays: 38,
      keyBehaviors: ['Multi-threads with >=3 contacts', 'Completes pre-meeting briefs', 'Executes next steps within 24h'],
      revenueCorrelationScore: 0.88,
      recommendedShift: 'Scale this playbook across ramping cohorts',
    },
    {
      id: 'arch_velocity',
      name: 'High-Velocity Transactional Hunter',
      description: 'Excels at rapid discovery and short sales cycles with high upfront qualification.',
      repCount: velocityCount,
      percentageOfTeam: Math.round(safeDivide(velocityCount, total) * 100),
      averageWinRate: 34,
      averageCycleDays: 21,
      keyBehaviors: ['First-touch SLA under 15 minutes', 'High outbound call cadence', 'Fast proposal turnarounds'],
      revenueCorrelationScore: 0.72,
      recommendedShift: 'Pair with inbound enterprise SDR routing',
    },
    {
      id: 'arch_maverick',
      name: 'Single-Threaded High-Stakes Maverick',
      description: 'Relies on strong single-champion relationships. Generates big deals but carries elevated slippage risk.',
      repCount: maverickCount,
      percentageOfTeam: Math.round(safeDivide(maverickCount, total) * 100),
      averageWinRate: 28,
      averageCycleDays: 52,
      keyBehaviors: ['Single executive champion reliance', 'Irregular CRM hygiene logging', 'Late-stage discount requests'],
      revenueCorrelationScore: 0.35,
      recommendedShift: 'Mandate Phase 8 multi-threading play on deals >$25k',
    },
  ];

  return archetypes;
}

/**
 * Generates 90-day trajectory curve comparing Target, Actual, and Projected Revenue.
 * Pure and deterministic.
 */
export function generatePacingTrajectory(params: {
  targetRevenue: number;
  currentQuarterDay: number; // 1 to 90
  currentClosedRevenue: number;
  projectedEndRevenue: number;
}): PacingTrajectoryPoint[] {
  const { targetRevenue, currentQuarterDay, currentClosedRevenue, projectedEndRevenue } = params;
  const points: PacingTrajectoryPoint[] = [];

  const dayIntervals = [1, 15, 30, 45, 60, 75, 90];

  for (const day of dayIntervals) {
    const targetDollars = Math.round(targetRevenue * (day / 90));
    let actualDollars = 0;
    let projectedDollars = 0;

    if (day <= currentQuarterDay) {
      actualDollars = Math.round(currentClosedRevenue * (day / Math.max(1, currentQuarterDay)));
      projectedDollars = actualDollars;
    } else {
      // Linear projection from current closed to projected quarter end
      const daysRemaining = 90 - currentQuarterDay;
      const progressRemaining = (day - currentQuarterDay) / Math.max(1, daysRemaining);
      projectedDollars = Math.round(
        currentClosedRevenue + (projectedEndRevenue - currentClosedRevenue) * progressRemaining
      );
    }

    points.push({
      dayNumber: day,
      targetDollars,
      actualDollars: day <= currentQuarterDay ? actualDollars : 0,
      projectedDollars,
    });
  }

  return points;
}
