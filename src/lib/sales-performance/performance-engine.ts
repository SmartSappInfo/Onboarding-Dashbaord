/**
 * @fileoverview Pure Sales Performance & Intelligence Evaluator (Phase 1 Engine).
 *
 * ARCHITECTURAL POINTER:
 * Computes multi-dimensional sales performance metrics:
 * 1. Activity (Volume of operational touches)
 * 2. Effort (Intentional human prospecting, discovery, and follow-ups)
 * 3. Quality (Execution standards, duration thresholds, and CRM hygiene)
 * 4. Effectiveness (Buyer engagement, connection rates, and meeting conversions)
 * 5. Outcome (Pipeline value created, deals progressed and won)
 *
 * Provides deterministic calculations for composite Performance Index, target attainment,
 * remaining daily pace, and explainable "Why?" performance drivers.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure functions with zero side-effects.
 * - Guards against NaN, division by zero, and negative values.
 * - Adheres strictly to the zero 'any' policy.
 */

import type {
  PerformanceScorecard,
  PerformancePolicy,
  PerformanceDriver,
  WhyExplanation,
  SalesTarget,
} from './types';

export const DEFAULT_PERFORMANCE_POLICY: PerformancePolicy = {
  id: 'default_policy',
  organizationId: 'default',
  workspaceId: 'default',
  name: 'Standard Balanced 5-Dimension Policy',
  dimensions: {
    activityWeight: 0.3,
    effortWeight: 0.25,
    qualityWeight: 0.15,
    effectivenessWeight: 0.15,
    outcomeWeight: 0.15,
  },
  antiGamingRules: {
    dailyCallCap: 80,
    minCallDurationSeconds: 45,
    requireNotesForCompletion: true,
  },
  leaderboardMode: 'organization',
  status: 'active',
  version: 1,
  updatedAt: new Date().toISOString(),
};

export interface RawPerformanceMetrics {
  calls?: number;
  meetings?: number;
  tasks?: number;
  deals?: number;
  emails?: number;
  campaigns?: number;
  totalPoints?: number;

  // Pre-computed dimension scores (optional override)
  activityScore?: number;
  effortScore?: number;
  qualityScore?: number;
  effectivenessScore?: number;
  outcomeScore?: number;

  // Granular quality / effectiveness counters
  connectedCalls?: number;
  attendedMeetings?: number;
  notesLogged?: number;
  dealsWon?: number;
  pipelineCreatedValue?: number;
}

/**
 * Calculates deterministic 5-dimension scorecard and composite Performance Index (0–100 scale).
 */
