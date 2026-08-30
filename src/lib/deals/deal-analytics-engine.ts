/**
 * @fileoverview Deals Platform 2.0 Pure Revenue Analytics & Velocity Engine
 *
 * ARCHITECTURAL POINTER (Pure Deterministic Analytics Engine - PRD Section 124 & UI Sections 33-36):
 * Provides 100% pure, side-effect-free, microsecond computation functions for:
 * - Stage-to-Stage Conversion Funnel & Drop-off Analysis (PRD §51, UI §36)
 * - Sales Velocity Formula & Cycle Durations (PRD §51)
 * - Sales Rep Performance Scorecard & Leaderboard (PRD §52)
 * - Pipeline Bottleneck Detection against SLAs (PRD §53)
 * - Revenue Attribution by Lead Source / Channel (PRD §51)
 * - Forecast Risk Panel Metrics & High-Risk Commit Isolation (UI §34)
 * - Consolidated 3-Tier Executive / Management / Operations Matrix (UI §35)
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Strictly zero database side-effects in this file. Operates in-memory over hydrated arrays.
 * - Single-pass O(N) accumulation loops ensure high scalability for 10,000+ opportunities.
 * - Zero division protection on all mathematical ratios (win rate, velocity, coverage, drop-off).
 * - Multi-tenant isolation is guaranteed because input deals are already workspace-filtered.
 * - Strict typing with zero 'any' or 'any[]'.
 *
 * TESTABILITY POINTER:
 * Tested comprehensively in `src/lib/deals/__tests__/deal-analytics-engine.test.ts`.
 */

import type {
  Deal,
  DealStage,
  UserProfile,
  Activity,
  StageFunnelStep,
  SalesVelocityMetrics,
  RepPerformanceMetrics,
  StageBottleneck,
  RevenueAttribution,
  ForecastRiskSummary,
  DealsAnalyticsDataset,
} from '../types';
import { calculateDaysInStage } from './deal-health-engine';

/**
 * Normalizes numbers defensively to prevent NaN, null, undefined, or infinite results.
 */
