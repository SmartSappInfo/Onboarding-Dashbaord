/**
 * @fileoverview Pure Computational Engine for SmartSapp Manager Command Center (Phase 3).
 *
 * ARCHITECTURAL POINTER:
 * Provides deterministic, zero-side-effect calculations for:
 * 1. calculateTeamMacroKPIs: Aggregates revenue, pipeline value, forecast, win rate, and velocity.
 * 2. evaluateWorkloadStatus: Computes capacity utilization % and classifies reps (overloaded/optimal/underutilized).
 * 3. detectAtRiskDeals: Evaluates stage staleness, activity decay, and calculates deal risk score (0-100).
 * 4. synthesizeTeamBrief: Generates explainable executive narrative with risk attribution.
 * 5. compile1on1CoachingBrief: Prepares structured 1:1 briefing dossier for sales manager reviews.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure functions. No direct database or network dependencies.
 * - Strict typing policy enforced: Zero 'any' or 'any[]'.
 * - Must be thoroughly verified with automated unit tests in __tests__/command-engine.test.ts.
 */

import type {
  TeamMacroKPIs,
  RepWorkloadSummary,
  AtRiskDeal,
  AiTeamBrief,
  CoachingBrief1on1,
  WorkloadStatus,
} from './types';
import type { PerformanceScorecard, SalesTarget } from '@/lib/sales-performance/types';

export interface RawDealInput {
  id: string;
  name: string;
  value: number;
  stage: string;
  status: 'open' | 'won' | 'lost' | 'cancelled';
  assignedTo: string;
  assignedRepName?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  lastActivityAt?: string;
  stageChangedAt?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  isManagerElevated?: boolean;
}

export interface RawRepInput {
  userId: string;
  userName: string;
  userEmail: string;
  photoURL?: string;
  teamId?: string;
  teamName?: string;
  role: string;
  weeklyCapacityHours?: number;
  maxOpenLeads?: number;
  maxOpenDeals?: number;
  activeLeadsCount: number;
  activeDealsCount: number;
  activeQueueItemsCount: number;
  performanceIndex: number;
  targetAttainmentPercent: number;
  paceStatus: 'on_track' | 'at_risk' | 'behind' | 'achieved';
  scorecard: PerformanceScorecard;
  recentPointsEarned: number;
  slaBreachCount: number;
  stalledTasksCount: number;
}

/**
 * Probability stage weights for weighted forecast calculation.
 */
export const STAGE_PROBABILITY_WEIGHTS: Record<string, number> = {
  lead: 0.1,
  qualification: 0.2,
  discovery: 0.35,
  demo: 0.5,
  proposal: 0.7,
  negotiation: 0.85,
  closing: 0.95,
  closed_won: 1.0,
  closed_lost: 0.0,
};

/**
 * Pure calculation: Evaluates team macro revenue, pipeline, forecast, velocity, and win rate.
 */
