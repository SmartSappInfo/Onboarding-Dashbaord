/**
 * @file src/lib/page-builder/statistical-significance.ts
 * @description Statistical Significance & Confidence Calculator for SmartSapp A/B Testing.
 * Calculates Z-score, P-value, and confidence percentage (95% threshold) comparing variant conversion rates against control.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Sample size safeguards (minimum 100 impressions per variant).
 * - Pure mathematical utility functions.
 */

import type { StatisticalResult } from '@/lib/types';

/**
 * Calculates Z-score and statistical confidence between a control group and a test variant.
 * 
 * TESTABILITY POINTER:
 * Pass known A/B conversion metrics (e.g. Control: 1000 views, 50 conversions vs Variant: 1000 views, 80 conversions)
 * and verify Z-score > 1.96 (95%+ confidence).
 */
export function calculateStatisticalSignificance(
  control: { impressions: number; conversions: number },
  variant: { impressions: number; conversions: number },
): StatisticalResult {
  const minSample = 100;
  const minConversions = 5;

  if (
    !control ||
    !variant ||
    control.impressions < minSample ||
    variant.impressions < minSample ||
    control.conversions < minConversions ||
    variant.conversions < minConversions
  ) {
    return {
      zScore: 0,
      pValue: 1.0,
      confidencePercentage: 0,
      isSignificant: false,
      sampleSizeReached: false,
    };
  }

  const p1 = control.conversions / control.impressions;
  const p2 = variant.conversions / variant.impressions;

  // Pooled probability
  const pPool = (control.conversions + variant.conversions) / (control.impressions + variant.impressions);

  // Standard error
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / control.impressions + 1 / variant.impressions));

  if (se === 0) {
    return {
      zScore: 0,
      pValue: 1.0,
      confidencePercentage: 0,
      isSignificant: false,
      sampleSizeReached: true,
    };
  }

  // Z-Score
  const zScore = (p2 - p1) / se;

  // P-Value approximation using normal cumulative distribution function
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));

  // Confidence percentage
  const confidencePercentage = Math.min(
    99.9,
    Math.max(0, Math.round((1 - pValue) * 1000) / 10),
  );

  const isSignificant = confidencePercentage >= 95.0 && zScore > 0;

  return {
    zScore: Math.round(zScore * 1000) / 1000,
    pValue: Math.round(pValue * 10000) / 10000,
    confidencePercentage,
    isSignificant,
    sampleSizeReached: true,
  };
}

/**
 * Standard normal cumulative distribution function approximation.
 */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const probability =
    d *
    t *
    (0.3193815 +
      t *
        (-0.3565638 +
          t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - probability : probability;
}
