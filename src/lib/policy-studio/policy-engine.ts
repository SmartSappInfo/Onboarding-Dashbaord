/**
 * @fileoverview Pure Computational Engine for SmartSapp Performance Policy Studio (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Provides pure, zero-side-effect deterministic functions for:
 * 1. validatePolicyIntegrity: Enforces strict 100% dimension weight sum, valid bounds, and cap ordering.
 * 2. evaluateEventUnderPolicy: Simulates/evaluates an operational event against policy conditions,
 *    anti-gaming cooldowns, minimum duration hurdles, tiered volume caps, and multipliers.
 * 3. simulatePolicyImpact: Projects rep-by-rep score deltas, rank shifts, distribution quartiles,
 *    and anti-gaming intervention frequencies against historical workspace datasets.
 * 4. generatePolicyChangeDiff: Produces human-readable changelog diffs between policy versions.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure functions. No database, network, or framework state dependencies.
 * - Strict zero 'any' or 'any[]' policy enforced.
 * - Must be thoroughly verified with automated unit tests in __tests__/policy-engine.test.ts.
 */

import type {
  PerformancePolicy,
  PolicyScoringRule,
  RuleCondition,
  RuleMultiplier,
  PolicySimulationInput,
  PolicySimulationResult,
  RepSimulationMetric,
  DistributionQuartiles,
  PolicyChangeDiff,
  PolicyDimensionWeights,
} from './types';
import type { SalesPerformanceDimension } from '@/lib/sales-performance/types';

/**
 * Validates the internal consistency and bounds of a PerformancePolicy.
 */