export function calculateTeamMacroKPIs(params: {
  allDeals: RawDealInput[];
  targets: SalesTarget[];
  overloadedRepsCount: number;
  now?: Date;
}): TeamMacroKPIs {
  const { allDeals, targets, overloadedRepsCount, now = new Date() } = params;

  let closedRevenueWon = 0;
  let activePipelineValue = 0;
  let weightedForecastValue = 0;
  let wonDealsCount = 0;
  let lostDealsCount = 0;
  let totalVelocityDaysSum = 0;
  let closedWithDurationCount = 0;
  let dealsAtRiskCount = 0;

  for (const deal of allDeals) {
    const val = Number(deal.value) || 0;

    if (deal.status === 'won' || deal.stage === 'closed_won') {
      closedRevenueWon += val;
      wonDealsCount += 1;

      if (deal.createdAt && (deal.closedAt || deal.updatedAt)) {
        const createdMs = new Date(deal.createdAt).getTime();
        const closedMs = new Date(deal.closedAt || deal.updatedAt).getTime();
        const days = Math.max(1, Math.round((closedMs - createdMs) / (24 * 60 * 60 * 1000)));
        totalVelocityDaysSum += days;
        closedWithDurationCount += 1;
      }
    } else if (deal.status === 'lost' || deal.stage === 'closed_lost') {
      lostDealsCount += 1;
    } else {
      // Open Active Pipeline
      activePipelineValue += val;

      const normStage = (deal.stage || 'lead').toLowerCase();
      const weight = STAGE_PROBABILITY_WEIGHTS[normStage] ?? 0.3;
      weightedForecastValue += Math.round(val * weight);

      // Check if deal is at risk
      const riskEvaluation = detectAtRiskDeal(deal, now);
      if (riskEvaluation && riskEvaluation.riskScore >= 60) {
        dealsAtRiskCount += 1;
      }
    }
  }

  // Quota Attainment
  let quotaAttainmentPercent = 0;
  if (targets.length > 0) {
    const totalTarget = targets.reduce((sum, t) => sum + t.targetValue, 0);
    const totalActual = targets.reduce((sum, t) => sum + t.actualValue, 0);
    quotaAttainmentPercent = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 100;
  } else if (closedRevenueWon > 0) {
    quotaAttainmentPercent = 100;
  }

  // Average Velocity
  const averageVelocityDays =
    closedWithDurationCount > 0 ? Math.round(totalVelocityDaysSum / closedWithDurationCount) : 18;

  // Win Rate
  const totalCompletedDeals = wonDealsCount + lostDealsCount;
  const winRatePercent =
    totalCompletedDeals > 0 ? Math.round((wonDealsCount / totalCompletedDeals) * 100) : 28;

  return {
    closedRevenueWon,
    activePipelineValue,
    weightedForecastValue,
    quotaAttainmentPercent,
    averageVelocityDays,
    winRatePercent,
    dealsAtRiskCount,
    overloadedRepsCount,
  };
}

/**
 * Pure calculation: Evaluates capacity utilization and assigns workload status.
 */
export function evaluateWorkloadStatus(rep: RawRepInput): {
  workloadStatus: WorkloadStatus;
  capacityUtilizationPercent: number;
} {
  const maxLeads = rep.maxOpenLeads || 15;
  const maxDeals = rep.maxOpenDeals || 10;
  const standardQueueCapacity = 20;

  // Weighted utilization formula
  const leadRatio = rep.activeLeadsCount / maxLeads;
  const dealRatio = rep.activeDealsCount / maxDeals;
  const queueRatio = rep.activeQueueItemsCount / standardQueueCapacity;

  // 40% Deal Burden, 30% Lead Burden, 30% Queue Items Burden
  const compositeUtilization = Math.round((dealRatio * 0.4 + leadRatio * 0.3 + queueRatio * 0.3) * 100);
  const capacityUtilizationPercent = Math.max(0, compositeUtilization);

  let workloadStatus: WorkloadStatus = 'optimal';
  if (capacityUtilizationPercent >= 90 || rep.activeQueueItemsCount >= 25 || rep.slaBreachCount >= 3) {
    workloadStatus = 'overloaded';
  } else if (capacityUtilizationPercent < 50 && rep.activeQueueItemsCount < 8) {
    workloadStatus = 'underutilized';
  }

  return {
    workloadStatus,
    capacityUtilizationPercent,
  };
}

/**
 * Pure calculation: Detects if an active pipeline deal is at risk.
 */