function safeNumber(value: number | undefined | null, fallback: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

/**
 * Calculates stage-by-stage progression and conversion metrics for funnel visualizer.
 *
 * ALGORITHM:
 * 1. Stages are sorted by their visual pipeline order.
 * 2. For each stage, deals that reached this stage (current stage order >= this stage order,
 *    or explicitly recorded in stageHistory) are counted as "entered".
 * 3. Deals that moved past this stage (higher order stage or won) are counted as "converted".
 * 4. Conversion rate is (converted / entered) * 100; Drop-off rate is 100 - conversionRate.
 */
export function calculateStageConversionFunnel(
  deals: Deal[],
  stages: DealStage[]
): StageFunnelStep[] {
  if (!stages || stages.length === 0) return [];

  const activeDeals = deals.filter(d => !d.isArchived);
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const stageOrderMap = new Map<string, number>();
  sortedStages.forEach((s, idx) => stageOrderMap.set(s.id, idx));

  return sortedStages.map((stage, idx) => {
    const isTerminalStage = Boolean(stage.terminalType === 'won' || stage.terminalType === 'lost' || stage.isWon || stage.isLost);
    const isLastNonTerminalStage = idx === sortedStages.length - 1;

    // Deals currently in this stage or past it
    let dealsEntered = 0;
    let dealsConverted = 0;
    let totalDaysInStage = 0;
    let dealsInThisStageCount = 0;
    let totalValue = 0;

    for (const deal of activeDeals) {
      const currentStageOrder = deal.stageId ? stageOrderMap.get(deal.stageId) : undefined;
      const val = safeNumber(deal.value);

      // Check if deal entered this stage:
      // A deal has entered stage if:
      // 1. Its current stage is this stage or a subsequent stage in order.
      // 2. OR it was marked 'won' (implies traversed open stages).
      // 3. OR its stageHistory contains an entry for this stage.
      const hasHistory = deal.stageHistory?.some(h => h.stageId === stage.id);
      const isCurrentOrPast = currentStageOrder !== undefined && currentStageOrder >= idx;
      const isWon = deal.status === 'won';

      if (isCurrentOrPast || hasHistory || (isWon && !isTerminalStage)) {
        dealsEntered++;
        totalValue += val;

        // Has the deal progressed beyond this stage?
        if (deal.status === 'won' && !isTerminalStage) {
          dealsConverted++;
        } else if (currentStageOrder !== undefined && currentStageOrder > idx) {
          dealsConverted++;
        }
      }

      // Track days spent in this stage for active deals currently situated here
      if (deal.stageId === stage.id) {
        dealsInThisStageCount++;
        totalDaysInStage += calculateDaysInStage(deal.stageEnteredAt, deal.createdAt);
      }
    }

    const conversionRate = dealsEntered > 0
      ? (isTerminalStage || isLastNonTerminalStage
          ? Math.min(100, Math.round((activeDeals.filter(d => d.status === 'won').length / dealsEntered) * 100))
          : Math.min(100, Math.round((dealsConverted / dealsEntered) * 100)))
      : 0;

    const dropOffRate = dealsEntered > 0 ? Math.max(0, 100 - conversionRate) : 0;
    const avgDaysInStage = dealsInThisStageCount > 0 ? Math.round(totalDaysInStage / dealsInThisStageCount) : 0;

    return {
      stageId: stage.id,
      stageName: stage.name,
      stageColor: stage.color || '#3b82f6',
      order: stage.order,
      dealsEntered,
      dealsConverted: isTerminalStage ? dealsEntered : dealsConverted,
      conversionRate,
      dropOffRate: isTerminalStage ? 0 : dropOffRate,
      avgDaysInStage,
      totalValue,
      slaDays: stage.slaDays,
    };
  });
}

/**
 * Computes the industry-standard Sales Velocity metrics:
 *
 * FORMULA:
 *   Sales Velocity ($/day) = (Number of Active Deals * Win Rate % * Average Deal Size) / Average Sales Cycle Days
 *
 * PRD §51 Velocity Metrics:
 * - Average sales cycle in days (creation to won status)
 * - Velocity in $/day revenue generated
 * - Time to proposal & close duration
 */
export function calculateSalesVelocity(deals: Deal[]): SalesVelocityMetrics {
  const activeDeals = deals.filter(d => !d.isArchived);
  const openDeals = activeDeals.filter(d => d.status === 'open');
  const wonDeals = activeDeals.filter(d => d.status === 'won');
  const lostDeals = activeDeals.filter(d => d.status === 'lost');
  const closedDealsCount = wonDeals.length + lostDeals.length;

  const winRatePercentage = closedDealsCount > 0
    ? Math.round((wonDeals.length / closedDealsCount) * 100)
    : 0;

  const activePipelineValue = openDeals.reduce((sum, d) => sum + safeNumber(d.value), 0);
  const totalWonRevenue = wonDeals.reduce((sum, d) => sum + safeNumber(d.value), 0);

  // Average Deal Size
  const avgDealSize = wonDeals.length > 0
    ? Math.round(totalWonRevenue / wonDeals.length)
    : (openDeals.length > 0 ? Math.round(activePipelineValue / openDeals.length) : 0);

  // Calculate Average Sales Cycle (Days from Creation to Won)
  let totalCycleDays = 0;
  let wonWithDatesCount = 0;

  for (const deal of wonDeals) {
    if (deal.createdAt) {
      const createdTime = new Date(deal.createdAt).getTime();
      const closeTime = deal.updatedAt ? new Date(deal.updatedAt).getTime() : new Date().getTime();
      if (!isNaN(createdTime) && !isNaN(closeTime) && closeTime >= createdTime) {
        const days = Math.max(1, Math.floor((closeTime - createdTime) / (1000 * 60 * 60 * 24)));
        totalCycleDays += days;
        wonWithDatesCount++;
      }
    }
  }

  const avgSalesCycleDays = wonWithDatesCount > 0
    ? Math.max(1, Math.round(totalCycleDays / wonWithDatesCount))
    : 30; // Default baseline sales cycle expectation if no historical won deals exist yet

  // Sales Velocity Formula ($/day)
  // Velocity = (Active Deals * Win Rate * Avg Deal Size) / Avg Sales Cycle Days
  const salesVelocityPerDay = avgSalesCycleDays > 0
    ? Math.round((openDeals.length * (winRatePercentage / 100) * avgDealSize) / avgSalesCycleDays)
    : 0;

  // Approximate Time to Proposal & Close
  const timeToProposalDays = Math.max(1, Math.round(avgSalesCycleDays * 0.4));
  const timeToCloseDays = avgSalesCycleDays;

  return {
    salesVelocityPerDay,
    avgSalesCycleDays,
    winRatePercentage,
    avgDealSize,
    activePipelineValue,
    totalWonDeals: wonDeals.length,
    totalWonRevenue,
    timeToProposalDays,
    timeToCloseDays,
  };
}

/**
 * Computes sales rep performance scorecards and leaderboards (PRD Section 52).
 */
export function calculateRepPerformance(
  deals: Deal[],
  users: UserProfile[] = [],
  activities: Activity[] = []
): RepPerformanceMetrics[] {
  const activeDeals = deals.filter(d => !d.isArchived);

  // Group deals by assigned rep ID
  const repGroups = new Map<string, {
    deals: Deal[];
    userName: string;
    userEmail: string;
    avatarUrl?: string;
  }>();

  // Initialize known workspace users
  users.forEach(u => {
    repGroups.set(u.id, {
      deals: [],
      userName: u.name || u.email || 'Team Member',
      userEmail: u.email || '',
      avatarUrl: u.photoURL || undefined,
    });
  });

  // Group deals into rep buckets
  for (const deal of activeDeals) {
    const repId = deal.assignedTo?.userId || 'unassigned';
    if (!repGroups.has(repId)) {
      repGroups.set(repId, {
        deals: [],
        userName: deal.assignedTo?.name || (repId === 'unassigned' ? 'Unassigned' : 'Former Member'),
        userEmail: deal.assignedTo?.email || '',
      });
    }
    repGroups.get(repId)!.deals.push(deal);
  }

  // Count activities per user
  const userActivityCounts = new Map<string, number>();
  activities.forEach(a => {
    if (a.userId) {
      userActivityCounts.set(a.userId, (userActivityCounts.get(a.userId) || 0) + 1);
    }
  });

  const results: RepPerformanceMetrics[] = [];

  for (const [userId, group] of repGroups.entries()) {
    if (group.deals.length === 0 && userId === 'unassigned') continue;

    const repDeals = group.deals;
    const wonDeals = repDeals.filter(d => d.status === 'won');
    const lostDeals = repDeals.filter(d => d.status === 'lost');
    const openDeals = repDeals.filter(d => d.status === 'open');
    const closedCount = wonDeals.length + lostDeals.length;

    const winRatePercentage = closedCount > 0
      ? Math.round((wonDeals.length / closedCount) * 100)
      : 0;

    const revenueWon = wonDeals.reduce((sum, d) => sum + safeNumber(d.value), 0);
    const activePipelineValue = openDeals.reduce((sum, d) => sum + safeNumber(d.value), 0);
    const avgDealSize = wonDeals.length > 0
      ? Math.round(revenueWon / wonDeals.length)
      : (openDeals.length > 0 ? Math.round(activePipelineValue / openDeals.length) : 0);

    // Sales cycle duration for this rep
    let totalCycleDays = 0;
    let cycleCount = 0;
    for (const d of wonDeals) {
      if (d.createdAt && d.updatedAt) {
        const c = new Date(d.createdAt).getTime();
        const u = new Date(d.updatedAt).getTime();
        if (!isNaN(c) && !isNaN(u) && u >= c) {
          totalCycleDays += Math.max(1, Math.floor((u - c) / (1000 * 60 * 60 * 24)));
          cycleCount++;
        }
      }
    }
    const avgSalesCycleDays = cycleCount > 0 ? Math.round(totalCycleDays / cycleCount) : 0;

    results.push({
      userId,
      userName: group.userName,
      userEmail: group.userEmail,
      avatarUrl: group.avatarUrl,
      dealsCount: repDeals.length,
      dealsWonCount: wonDeals.length,
      dealsLostCount: lostDeals.length,
      winRatePercentage,
      revenueWon,
      activePipelineValue,
      avgDealSize,
      avgSalesCycleDays,
      activitiesCount: userActivityCounts.get(userId) || 0,
    });
  }

  // Sort by revenue won descending, then total deals count
  return results.sort((a, b) => b.revenueWon - a.revenueWon || b.dealsCount - a.dealsCount);
}

/**
 * Detects systemic pipeline bottlenecks comparing stage duration and drop-offs to SLAs (PRD Section 53).
 */
export function detectPipelineBottlenecks(
  deals: Deal[],
  stages: DealStage[]
): StageBottleneck[] {
  if (!stages || stages.length === 0) return [];

  const funnel = calculateStageConversionFunnel(deals, stages);
  const bottlenecks: StageBottleneck[] = [];

  for (const step of funnel) {
    const stage = stages.find(s => s.id === step.stageId);
    if (!stage || stage.terminalType === 'won' || stage.terminalType === 'lost' || stage.isWon || stage.isLost) {
      continue;
    }

    const slaDays = stage.slaDays;
    const avgDays = step.avgDaysInStage;

    // Check 1: Stage duration SLA breach (> 1.5x SLA)
    if (slaDays && slaDays > 0 && avgDays > slaDays * 1.5) {
      const delayFactor = Number((avgDays / slaDays).toFixed(1));
      const isCritical = delayFactor >= 2.5;

      bottlenecks.push({
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color || '#3b82f6',
        slaDays,
        avgDaysInStage: avgDays,
        delayFactor,
        dropOffRate: step.dropOffRate,
        severity: isCritical ? 'critical' : 'warning',
        reason: `Deals remain in ${stage.name} for ${avgDays} days on average (${delayFactor}× longer than the ${slaDays}-day target SLA).`,
      });
    }
    // Check 2: High drop-off rate (> 40% drop-off with at least 3 deals)
    else if (step.dealsEntered >= 3 && step.dropOffRate >= 40) {
      bottlenecks.push({
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color || '#3b82f6',
        slaDays,
        avgDaysInStage: avgDays,
        delayFactor: 1.0,
        dropOffRate: step.dropOffRate,
        severity: 'warning',
        reason: `High friction in ${stage.name}: ${step.dropOffRate}% of opportunities stall or exit without converting.`,
      });
    }
  }

  return bottlenecks;
}

/**
 * Calculates won revenue attribution grouped by lead source / channel (PRD Section 51).
 */
export function calculateRevenueAttribution(deals: Deal[]): RevenueAttribution[] {
  const wonDeals = deals.filter(d => !d.isArchived && d.status === 'won');
  if (wonDeals.length === 0) return [];

  const totalWonRevenue = wonDeals.reduce((sum, d) => sum + safeNumber(d.value), 0);
  const sourceGroups = new Map<string, { revenue: number; count: number }>();

  for (const deal of wonDeals) {
    const rawSource = deal.source || 'Direct / Inbound';
    const sourceLabel = formatSourceLabel(rawSource);

    const existing = sourceGroups.get(sourceLabel) || { revenue: 0, count: 0 };
    existing.revenue += safeNumber(deal.value);
    existing.count += 1;
    sourceGroups.set(sourceLabel, existing);
  }

  const results: RevenueAttribution[] = [];
  for (const [source, data] of sourceGroups.entries()) {
    const percentage = totalWonRevenue > 0
      ? Math.round((data.revenue / totalWonRevenue) * 100)
      : 0;

    results.push({
      source,
      revenueWon: data.revenue,
      dealsCount: data.count,
      percentage,
    });
  }

  return results.sort((a, b) => b.revenueWon - a.revenueWon);
}

function formatSourceLabel(source: string): string {
  switch (source) {
    case 'lead_conversion':
      return 'CRM Lead Conversion';
    case 'marketing_campaign':
      return 'Marketing Campaign';
    case 'call_centre':
      return 'Call Centre Outreach';
    case 'automation':
      return 'Automated Triggers';
    case 'bulk_import':
      return 'Bulk Import';
    case 'manual':
      return 'Direct Sales Creation';
    default:
      return source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, ' ');
  }
}