export function calculatePerformanceIndex(
  metrics: RawPerformanceMetrics,
  policy: PerformancePolicy = DEFAULT_PERFORMANCE_POLICY
): PerformanceScorecard {
  const {
    calls = 0,
    meetings = 0,
    tasks = 0,
    deals = 0,
    emails = 0,
    totalPoints = 0,
    connectedCalls = 0,
    attendedMeetings = 0,
    notesLogged = 0,
    dealsWon = 0,
  } = metrics;

  // 1. Activity Dimension (0–100): Volume of actions
  // Benchmarked on a standard 30-day baseline (~60 calls, 15 meetings, 25 tasks, 20 emails)
  const totalVolume = calls + meetings * 2 + tasks + emails;
  const activityScore = metrics.activityScore !== undefined
    ? Math.min(100, Math.max(0, metrics.activityScore))
    : Math.min(100, Math.round((totalVolume / 100) * 100));

  // 2. Effort Dimension (0–100): Intentional human work (weighted points earned)
  // Benchmarked against standard monthly effort target of 500 points
  const effortScore = metrics.effortScore !== undefined
    ? Math.min(100, Math.max(0, metrics.effortScore))
    : Math.min(100, Math.round((totalPoints / 500) * 100));

  // 3. Quality Dimension (0–100): Adherence to execution standards & hygiene
  // Evaluates notes recorded and checklist adherence
  const expectedInteractions = calls + meetings;
  const noteRatio = expectedInteractions > 0 ? notesLogged / expectedInteractions : 0.5;
  const qualityScore = metrics.qualityScore !== undefined
    ? Math.min(100, Math.max(0, metrics.qualityScore))
    : Math.min(100, Math.max(20, Math.round(noteRatio * 70 + (tasks > 0 ? 30 : 0))));

  // 4. Effectiveness Dimension (0–100): Buyer response & conversion
  // Evaluates call connection rate and meeting attendance rate
  const connectRate = calls > 0 ? Math.min(1, connectedCalls / calls) : 0.4;
  const attendRate = meetings > 0 ? Math.min(1, attendedMeetings / meetings) : 0.6;
  const effectivenessScore = metrics.effectivenessScore !== undefined
    ? Math.min(100, Math.max(0, metrics.effectivenessScore))
    : Math.min(100, Math.round((connectRate * 0.5 + attendRate * 0.5) * 100));

  // 5. Outcome Dimension (0–100): Results & pipeline velocity
  // Evaluates deals created, advanced, and won
  const wonPoints = dealsWon * 35;
  const dealPoints = deals * 15;
  const outcomeScore = metrics.outcomeScore !== undefined
    ? Math.min(100, Math.max(0, metrics.outcomeScore))
    : Math.min(100, Math.round(Math.min(100, wonPoints + dealPoints)));

  // Weights
  const weights = policy.dimensions;
  const totalWeight =
    weights.activityWeight +
    weights.effortWeight +
    weights.qualityWeight +
    weights.effectivenessWeight +
    weights.outcomeWeight || 1.0;

  const compositeIndex = Math.round(
    (activityScore * weights.activityWeight +
      effortScore * weights.effortWeight +
      qualityScore * weights.qualityWeight +
      effectivenessScore * weights.effectivenessWeight +
      outcomeScore * weights.outcomeWeight) /
      totalWeight
  );

  return {
    activityScore,
    effortScore,
    qualityScore,
    effectivenessScore,
    outcomeScore,
    compositeIndex: Math.min(100, Math.max(0, compositeIndex)),
    dimensionWeights: {
      activity: weights.activityWeight,
      effort: weights.effortWeight,
      quality: weights.qualityWeight,
      effectiveness: weights.effectivenessWeight,
      outcome: weights.outcomeWeight,
    },
  };
}

/**
 * Calculates target attainment %, remaining daily pace, and pace health status.
 */
export function calculateTargetAttainment(
  target: Pick<SalesTarget, 'targetValue' | 'actualValue' | 'startDate' | 'endDate'>,
  now: Date = new Date()
): {
  attainmentPercent: number;
  requiredDailyPace: number;
  daysRemaining: number;
  paceStatus: 'on_track' | 'at_risk' | 'behind' | 'achieved';
} {
  const { targetValue, actualValue, startDate, endDate } = target;

  if (targetValue <= 0) {
    return { attainmentPercent: 100, requiredDailyPace: 0, daysRemaining: 0, paceStatus: 'achieved' };
  }

  const attainmentPercent = Math.round((actualValue / targetValue) * 100);

  if (actualValue >= targetValue) {
    return { attainmentPercent, requiredDailyPace: 0, daysRemaining: 0, paceStatus: 'achieved' };
  }

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const currentMs = now.getTime();

  const totalDurationMs = Math.max(1, endMs - startMs);
  const elapsedMs = Math.max(0, Math.min(totalDurationMs, currentMs - startMs));
  const remainingMs = Math.max(0, endMs - currentMs);

  // Approximate remaining days
  const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const remainingValueNeeded = Math.max(0, targetValue - actualValue);
  const requiredDailyPace = Number((remainingValueNeeded / remainingDays).toFixed(1));

  // Pace health evaluation
  const elapsedRatio = elapsedMs / totalDurationMs;
  const attainmentRatio = actualValue / targetValue;

  let paceStatus: 'on_track' | 'at_risk' | 'behind' | 'achieved' = 'on_track';
  if (attainmentRatio >= elapsedRatio) {
    paceStatus = 'on_track';
  } else if (attainmentRatio >= elapsedRatio * 0.75) {
    paceStatus = 'at_risk';
  } else {
    paceStatus = 'behind';
  }

  return {
    attainmentPercent,
    requiredDailyPace,
    daysRemaining: remainingDays,
    paceStatus,
  };
}

