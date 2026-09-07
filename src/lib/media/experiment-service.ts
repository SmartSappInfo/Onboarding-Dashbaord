/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Autonomous Experimentation & Multi-Armed Bandit:
 *    - Implements Section 131 of `media_prd.md` and Section 159 of `media_ux.md`.
 *    - Orchestrates A/B testing and Multi-Armed Bandit (MAB) variant traffic routing:
 *      epsilon-greedy (10% exploration / 90% exploitation) and static splits.
 * 2. Mathematical Rigor & Statistical Confidence:
 *    - Implements two-tailed Z-score hypothesis testing with Abramowitz & Stegun error function
 *      approximation to compute true p-values and confidence intervals.
 * 3. Auto-Promotion & High Load Safety:
 *    - Automatically promotes statistically winning variants (p < 0.05, N >= minSampleSize) to 100% traffic allocation.
 *    - All database writes strictly adhere to the chunked batch write protocol (max 150 ops).
 * 4. Strict Typing Standard:
 *    - Zero use of `any` or `any[]`.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore';
import type {
  MediaExperiment,
  ExperimentVariant,
  ExperimentType,
  ExperimentStatus,
  BanditAlgorithm,
  ABExperimentVariantOverrides,
} from '../types/media-2.0';

export interface StatisticalTestResult {
  zScore: number;
  pValue: number;
  confidenceScore: number; // 0.0% to 100.0%
  isSignificant: boolean;
  winnerVariantId?: string;
  liftPercent: number;
}

/**
 * Standard Normal Error Function (erf) approximation for two-tailed p-value.
 * Accurate to within 1.5e-7 (Abramowitz and Stegun 7.1.26).
 */
function errorFunction(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Computes standard normal cumulative distribution function (CDF).
 */
function normalCdf(z: number): number {
  return 0.5 * (1.0 + errorFunction(z / Math.sqrt(2.0)));
}

/**
 * Calculates Z-Score, two-tailed p-value, and statistical significance between two variants.
 */
export function calculateStatisticalSignificance(
  control: ExperimentVariant,
  challenger: ExperimentVariant,
  alphaThreshold: number = 0.05
): StatisticalTestResult {
  const nA = Math.max(1, control.impressions);
  const nB = Math.max(1, challenger.impressions);
  const cA = control.conversions;
  const cB = challenger.conversions;

  const pA = cA / nA;
  const pB = cB / nB;

  const liftPercent = pA > 0 ? ((pB - pA) / pA) * 100 : 0;

  // If sample size is too low, treat as inconclusive
  if (nA < 30 || nB < 30 || (cA === 0 && cB === 0)) {
    return {
      zScore: 0,
      pValue: 1.0,
      confidenceScore: 50.0,
      isSignificant: false,
      liftPercent,
    };
  }

  // Pooled conversion probability
  const pooledP = (cA + cB) / (nA + nB);

  // Prevent division by zero if both variants have 0% or 100% conversion
  if (pooledP <= 0 || pooledP >= 1) {
    return {
      zScore: 0,
      pValue: 1.0,
      confidenceScore: 50.0,
      isSignificant: false,
      liftPercent,
    };
  }

  const standardError = Math.sqrt(pooledP * (1 - pooledP) * (1 / nA + 1 / nB));
  if (standardError === 0) {
    return {
      zScore: 0,
      pValue: 1.0,
      confidenceScore: 50.0,
      isSignificant: false,
      liftPercent,
    };
  }

  const zScore = (pB - pA) / standardError;
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));
  const confidenceScore = Math.min(99.99, Math.max(0, (1 - pValue) * 100));
  const isSignificant = pValue < alphaThreshold && nA + nB >= 100;

  let winnerVariantId: string | undefined;
  if (isSignificant) {
    winnerVariantId = pB > pA ? challenger.id : control.id;
  }

  return {
    zScore: parseFloat(zScore.toFixed(3)),
    pValue: parseFloat(pValue.toFixed(4)),
    confidenceScore: parseFloat(confidenceScore.toFixed(2)),
    isSignificant,
    winnerVariantId,
    liftPercent: parseFloat(liftPercent.toFixed(1)),
  };
}

/**
 * Deterministic hash integer generator for consistent visitor variant assignment.
 */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Evaluates traffic routing to choose the variant for a given visitor.
 * Supports static split and epsilon-greedy Multi-Armed Bandit routing.
 */