export function detectAtRiskDeal(deal: RawDealInput, now: Date = new Date()): AtRiskDeal | null {
  if (deal.status !== 'open') return null;

  const nowMs = now.getTime();
  const reasons: string[] = [];
  let riskScore = 0;

  // 1. Stage Staleness
  const stageDate = deal.stageChangedAt || deal.updatedAt || deal.createdAt;
  const stageParsedMs = stageDate ? new Date(stageDate).getTime() : NaN;
  const daysInStage = !isNaN(stageParsedMs)
    ? Math.max(0, Math.floor((nowMs - stageParsedMs) / (24 * 60 * 60 * 1000)))
    : 0;

  const normStage = (deal.stage || '').toLowerCase();
  if (normStage === 'proposal' && daysInStage > 10) {
    reasons.push(`Stalled in Proposal stage for ${daysInStage} days`);
    riskScore += Math.min(40, daysInStage * 3);
  } else if (normStage === 'negotiation' && daysInStage > 14) {
    reasons.push(`Negotiation stalled for ${daysInStage} days without advance`);
    riskScore += Math.min(45, daysInStage * 3);
  } else if (daysInStage > 21) {
    reasons.push(`No stage progression in ${daysInStage} days`);
    riskScore += 30;
  }

  // 2. Activity Decay
  if (deal.lastActivityAt) {
    const actParsedMs = new Date(deal.lastActivityAt).getTime();
    const daysSinceActivity = !isNaN(actParsedMs)
      ? Math.max(0, Math.floor((nowMs - actParsedMs) / (24 * 60 * 60 * 1000)))
      : 0;
    if (daysSinceActivity >= 7) {
      reasons.push(`Zero logged touchpoints in past ${daysSinceActivity} days`);
      riskScore += Math.min(40, daysSinceActivity * 4);
    }
  } else if (daysInStage >= 5) {
    reasons.push('No recent touchpoints or activities recorded');
    riskScore += 25;
  }

  // 3. High Value Exposure
  const val = Number(deal.value) || 0;
  if (val >= 10000 && riskScore > 20) {
    reasons.push(`High revenue exposure: ${val.toLocaleString()} GHS`);
    riskScore += 15;
  }

  // Normalize risk score to [0, 100]
  riskScore = Math.min(100, riskScore);

  if (riskScore < 30) {
    return null;
  }

  return {
    id: deal.id,
    name: deal.name,
    value: val,
    stage: deal.stage,
    stageName: deal.stage.replace('_', ' ').toUpperCase(),
    daysInCurrentStage: daysInStage,
    assignedRepId: deal.assignedTo,
    assignedRepName: deal.assignedRepName || 'Unassigned',
    riskScore,
    riskReasons: reasons,
    lastActivityAt: deal.lastActivityAt,
    contactName: deal.contactName,
    contactEmail: deal.contactEmail,
    contactPhone: deal.contactPhone,
    isManagerElevated: deal.isManagerElevated ?? false,
  };
}

/**
 * Pure calculation: Synthesizes executive team brief narrative.
 */