/**
 * Generates an explainable "Why?" performance driver breakdown.
 */
export function generateWhyExplanation(scorecard: PerformanceScorecard): WhyExplanation {
  const drivers: PerformanceDriver[] = [];

  // Evaluate each dimension relative to 70 benchmark
  if (scorecard.effectivenessScore >= 75) {
    drivers.push({
      dimension: 'effectiveness',
      label: 'High Conversion & Attendance',
      impactPercent: Math.round((scorecard.effectivenessScore - 70) / 2),
      type: 'positive',
      explanation: 'Buyer engagement is strong with above-average call connects and meeting attendance.',
    });
  } else if (scorecard.effectivenessScore < 50) {
    drivers.push({
      dimension: 'effectiveness',
      label: 'Low Prospect Response',
      impactPercent: -Math.round((70 - scorecard.effectivenessScore) / 2),
      type: 'negative',
      explanation: 'Call connect rate and meeting attendance have declined below workspace benchmarks.',
    });
  }

  if (scorecard.outcomeScore >= 70) {
    drivers.push({
      dimension: 'outcome',
      label: 'Strong Deal Progression',
      impactPercent: Math.round((scorecard.outcomeScore - 60) / 3),
      type: 'positive',
      explanation: 'Active opportunity creation and closed deals are contributing heavily to overall score.',
    });
  } else if (scorecard.outcomeScore < 40) {
    drivers.push({
      dimension: 'outcome',
      label: 'Pipeline Stagnation',
      impactPercent: -Math.round((50 - scorecard.outcomeScore) / 2),
      type: 'negative',
      explanation: 'Few opportunities have progressed to won stages in this period.',
    });
  }

  if (scorecard.qualityScore >= 75) {
    drivers.push({
      dimension: 'quality',
      label: 'Disciplined CRM Hygiene',
      impactPercent: Math.round((scorecard.qualityScore - 70) / 3),
      type: 'positive',
      explanation: 'Follow-up notes and activity checklists are consistently completed.',
    });
  } else if (scorecard.qualityScore < 50) {
    drivers.push({
      dimension: 'quality',
      label: 'Missing Activity Notes',
      impactPercent: -Math.round((60 - scorecard.qualityScore) / 3),
      type: 'negative',
      explanation: 'Multiple completed calls lack detailed summary notes and next steps.',
    });
  }

  if (scorecard.activityScore >= 80) {
    drivers.push({
      dimension: 'activity',
      label: 'High Operational Volume',
      impactPercent: Math.round((scorecard.activityScore - 70) / 4),
      type: 'positive',
      explanation: 'Strong daily outreach and communication frequency.',
    });
  }

  // Determine trend text
  let trendText = 'Stable performance across measured operational dimensions.';
  if (scorecard.compositeIndex >= 80) {
    trendText = 'Performing in top quartile with balanced outreach, hygiene, and pipeline progression.';
  } else if (scorecard.compositeIndex < 60) {
    trendText = 'Performance constrained by conversion velocity and activity follow-through.';
  }

  return {
    overallScore: scorecard.compositeIndex,
    compositeIndex: scorecard.compositeIndex,
    trendText,
    drivers: drivers.slice(0, 4),
    aiRecommendation:
      scorecard.effectivenessScore < 60
        ? 'Focus on personalized discovery and multi-channel follow-ups to lift connection rates.'
        : scorecard.outcomeScore < 60
        ? 'Prioritize advancing stalled deals with decision-maker proposals.'
        : 'Maintain current cadence and mentor junior reps on discovery call structure.',
  };
}