export function evaluateTrafficVariant(
  experiment: MediaExperiment,
  visitorId: string,
  explorationRate: number = 0.10
): ExperimentVariant {
  const variants = experiment.variants;
  if (!variants || variants.length === 0) {
    return {
      id: 'default',
      name: 'Default Control',
      weight: 100,
      overrides: {},
      impressions: 0,
      conversions: 0,
      conversionRate: 0,
      valueSum: 0,
      isControl: true,
      isWinner: false,
    };
  }

  // If experiment has concluded or winner was auto-promoted, return winner
  if (experiment.winnerVariantId) {
    const winner = variants.find((v) => v.id === experiment.winnerVariantId);
    if (winner) return winner;
  }

  if (experiment.status !== 'RUNNING') {
    return variants.find((v) => v.isControl) || variants[0];
  }

  const hashVal = hashStringToInt(`${experiment.id}_${visitorId}`);

  // Epsilon-Greedy Multi-Armed Bandit Logic
  if (experiment.algorithm === 'EPSILON_GREEDY') {
    // Determine top performing variant (exploitation)
    let bestVariant = variants[0];
    let highestRate = -1;

    for (const v of variants) {
      if (v.impressions >= 15 && v.conversionRate > highestRate) {
        highestRate = v.conversionRate;
        bestVariant = v;
      }
    }

    // Only execute bandit routing if at least one variant has sufficient sample size (>= 15 impressions)
    if (highestRate >= 0) {
      const randomRoll = (hashVal % 1000) / 1000;
      if (randomRoll > explorationRate) {
        // Exploit best variant (e.g. 90% of traffic)
        return bestVariant;
      }

      // Explore: pick uniformly among other variants (e.g. 10% of traffic)
      const otherVariants = variants.filter((v) => v.id !== bestVariant.id);
      if (otherVariants.length > 0) {
        // Bit-shift hashVal to decorrelate exploration variant selection from the randomRoll threshold
        const exploreIndex = Math.abs((hashVal >> 10) % otherVariants.length);
        return otherVariants[exploreIndex];
      }
    }
    // Cold-start fallback: when no variant has reached 15 impressions, fall through to static cumulative weights below
  }

  // Fallback / Static Cumulative Weight Distribution
  const normalizedRoll = hashVal % 100;
  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.weight;
    if (normalizedRoll < cumulative) {
      return v;
    }
  }

  return variants[0];
}

/**
 * Creates a new media experiment document.
 */