/**
 * Extracts and categorizes high-priority Forecast Risk opportunities (UI Section 34).
 */
export function calculateForecastRiskSummary(
  deals: Deal[],
  _stages: DealStage[] = [],
  now: Date = new Date()
): ForecastRiskSummary {
  const activeDeals = deals.filter(d => !d.isArchived && d.status === 'open');

  const highRiskCommitDeals: Deal[] = [];
  const closingSoonDeals: Deal[] = [];
  const noNextStepDeals: Deal[] = [];

  let highRiskCommitValue = 0;
  let closingIn14DaysValue = 0;
  let withoutNextStepsValue = 0;

  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  for (const deal of activeDeals) {
    const val = safeNumber(deal.value);
    const cat = deal.forecastCategory || 'pipeline';

    // 1. High-Risk Commit Deals (Marked commit or near-close, but flagged at_risk or stalled)
    if (cat === 'commit' && (deal.healthStatus === 'at_risk' || deal.healthStatus === 'stalled')) {
      highRiskCommitDeals.push(deal);
      highRiskCommitValue += val;
    }

    // 2. Closing within 14 days
    if (deal.expectedCloseDate) {
      const closeTime = new Date(deal.expectedCloseDate).getTime();
      if (!isNaN(closeTime)) {
        const diffMs = closeTime - nowMs;
        if (diffMs >= 0 && diffMs <= fourteenDaysMs) {
          closingSoonDeals.push(deal);
          closingIn14DaysValue += val;
        }
      }
    }

    // 3. Deals without scheduled next steps
    const hasNextStep = Boolean(
      deal.nextStep &&
      (typeof deal.nextStep === 'string'
        ? deal.nextStep.trim().length > 0
        : Boolean(deal.nextStep.title && deal.nextStep.title.trim().length > 0))
    );
    if (!hasNextStep) {
      noNextStepDeals.push(deal);
      withoutNextStepsValue += val;
    }
  }

  return {
    highRiskCommitValue,
    highRiskCommitCount: highRiskCommitDeals.length,
    closingIn14DaysValue,
    closingIn14DaysCount: closingSoonDeals.length,
    withoutNextStepsValue,
    withoutNextStepsCount: noNextStepDeals.length,
    highRiskCommitDeals,
    closingSoonDeals,
    noNextStepDeals,
  };
}

