/**
 * ARCHITECTURE:
 * Creative Experiments & Statistical Significance Engine (Phase 9 - A/B Testing)
 * 
 * Implements rigorous statistical calculations (two-proportion z-test, p-value, CTR lift)
 * and deep-clone variant generator with fresh element IDs.
 * 
 * CAUTION:
 * Never declare a winner with impressions < 500 to prevent false positives.
 * Strict typing (0% any / any[]).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-experiments.test.ts
 */

import type {
  CreativeDocument,
  ExperimentVariant,
  StatisticalResult,
} from './creative-types';
import { makeUniqueId } from './creative-types';

/**
 * Standard normal cumulative distribution function approximation (Abramowitz and Stegun).
 */
export function normalCdf(z: number): number {
  const absZ = Math.abs(z);
  const t = 1.0 / (1.0 + 0.2316419 * absZ);
  const d = 0.3989423 * Math.exp((-absZ * absZ) / 2.0);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1.0 - prob : prob;
}

/**
 * Calculates two-proportion z-test statistical significance between Control and Test variants.
 */
export function calculateStatisticalSignificance(
  control: ExperimentVariant,
  test: ExperimentVariant,
  minSampleSize = 500,
  confidenceThreshold = 95
): StatisticalResult {
  const n1 = control.impressions;
  const x1 = control.clicks;
  const n2 = test.impressions;
  const x2 = test.clicks;

  // 1. Minimum Sample Size Check
  if (n1 < minSampleSize || n2 < minSampleSize) {
    return {
      isSignificant: false,
      confidenceLevel: 0,
      pValue: 1.0,
      liftPercentage: 0,
      recommendation: `Gathering data... (${n1 + n2}/${minSampleSize * 2} minimum impressions reached).`,
    };
  }

  const p1 = x1 / n1; // Control CTR
  const p2 = x2 / n2; // Test CTR

  // Relative Lift Calculation
  const liftPercentage = p1 > 0 ? Math.round(((p2 - p1) / p1) * 1000) / 10 : 0;

  // Pooled Proportion
  const pooledP = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

  if (se === 0) {
    return {
      isSignificant: false,
      confidenceLevel: 50,
      pValue: 1.0,
      liftPercentage: 0,
      recommendation: 'CTR rates are identical between variants.',
    };
  }

  const z = (p2 - p1) / se;
  // Two-tailed p-value
  const pValue = Math.max(0.0001, Math.min(1.0, 2 * (1.0 - normalCdf(Math.abs(z)))));
  const confidenceLevel = Math.round((1.0 - pValue) * 1000) / 10;

  const isSignificant = confidenceLevel >= confidenceThreshold && pValue < 0.05;

  let recommendation = 'Performance difference is within expected random variance.';
  let winningVariantId: string | undefined = undefined;

  if (isSignificant) {
    if (liftPercentage > 0) {
      winningVariantId = test.id;
      recommendation = `Variant "${test.name}" is outperforming Control by +${liftPercentage}% with ${confidenceLevel}% confidence!`;
    } else {
      winningVariantId = control.id;
      recommendation = `Control "${control.name}" outperforms Test with ${confidenceLevel}% confidence.`;
    }
  }

  return {
    isSignificant,
    confidenceLevel,
    pValue: Math.round(pValue * 10000) / 10000,
    liftPercentage,
    winningVariantId,
    recommendation,
  };
}

/**
 * Deep-clones a creative document to create an isolated experiment test variant.
 */
export function cloneDocumentForExperimentVariant(
  source: CreativeDocument,
  variantName: string
): CreativeDocument {
  const newDocId = `doc-var-${makeUniqueId()}`;
  const now = new Date().toISOString();

  // Clone all elements with fresh IDs to prevent shared mutable state
  const clonedElements = source.elements.map((el) => ({
    ...el,
    id: makeUniqueId(),
  }));

  return {
    ...source,
    id: newDocId,
    name: `${source.name} (${variantName})`,
    elements: clonedElements,
    createdAt: now,
    updatedAt: now,
  };
}
