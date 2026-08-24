/**
 * @file src/lib/page-builder/adaptive-traffic-engine.ts
 * @description Adaptive Traffic & Multi-Armed Bandit Resolver Engine for SmartSapp Page Builder.
 * Implements Thompson Sampling over Beta distribution `Beta(alpha, beta)` parameters with Box-Muller
 * random sampling to dynamically route visitor traffic to the highest-converting page variant or rule.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - 5% exploration floor to prevent arm starvation.
 * - Fast O(1) mathematical Beta distribution sampling.
 * - Testable utility pure functions.
 */

import type { BanditArm, BanditPolicy } from '@/lib/types';
import { hashVisitor } from '@/lib/page-builder/experiment-engine';

/**
 * Selects an adaptive traffic arm using Thompson Sampling.
 * 
 * TESTABILITY POINTER:
 * Pass a policy with known alpha/beta values (e.g. Arm A: alpha=100, beta=10 vs Arm B: alpha=10, beta=100)
 * and verify that Arm A is sampled ~90%+ of the time.
 */
export function selectAdaptiveArm(
  policy: BanditPolicy,
  visitorId: string,
): BanditArm {
  if (
    !policy ||
    policy.status !== 'active' ||
    !policy.arms ||
    policy.arms.length === 0
  ) {
    return policy?.arms?.[0] || buildFallbackArm();
  }

  // 1. Epsilon exploration check (e.g. 5% minimum exploration floor)
  const epsilonFloor = policy.epsilon ?? 0.05;
  const fullHash = hashVisitor(`${visitorId}:${policy.id}`);
  const hashScore = (fullHash % 100) / 100;

  if (hashScore < epsilonFloor) {
    // Distribute exploration evenly across all arms using remaining hash entropy
    const armIndex = Math.floor(fullHash / 100) % policy.arms.length;
    return policy.arms[armIndex];
  }

  // 2. Thompson Sampling: Draw Beta(alpha, beta) random variable for each arm
  let bestArm = policy.arms[0];
  let maxSampledValue = -1;

  for (const arm of policy.arms) {
    const alpha = Math.max(1, arm.alpha || 1);
    const beta = Math.max(1, arm.beta || 1);

    const sampledScore = sampleBetaDistribution(alpha, beta);
    if (sampledScore > maxSampledValue) {
      maxSampledValue = sampledScore;
      bestArm = arm;
    }
  }

  return bestArm;
}

/**
 * Recalculates policy allocation weights for UI display based on Monte Carlo simulations (1,000 draws).
 */
export function recalculatePolicyWeights(policy: BanditPolicy): BanditPolicy {
  if (!policy || !policy.arms || policy.arms.length === 0) {
    return policy;
  }

  const simulations = 1000;
  const winCounts: Record<string, number> = {};
  for (const arm of policy.arms) {
    winCounts[arm.id] = 0;
  }

  for (let i = 0; i < simulations; i++) {
    let bestArmId = policy.arms[0].id;
    let maxScore = -1;

    for (const arm of policy.arms) {
      const score = sampleBetaDistribution(
        Math.max(1, arm.alpha || 1),
        Math.max(1, arm.beta || 1),
      );
      if (score > maxScore) {
        maxScore = score;
        bestArmId = arm.id;
      }
    }

    winCounts[bestArmId] = (winCounts[bestArmId] || 0) + 1;
  }

  const updatedArms: BanditArm[] = policy.arms.map((arm) => ({
    ...arm,
    currentWeight: Math.round(((winCounts[arm.id] || 0) / simulations) * 1000) / 10,
  }));

  return {
    ...policy,
    arms: updatedArms,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Samples a Beta(alpha, beta) random variable using Gamma distribution sampling.
 * Beta(a, b) = Gamma(a, 1) / (Gamma(a, 1) + Gamma(b, 1))
 */
export function sampleBetaDistribution(alpha: number, beta: number): number {
  const gammaA = sampleGammaDistribution(alpha);
  const gammaB = sampleGammaDistribution(beta);
  if (gammaA + gammaB === 0) return 0.5;
  return gammaA / (gammaA + gammaB);
}

/**
 * Fast Marsaglia and Tsang method for Gamma distribution sampling (k > 0).
 */
function sampleGammaDistribution(k: number): number {
  if (k < 1) {
    return sampleGammaDistribution(1 + k) * Math.pow(Math.random(), 1 / k);
  }

  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (let i = 0; i < 100; i++) {
    const z = sampleStandardNormal();
    const v = 1 + c * z;
    if (v <= 0) continue;

    const v3 = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * (z * z) * (z * z)) {
      return d * v3;
    }
    if (Math.log(u) < 0.5 * z * z + d * (1 - v3 + Math.log(v3))) {
      return d * v3;
    }
  }

  return k; // Safe fallback
}

/**
 * Box-Muller transformation generating standard Normal N(0, 1) random variable.
 */
function sampleStandardNormal(): number {
  let u1 = Math.random();
  let u2 = Math.random();
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();

  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Fallback arm built when policy configuration is empty.
 */
function buildFallbackArm(): BanditArm {
  return {
    id: 'arm-control-fallback',
    armType: 'variant',
    targetId: 'control',
    name: 'Control Original',
    alpha: 1,
    beta: 1,
    currentWeight: 100,
    conversions: 0,
    impressions: 0,
  };
}