/**
 * Consolidates all tiers (Executive, Management, Operations) into a single pure dataset (UI §35).
 */
export function buildConsolidatedAnalyticsDataset(
  deals: Deal[],
  stages: DealStage[],
  users: UserProfile[] = [],
  targetAmount: number = 0,
  _currency: string = 'GHS',
  activities: Activity[] = []
): DealsAnalyticsDataset {
  const activeDeals = deals.filter(d => !d.isArchived);
  const openDeals = activeDeals.filter(d => d.status === 'open');
  const wonDeals = activeDeals.filter(d => d.status === 'won');
  const lostDeals = activeDeals.filter(d => d.status === 'lost');
  const closedCount = wonDeals.length + lostDeals.length;

  const totalRevenueWon = wonDeals.reduce((sum, d) => sum + safeNumber(d.value), 0);
  const totalPipelineValue = openDeals.reduce((sum, d) => sum + safeNumber(d.value), 0);
  const weightedForecastValue = openDeals.reduce((sum, d) => {
    const prob = typeof d.probability === 'number' ? d.probability : 50;
    return sum + Math.round(safeNumber(d.value) * (prob / 100));
  }, 0);

  const winRatePercentage = closedCount > 0
    ? Math.round((wonDeals.length / closedCount) * 100)
    : 0;

  const pipelineCoverageRatio = targetAmount > 0
    ? Number((totalPipelineValue / targetAmount).toFixed(2))
    : 0;

  const forecastAccuracy = targetAmount > 0
    ? Math.min(100, Math.round((totalRevenueWon / targetAmount) * 100))
    : 100;

  // Management Tier
  const funnel = calculateStageConversionFunnel(deals, stages);
  const velocity = calculateSalesVelocity(deals);
  const reps = calculateRepPerformance(deals, users, activities);
  const bottlenecks = detectPipelineBottlenecks(deals, stages);

  // Operations Tier
  const stalledDeals = openDeals.filter(d => d.healthStatus === 'stalled');
  const slaBreachedDeals = openDeals.filter(d => d.healthStatus === 'at_risk' || d.healthStatus === 'stalled');
  const riskSummary = calculateForecastRiskSummary(deals, stages);
  const attributions = calculateRevenueAttribution(deals);

  return {
    executive: {
      totalRevenueWon,
      totalPipelineValue,
      weightedForecastValue,
      winRatePercentage,
      targetAmount,
      pipelineCoverageRatio,
      forecastAccuracy,
    },
    management: {
      funnel,
      velocity,
      reps,
      bottlenecks,
    },
    operations: {
      stalledDealsCount: stalledDeals.length,
      stalledDealsValue: stalledDeals.reduce((sum, d) => sum + safeNumber(d.value), 0),
      slaBreachedCount: slaBreachedDeals.length,
      slaBreachedValue: slaBreachedDeals.reduce((sum, d) => sum + safeNumber(d.value), 0),
      riskSummary,
      attributions,
    },
  };
}