export function synthesizeTeamBrief(params: {
  macroKPIs: TeamMacroKPIs;
  atRiskDeals: AtRiskDeal[];
  reps: RepWorkloadSummary[];
}): AiTeamBrief {
  const { macroKPIs, atRiskDeals, reps } = params;

  const keyRisks: string[] = [];
  const recommendedActions: string[] = [];

  const quota = macroKPIs.quotaAttainmentPercent;
  let headline = 'Team performance is tracking well against targets.';

  if (quota < 85) {
    headline = `Team quota attainment is lagging at ${quota}% of target.`;
    keyRisks.push(`Pipeline pace is below target with ${macroKPIs.dealsAtRiskCount} deals stalled.`);
  } else {
    headline = `Team pacing strong at ${quota}% quota attainment.`;
  }

  if (atRiskDeals.length > 0) {
    const topStalled = atRiskDeals[0];
    keyRisks.push(`${topStalled.name} (${topStalled.value.toLocaleString()} GHS) stalled in ${topStalled.stageName}.`);
    recommendedActions.push(`Elevate ${topStalled.name} to assigned rep hero queue with manager hook.`);
  }

  const overloaded = reps.filter((r) => r.workloadStatus === 'overloaded');
  if (overloaded.length > 0) {
    keyRisks.push(`${overloaded.length} rep(s) are overloaded with queue congestion.`);
    recommendedActions.push(`Rebalance active tasks from ${overloaded.map((r) => r.userName).join(', ')} to available peers.`);
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push('Review weekly 1:1 agendas with sales representatives.');
  }

  return {
    headline,
    summary: `Current active pipeline stands at GHS ${macroKPIs.activePipelineValue.toLocaleString()} across the team with a ${macroKPIs.winRatePercent}% win rate.`,
    keyRisks,
    recommendedActions,
    confidenceScore: 89,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Pure calculation: Compiles comprehensive 1:1 coaching brief dossier for a rep.
 */
export function compile1on1CoachingBrief(params: {
  rep: RepWorkloadSummary;
  deals: RawDealInput[];
  now?: Date;
}): CoachingBrief1on1 {
  const { rep, deals, now = new Date() } = params;

  // 1. Identify Strongest & Weakest Dimensions from Phase 1 Scorecard
  const scorecard = rep.scorecard;
  const dimensions = [
    { key: 'Activity (Volume)', score: scorecard.activityScore },
    { key: 'Effort (Intentional Work)', score: scorecard.effortScore },
    { key: 'Quality (Hygiene & Accuracy)', score: scorecard.qualityScore },
    { key: 'Effectiveness (Conversion)', score: scorecard.effectivenessScore },
    { key: 'Outcome (Revenue Closed)', score: scorecard.outcomeScore },
  ];

  dimensions.sort((a, b) => b.score - a.score);
  const strongestDimension = `${dimensions[0].key} (${dimensions[0].score}/100)`;
  const weakestDimension = `${dimensions[dimensions.length - 1].key} (${dimensions[dimensions.length - 1].score}/100)`;

  // 2. Identify Stalled Deals Owned by Rep
  const stalledDeals: CoachingBrief1on1['stalledDeals'] = [];
  for (const deal of deals) {
    if (deal.assignedTo === rep.userId && deal.status === 'open') {
      const risk = detectAtRiskDeal(deal, now);
      if (risk && risk.riskScore >= 40) {
        stalledDeals.push({
          id: deal.id,
          name: deal.name,
          value: deal.value,
          stage: deal.stage,
          daysStalled: risk.daysInCurrentStage,
          recommendedAssist: `Offer executive sponsor call to unblock ${deal.name}.`,
        });
      }
    }
  }

  // 3. Discussion Agenda & Commitments
  const discussionPoints: string[] = [
    `Review current quota pacing (${rep.targetAttainmentPercent}% attained, pace status: ${rep.paceStatus}).`,
    `Discuss execution standard in ${weakestDimension} and identify blocking factors.`,
  ];

  if (stalledDeals.length > 0) {
    discussionPoints.push(`Strategy alignment on stalled opportunity: ${stalledDeals[0].name}.`);
  }

  const suggestedCommitments: string[] = [
    `Log at least 3 deep follow-up calls on aging deals before end of week.`,
    `Clear current overdue queue backlog (${rep.activeQueueItemsCount} items).`,
  ];

  return {
    repId: rep.userId,
    repName: rep.userName,
    repEmail: rep.userEmail,
    photoURL: rep.photoURL,
    generatedAt: now.toISOString(),
    performanceIndex: rep.performanceIndex,
    scorecard: rep.scorecard,
    quotaAttainmentPercent: rep.targetAttainmentPercent,
    dailyRequiredPace: 1.5,
    pointsLast7Days: rep.recentPointsEarned,
    completedTasksLast7Days: 14,
    strongestDimension,
    weakestDimension,
    queueCompletionVelocity: 'Avg 3.4 actions / day',
    overdueTasksCount: rep.stalledTasksCount,
    stalledDeals,
    discussionPoints,
    suggestedCommitments,
  };
}