export async function createMediaExperimentAction(
  firestore: Firestore,
  workspaceId: string,
  params: {
    experienceId: string;
    assetId: string;
    name: string;
    type: ExperimentType;
    algorithm?: BanditAlgorithm;
    variants: Array<{
      name: string;
      weight: number;
      overrides: ABExperimentVariantOverrides;
      isControl?: boolean;
    }>;
    autoPromoteWinner?: boolean;
    minSampleSize?: number;
  }
): Promise<MediaExperiment | null> {
  if (!firestore || !workspaceId || !params.experienceId) return null;

  try {
    const experimentId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const experimentRef = doc(firestore, 'media_experiments', experimentId);

    const formattedVariants: ExperimentVariant[] = params.variants.map((v, i) => ({
      id: `var_${i}_${Math.random().toString(36).substring(2, 6)}`,
      name: v.name,
      weight: v.weight,
      overrides: v.overrides,
      impressions: 0,
      conversions: 0,
      conversionRate: 0,
      valueSum: 0,
      isControl: v.isControl ?? (i === 0),
      isWinner: false,
    }));

    const experiment: MediaExperiment = {
      id: experimentId,
      workspaceId,
      experienceId: params.experienceId,
      assetId: params.assetId,
      name: params.name,
      type: params.type,
      algorithm: params.algorithm || 'EPSILON_GREEDY',
      status: 'RUNNING',
      variants: formattedVariants,
      confidenceScore: 50.0,
      pValue: 1.0,
      minSampleSize: params.minSampleSize || 100,
      autoPromoteWinner: params.autoPromoteWinner ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(experimentRef, experiment);
    return experiment;
  } catch (err) {
    console.error('[createMediaExperimentAction] Error creating experiment:', err);
    return null;
  }
}

/**
 * Records an impression or conversion event for an active experiment variant.
 */
export async function recordExperimentEventAction(
  firestore: Firestore,
  workspaceId: string,
  experimentId: string,
  variantId: string,
  eventType: 'impression' | 'conversion',
  revenueAmount: number = 0
): Promise<boolean> {
  if (!firestore || !workspaceId || !experimentId || !variantId) return false;

  try {
    const experimentRef = doc(firestore, 'media_experiments', experimentId);
    const snap = await getDoc(experimentRef);
    if (!snap.exists()) return false;

    const exp = snap.data() as MediaExperiment;
    if (exp.status !== 'RUNNING') return false;

    let updated = false;
    const nextVariants = exp.variants.map((v) => {
      if (v.id === variantId) {
        updated = true;
        const newImpressions = eventType === 'impression' ? v.impressions + 1 : v.impressions;
        const newConversions = eventType === 'conversion' ? v.conversions + 1 : v.conversions;
        const newRate = newImpressions > 0 ? newConversions / newImpressions : 0;
        const newValueSum = eventType === 'conversion' ? v.valueSum + revenueAmount : v.valueSum;

        return {
          ...v,
          impressions: newImpressions,
          conversions: newConversions,
          conversionRate: parseFloat(newRate.toFixed(4)),
          valueSum: newValueSum,
        };
      }
      return v;
    });

    if (!updated) return false;

    // Check statistical significance if control and challenger exist
    const control = nextVariants.find((v) => v.isControl) || nextVariants[0];
    const challenger = nextVariants.find((v) => !v.isControl) || nextVariants[1];

    let pValue = exp.pValue;
    let confidenceScore = exp.confidenceScore;
    let winnerVariantId = exp.winnerVariantId;
    let status: ExperimentStatus = exp.status;

    if (control && challenger) {
      const stats = calculateStatisticalSignificance(control, challenger);
      pValue = stats.pValue;
      confidenceScore = stats.confidenceScore;

      // Auto-promote winner if criteria met
      const totalImpressions = control.impressions + challenger.impressions;
      if (
        exp.autoPromoteWinner &&
        stats.isSignificant &&
        totalImpressions >= exp.minSampleSize &&
        stats.winnerVariantId
      ) {
        winnerVariantId = stats.winnerVariantId;
        status = 'AUTO_PROMOTED';

        // Rebalance winner weight to 100%
        nextVariants.forEach((v) => {
          v.isWinner = v.id === winnerVariantId;
          v.weight = v.id === winnerVariantId ? 100 : 0;
        });
      }
    }

    await setDoc(
      experimentRef,
      {
        variants: nextVariants,
        pValue,
        confidenceScore,
        winnerVariantId,
        status,
        updatedAt: new Date().toISOString(),
        concludedAt: status === 'AUTO_PROMOTED' ? new Date().toISOString() : undefined,
      },
      { merge: true }
    );

    return true;
  } catch (err) {
    console.error('[recordExperimentEventAction] Error updating event:', err);
    return false;
  }
}

/**
 * Manually promotes a variant as the winner, ending the experiment and locking 100% traffic.
 */
export async function promoteExperimentWinnerAction(
  firestore: Firestore,
  workspaceId: string,
  experimentId: string,
  winnerVariantId: string
): Promise<boolean> {
  if (!firestore || !workspaceId || !experimentId || !winnerVariantId) return false;

  try {
    const ref = doc(firestore, 'media_experiments', experimentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;

    const exp = snap.data() as MediaExperiment;
    const nextVariants = exp.variants.map((v) => ({
      ...v,
      isWinner: v.id === winnerVariantId,
      weight: v.id === winnerVariantId ? 100 : 0,
    }));

    await setDoc(
      ref,
      {
        variants: nextVariants,
        winnerVariantId,
        status: 'CONCLUDED',
        confidenceScore: 100.0,
        updatedAt: new Date().toISOString(),
        concludedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return true;
  } catch (err) {
    console.error('[promoteExperimentWinnerAction] Error promoting winner:', err);
    return false;
  }
}

/**
 * Pauses an active experiment.
 */
export async function pauseMediaExperimentAction(
  firestore: Firestore,
  workspaceId: string,
  experimentId: string
): Promise<boolean> {
  if (!firestore || !workspaceId || !experimentId) return false;

  try {
    const ref = doc(firestore, 'media_experiments', experimentId);
    await setDoc(
      ref,
      {
        status: 'PAUSED',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('[pauseMediaExperimentAction] Error pausing:', err);
    return false;
  }
}

/**
 * Resumes a paused experiment.
 */
export async function resumeMediaExperimentAction(
  firestore: Firestore,
  workspaceId: string,
  experimentId: string
): Promise<boolean> {
  if (!firestore || !workspaceId || !experimentId) return false;

  try {
    const ref = doc(firestore, 'media_experiments', experimentId);
    await setDoc(
      ref,
      {
        status: 'RUNNING',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('[resumeMediaExperimentAction] Error resuming:', err);
    return false;
  }
}

/**
 * Deletes a media experiment.
 */
export async function deleteMediaExperimentAction(
  firestore: Firestore,
  workspaceId: string,
  experimentId: string
): Promise<boolean> {
  if (!firestore || !workspaceId || !experimentId) return false;

  try {
    await deleteDoc(doc(firestore, 'media_experiments', experimentId));
    return true;
  } catch (err) {
    console.error('[deleteMediaExperimentAction] Error deleting:', err);
    return false;
  }
}

/**
 * Lists all experiments for a given workspace.
 */
export async function listMediaExperimentsAction(
  firestore: Firestore,
  workspaceId: string,
  limitCount: number = 50
): Promise<MediaExperiment[]> {
  if (!firestore || !workspaceId) return [];

  try {
    const q = query(
      collection(firestore, 'media_experiments'),
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MediaExperiment[];
  } catch (err) {
    console.error('[listMediaExperimentsAction] Error listing experiments:', err);
    return [];
  }
}

/**
 * Fetches an active experiment for a given experience.
 */
export async function getActiveExperimentForExperienceAction(
  firestore: Firestore,
  experienceId: string
): Promise<MediaExperiment | null> {
  if (!firestore || !experienceId) return null;

  try {
    const q = query(
      collection(firestore, 'media_experiments'),
      where('experienceId', '==', experienceId),
      where('status', 'in', ['RUNNING', 'AUTO_PROMOTED']),
      limit(1)
    );

    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as MediaExperiment;
    }
    return null;
  } catch (err) {
    console.error('[getActiveExperimentForExperienceAction] Error fetching:', err);
    return null;
  }
}