export function validatePolicyIntegrity(policy: PerformancePolicy): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 1. Dimension weights validation (must sum strictly to 1.0 / 100%)
  const { activityWeight, effortWeight, qualityWeight, effectivenessWeight, outcomeWeight } =
    policy.dimensions;
  const weights = [activityWeight, effortWeight, qualityWeight, effectivenessWeight, outcomeWeight];

  for (const w of weights) {
    if (typeof w !== 'number' || isNaN(w) || w < 0 || w > 1) {
      errors.push(`Invalid dimension weight ${w}. Weights must be numbers between 0 and 1.`);
    }
  }

  const sum = Math.round((activityWeight + effortWeight + qualityWeight + effectivenessWeight + outcomeWeight) * 1000) / 1000;
  if (Math.abs(sum - 1.0) > 0.001) {
    errors.push(
      `Dimension weights must sum to exactly 1.0 (100%). Current sum: ${sum * 100}%.`
    );
  }

  // 2. Anti-gaming policy validation
  const { tieredDailyCaps, repetitionCooldownSeconds, minCallDurationSeconds } = policy.antiGaming;

  if (repetitionCooldownSeconds < 0) {
    errors.push('Repetition cooldown seconds cannot be negative.');
  }

  if (minCallDurationSeconds < 0) {
    errors.push('Minimum call duration hurdle cannot be negative.');
  }

  for (const cap of tieredDailyCaps) {
    if (cap.tier1Limit < 0 || cap.tier2Limit < 0) {
      errors.push(`Daily cap limits must be non-negative for event ${cap.eventType}.`);
    }
    if (cap.tier1Limit >= cap.tier2Limit && cap.tier2Limit > 0) {
      errors.push(`Tier 1 limit (${cap.tier1Limit}) must be less than Tier 2 limit (${cap.tier2Limit}) for event ${cap.eventType}.`);
    }
    if (cap.tier1Rate < 0 || cap.tier2Rate < 0 || cap.tier3Rate < 0) {
      errors.push(`Tier discount rates must be non-negative for event ${cap.eventType}.`);
    }
  }

  // 3. Scoring rules validation
  for (const rule of policy.scoringRules) {
    if (rule.basePoints < 0) {
      errors.push(`Rule for ${rule.eventType} cannot have negative base points.`);
    }
    if (!rule.targetDimension) {
      errors.push(`Rule for ${rule.eventType} must specify a target dimension.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if a single condition matches against event properties and metadata.
 */
function matchesCondition(
  condition: RuleCondition,
  eventData: {
    durationSeconds?: number;
    metadata?: Record<string, string | number | boolean>;
    [key: string]: unknown;
  }
): boolean {
  const { field, operator, value } = condition;

  let actualValue: unknown = undefined;
  if (field === 'durationSeconds') {
    actualValue = eventData.durationSeconds;
  } else if (eventData.metadata && field in eventData.metadata) {
    actualValue = eventData.metadata[field];
  } else if (field in eventData) {
    actualValue = eventData[field];
  }

  if (actualValue === undefined || actualValue === null) {
    return false;
  }

  switch (operator) {
    case 'equals':
      return String(actualValue).toLowerCase() === String(value).toLowerCase();
    case 'not_equals':
      return String(actualValue).toLowerCase() !== String(value).toLowerCase();
    case 'greater_than':
      return Number(actualValue) > Number(value);
    case 'less_than':
      return Number(actualValue) < Number(value);
    case 'greater_than_or_equal':
      return Number(actualValue) >= Number(value);
    case 'less_than_or_equal':
      return Number(actualValue) <= Number(value);
    case 'contains':
      return String(actualValue).toLowerCase().includes(String(value).toLowerCase());
    case 'in': {
      const allowed = Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim().toLowerCase());
      return allowed.includes(String(actualValue).toLowerCase());
    }
    default:
      return true;
  }
}

/**
 * Evaluates an operational event under the given policy rules, anti-gaming safeguards, and multipliers.
 */
export function evaluateEventUnderPolicy(params: {
  event: {
    eventType: string;
    entityId: string;
    actorId: string;
    durationSeconds?: number;
    isMachine?: boolean;
    occurredAt: string;
    metadata?: Record<string, string | number | boolean>;
  };
  policy: PerformancePolicy;
  dailyEventCountForActor?: number;
  lastEventTimeForSameEntity?: string;
}): {
  pointsAwarded: number;
  targetDimension: SalesPerformanceDimension;
  wasCapped: boolean;
  antiGamingFlag?: string;
  multiplierApplied: number;
} {
  const { event, policy, dailyEventCountForActor = 0, lastEventTimeForSameEntity } = params;

  // 1. Machine Activity Exclusion
  if (policy.antiGaming.excludeMachineEffort && event.isMachine) {
    return {
      pointsAwarded: 0,
      targetDimension: 'activity',
      wasCapped: true,
      antiGamingFlag: 'Machine / automation activity excluded from human effort.',
      multiplierApplied: 1,
    };
  }

  // 2. Minimum Call Duration Hurdle
  const isCall = event.eventType.includes('call') || event.eventType.includes('phone');
  if (isCall && event.durationSeconds !== undefined && event.durationSeconds < policy.antiGaming.minCallDurationSeconds) {
    return {
      pointsAwarded: 0,
      targetDimension: 'effort',
      wasCapped: true,
      antiGamingFlag: `Call duration (${event.durationSeconds}s) below minimum threshold (${policy.antiGaming.minCallDurationSeconds}s).`,
      multiplierApplied: 1,
    };
  }

  // 3. Rapid Repetition Cooldown
  if (lastEventTimeForSameEntity && policy.antiGaming.repetitionCooldownSeconds > 0) {
    const lastTime = new Date(lastEventTimeForSameEntity).getTime();
    const currentTime = new Date(event.occurredAt).getTime();
    const elapsedSeconds = Math.abs(currentTime - lastTime) / 1000;

    if (elapsedSeconds < policy.antiGaming.repetitionCooldownSeconds) {
      return {
        pointsAwarded: 0,
        targetDimension: 'effort',
        wasCapped: true,
        antiGamingFlag: `Action repeated within ${Math.round(elapsedSeconds)}s (cooldown is ${policy.antiGaming.repetitionCooldownSeconds}s).`,
        multiplierApplied: 1,
      };
    }
  }

  // 4. Find matching rule in policy (with alias fallbacks for event synonyms)
  const canonicalEventType =
    event.eventType === 'call_completed' || event.eventType === 'phone_call'
      ? 'phone_call_completed'
      : event.eventType;

  const rule = policy.scoringRules.find(
    (r) => (r.eventType === event.eventType || r.eventType === canonicalEventType) && r.enabled
  );
  if (!rule || rule.basePoints === 0) {
    return {
      pointsAwarded: 0,
      targetDimension: rule ? rule.targetDimension : 'effort',
      wasCapped: false,
      multiplierApplied: 1,
    };
  }

  // 5. Check Rule Conditions
  if (rule.conditions && rule.conditions.length > 0) {
    const allConditionsPassed = rule.conditions.every((cond) =>
      matchesCondition(cond, {
        durationSeconds: event.durationSeconds,
        metadata: event.metadata,
      })
    );
    if (!allConditionsPassed) {
      return {
        pointsAwarded: 0,
        targetDimension: rule.targetDimension,
        wasCapped: true,
        antiGamingFlag: 'Event did not satisfy rule execution conditions.',
        multiplierApplied: 1,
      };
    }
  }

  // 6. Calculate Multipliers
  let multiplierApplied = 1;
  if (rule.multipliers && rule.multipliers.length > 0) {
    for (const m of rule.multipliers) {
      if (!m.conditionField) {
        multiplierApplied *= m.multiplier;
      } else {
        const matches = matchesCondition(
          {
            field: m.conditionField,
            operator: m.conditionOperator || 'greater_than',
            value: m.conditionValue !== undefined ? m.conditionValue : 0,
          },
          {
            durationSeconds: event.durationSeconds,
            metadata: event.metadata,
          }
        );
        if (matches) {
          multiplierApplied *= m.multiplier;
        }
      }
    }
  }

  let calculatedPoints = Math.round(rule.basePoints * multiplierApplied);

  // 7. Check Tiered Daily Caps
  let wasCapped = false;
  let antiGamingFlag: string | undefined = undefined;

  const matchingCap = policy.antiGaming.tieredDailyCaps.find(
    (c) => c.eventType === event.eventType || c.eventType === '*'
  );

  if (matchingCap) {
    if (dailyEventCountForActor >= matchingCap.tier2Limit) {
      calculatedPoints = Math.round(calculatedPoints * matchingCap.tier3Rate);
      wasCapped = true;
      antiGamingFlag = `Daily volume (${dailyEventCountForActor}) exceeded Tier 2 limit (${matchingCap.tier2Limit}). Discount rate applied: ${matchingCap.tier3Rate * 100}%.`;
    } else if (dailyEventCountForActor >= matchingCap.tier1Limit) {
      calculatedPoints = Math.round(calculatedPoints * matchingCap.tier2Rate);
      wasCapped = true;
      antiGamingFlag = `Daily volume (${dailyEventCountForActor}) exceeded Tier 1 limit (${matchingCap.tier1Limit}). Discount rate applied: ${matchingCap.tier2Rate * 100}%.`;
    }
  }

  return {
    pointsAwarded: Math.max(0, calculatedPoints),
    targetDimension: rule.targetDimension,
    wasCapped,
    antiGamingFlag,
    multiplierApplied,
  };
}

/**
 * Computes statistical quartiles from a sorted numeric array.
 */
function calculateQuartiles(scores: number[]): DistributionQuartiles {
  if (scores.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const getPercentile = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    if (upper >= sorted.length) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  return {
    min: Math.round(min),
    q1: Math.round(getPercentile(0.25)),
    median: Math.round(getPercentile(0.5)),
    q3: Math.round(getPercentile(0.75)),
    max: Math.round(max),
  };
}

/**
 * Simulates policy changes against historical workspace performance records.
 */
export function simulatePolicyImpact(input: PolicySimulationInput): PolicySimulationResult {
  const { proposedPolicy, currentPolicy, repsDaily, sampleEvents } = input;

  // Group daily records by representative
  const repsMap = new Map<
    string,
    {
      userId: string;
      calls: number;
      meetings: number;
      tasks: number;
      deals: number;
      emails: number;
      points: number;
      activityScore: number;
      effortScore: number;
      qualityScore: number;
      effectivenessScore: number;
      outcomeScore: number;
    }
  >();

  for (const d of repsDaily) {
    const current = repsMap.get(d.userId) || {
      userId: d.userId,
      calls: 0,
      meetings: 0,
      tasks: 0,
      deals: 0,
      emails: 0,
      points: 0,
      activityScore: 0,
      effortScore: 0,
      qualityScore: 0,
      effectivenessScore: 0,
      outcomeScore: 0,
    };

    current.calls += d.calls || 0;
    current.meetings += d.meetings || 0;
    current.tasks += d.tasks || 0;
    current.deals += d.deals || 0;
    current.emails += d.emails || 0;
    current.points += d.points || 0;
    current.activityScore = Math.max(current.activityScore, d.activityCount || 0);
    current.effortScore = Math.max(current.effortScore, d.effortScore || 70);
    current.qualityScore = Math.max(current.qualityScore, d.qualityScore || 75);
    current.effectivenessScore = Math.max(current.effectivenessScore, d.effectivenessScore || 70);
    current.outcomeScore = Math.max(current.outcomeScore, d.outcomeScore || 65);

    repsMap.set(d.userId, current);
  }

  // Track anti-gaming triggers and rule points adjustments on sample events
  let antiGamingInterventionsCount = 0;
  const repAntiGamingCounts = new Map<string, number>();
  const repPointsDelta = new Map<string, number>();

  for (const event of sampleEvents) {
    const curRes = evaluateEventUnderPolicy({
      event,
      policy: currentPolicy,
    });
    const propRes = evaluateEventUnderPolicy({
      event,
      policy: proposedPolicy,
      dailyEventCountForActor: 15,
    });

    const diffPoints = propRes.pointsAwarded - curRes.pointsAwarded;
    const prevDelta = repPointsDelta.get(event.actorId) || 0;
    repPointsDelta.set(event.actorId, prevDelta + diffPoints);

    if (propRes.wasCapped) {
      antiGamingInterventionsCount++;
      const prev = repAntiGamingCounts.get(event.actorId) || 0;
      repAntiGamingCounts.set(event.actorId, prev + 1);
    }
  }

  // Calculate current vs projected composite scores per rep
  const repMetrics: RepSimulationMetric[] = [];
  const currentScores: number[] = [];
  const projectedScores: number[] = [];

  const curDim = currentPolicy.dimensions;
  const propDim = proposedPolicy.dimensions;

  repsMap.forEach((rep, userId) => {
    // Normalised dimension approximations (0–100)
    const act = Math.min(100, Math.round((rep.calls + rep.meetings * 2 + rep.tasks) * 1.2));
    const eff = Math.min(100, Math.round((rep.points / 300) * 100)) || 65;
    const qua = rep.qualityScore || 75;
    const efc = rep.effectivenessScore || 70;
    const out = rep.outcomeScore || 65;

    // Current Composite Score
    const currentScore = Math.round(
      act * curDim.activityWeight +
        eff * curDim.effortWeight +
        qua * curDim.qualityWeight +
        efc * curDim.effectivenessWeight +
        out * curDim.outcomeWeight
    );

    // Simulated Anti-Gaming Impact and Rule Points adjustments on Effort
    const flags = repAntiGamingCounts.get(userId) || 0;
    const antiGamingDampening = flags > 5 ? 0.9 : flags > 2 ? 0.95 : 1.0;
    const pointsDelta = repPointsDelta.get(userId) || 0;
    const simulatedPoints = Math.max(0, rep.points + pointsDelta);
    const effProjected = Math.min(100, Math.round((simulatedPoints / 300) * 100)) || eff;

    // Projected Composite Score
    const projectedScore = Math.round(
      act * propDim.activityWeight +
        effProjected * propDim.effortWeight * antiGamingDampening +
        qua * propDim.qualityWeight +
        efc * propDim.effectivenessWeight +
        out * propDim.outcomeWeight
    );

    currentScores.push(currentScore);
    projectedScores.push(projectedScore);

    const delta = projectedScore - currentScore;
    const deltaPercent = currentScore > 0 ? Math.round((delta / currentScore) * 1000) / 10 : 0;

    repMetrics.push({
      userId,
      userName: `Representative ${userId.slice(-4).toUpperCase()}`,
      userEmail: `${userId}@workspace.com`,
      currentScore,
      projectedScore,
      scoreDelta: delta,
      scoreDeltaPercent: deltaPercent,
      currentRank: 0,
      projectedRank: 0,
      rankDelta: 0,
      antiGamingFlagsCount: flags,
    });
  });

  // Calculate current ranks
  repMetrics.sort((a, b) => b.currentScore - a.currentScore);
  repMetrics.forEach((r, idx) => {
    r.currentRank = idx + 1;
  });

  // Calculate projected ranks
  repMetrics.sort((a, b) => b.projectedScore - a.projectedScore);
  repMetrics.forEach((r, idx) => {
    r.projectedRank = idx + 1;
    r.rankDelta = r.currentRank - r.projectedRank; // positive means rank improved
  });

  // Restore primary sort by current rank
  repMetrics.sort((a, b) => a.currentRank - b.currentRank);

  // Overall metrics
  const repsAffectedCount = repMetrics.filter((r) => r.scoreDelta !== 0).length;
  const totalScoreDelta = repMetrics.reduce((sum, r) => sum + r.scoreDeltaPercent, 0);
  const averageScoreDeltaPercent =
    repMetrics.length > 0 ? Math.round((totalScoreDelta / repMetrics.length) * 10) / 10 : 0;

  // Anomaly warnings
  const warnings: string[] = [];
  for (const r of repMetrics) {
    if (r.scoreDeltaPercent < -15) {
      warnings.push(
        `${r.userName} experiences a severe score drop of ${Math.abs(r.scoreDeltaPercent)}% under proposed policy.`
      );
    } else if (r.scoreDeltaPercent > 30) {
      warnings.push(
        `${r.userName} receives a significant score inflation of +${r.scoreDeltaPercent}%. Review multiplier caps.`
      );
    }
  }

  if (antiGamingInterventionsCount > 20) {
    warnings.push(
      `High anti-gaming friction: ${antiGamingInterventionsCount} events would be capped or rejected under the new daily thresholds.`
    );
  }

  return {
    simulatedAt: new Date().toISOString(),
    sampleDaysCount: 30,
    repsCount: repMetrics.length,
    repsAffectedCount,
    averageScoreDeltaPercent,
    antiGamingInterventionsCount,
    reps: repMetrics,
    distribution: {
      current: calculateQuartiles(currentScores),
      projected: calculateQuartiles(projectedScores),
    },
    warnings,
  };
}

/**
 * Computes a structural diff comparison between two policy snapshots.
 */
export function generatePolicyChangeDiff(
  oldPolicy: PerformancePolicy,
  newPolicy: PerformancePolicy
): PolicyChangeDiff {
  const dimensionChanges: Array<{
    dimension: string;
    oldWeightPercent: number;
    newWeightPercent: number;
  }> = [];

  const dims: SalesPerformanceDimension[] = ['activity', 'effort', 'quality', 'effectiveness', 'outcome'];
  for (const d of dims) {
    const oldW = (oldPolicy.dimensions as unknown as Record<string, number>)[`${d}Weight`] || 0;
    const newW = (newPolicy.dimensions as unknown as Record<string, number>)[`${d}Weight`] || 0;
    if (Math.abs(oldW - newW) > 0.001) {
      dimensionChanges.push({
        dimension: d.charAt(0).toUpperCase() + d.slice(1),
        oldWeightPercent: Math.round(oldW * 100),
        newWeightPercent: Math.round(newW * 100),
      });
    }
  }

  const ruleChanges: Array<{
    eventType: string;
    changeType: 'added' | 'modified' | 'removed' | 'toggled';
    detail: string;
  }> = [];

  const oldRulesMap = new Map(oldPolicy.scoringRules.map((r) => [r.eventType, r]));
  const newRulesMap = new Map(newPolicy.scoringRules.map((r) => [r.eventType, r]));

  newRulesMap.forEach((newRule, eventType) => {
    const oldRule = oldRulesMap.get(eventType);
    if (!oldRule) {
      ruleChanges.push({
        eventType,
        changeType: 'added',
        detail: `Added rule with ${newRule.basePoints} base pts for ${newRule.targetDimension}.`,
      });
    } else if (oldRule.enabled !== newRule.enabled) {
      ruleChanges.push({
        eventType,
        changeType: 'toggled',
        detail: newRule.enabled ? 'Enabled rule' : 'Disabled rule',
      });
    } else if (oldRule.basePoints !== newRule.basePoints || oldRule.targetDimension !== newRule.targetDimension) {
      ruleChanges.push({
        eventType,
        changeType: 'modified',
        detail: `Points changed from ${oldRule.basePoints} to ${newRule.basePoints} (${newRule.targetDimension}).`,
      });
    }
  });

  // Detect removed rules
  oldRulesMap.forEach((oldRule, eventType) => {
    if (!newRulesMap.has(eventType)) {
      ruleChanges.push({
        eventType,
        changeType: 'removed',
        detail: `Removed rule that previously awarded ${oldRule.basePoints} base pts.`,
      });
    }
  });

  const antiGamingChanges: string[] = [];
  if (oldPolicy.antiGaming.minCallDurationSeconds !== newPolicy.antiGaming.minCallDurationSeconds) {
    antiGamingChanges.push(
      `Minimum call duration changed from ${oldPolicy.antiGaming.minCallDurationSeconds}s to ${newPolicy.antiGaming.minCallDurationSeconds}s.`
    );
  }
  if (oldPolicy.antiGaming.repetitionCooldownSeconds !== newPolicy.antiGaming.repetitionCooldownSeconds) {
    antiGamingChanges.push(
      `Repetition cooldown changed from ${oldPolicy.antiGaming.repetitionCooldownSeconds}s to ${newPolicy.antiGaming.repetitionCooldownSeconds}s.`
    );
  }

  const leaderboardChanges: string[] = [];
  if (oldPolicy.leaderboardPolicy.mode !== newPolicy.leaderboardPolicy.mode) {
    leaderboardChanges.push(
      `Leaderboard mode changed from ${oldPolicy.leaderboardPolicy.mode} to ${newPolicy.leaderboardPolicy.mode}.`
    );
  }
  if (oldPolicy.leaderboardPolicy.anonymizePeers !== newPolicy.leaderboardPolicy.anonymizePeers) {
    leaderboardChanges.push(
      newPolicy.leaderboardPolicy.anonymizePeers ? 'Enabled peer anonymization' : 'Disabled peer anonymization'
    );
  }

  return {
    dimensionChanges,
    ruleChanges,
    antiGamingChanges,
    leaderboardChanges,
  };
}

/**
 * System default dimension weights conforming to Phase 1 standards.
 */
export function calculateDefaultDimensionWeights(): PolicyDimensionWeights {
  return {
    activityWeight: 0.3,
    effortWeight: 0.25,
    qualityWeight: 0.15,
    effectivenessWeight: 0.15,
    outcomeWeight: 0.15,
  };
}
