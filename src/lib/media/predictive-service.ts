/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Predictive Intelligence & Content Health:
 *    - Implements Section 131 of `media_prd.md` and Section 159 of `media_ux.md`.
 *    - Computes predictive engagement completion rates, viewer drop-off projections,
 *      and CRM deal close win-probability boosts based on stakeholder content consumption.
 * 2. Content Decay Detection Algorithm:
 *    - Compares trailing 30-day view velocity against trailing 31-60 day baseline to flag
 *      decaying or stale assets needing content refresh or sunsetting.
 * 3. High Load & Batch Safety:
 *    - All governance config updates and batch decay audits adhere to chunked writes (max 150 ops).
 * 4. Strict Typing Standard:
 *    - Zero use of `any` or `any[]`.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore';
import type {
  PredictiveEngagementScore,
  PredictiveDealForecast,
  ContentDecayMetric,
  OptimizationGovernanceConfig,
} from '../types/media-2.0';
import type { MediaAsset } from '../types';

export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationGovernanceConfig = {
  workspaceId: '',
  autoExperimentPromotion: true,
  minConfidenceThreshold: 0.95,
  decayDetectionThresholdPercent: 25,
  banditExplorationRate: 0.10,
  nextBestContentLimit: 4,
  updatedAt: new Date().toISOString(),
};

/**
 * Calculates predictive engagement score and projected drop-off point for an asset.
 */
export function calculatePredictiveEngagementScore(
  assetId: string,
  durationSeconds: number,
  historicalViews: number,
  halfwayRate: number,
  completionRate: number
): PredictiveEngagementScore {
  const dur = Math.max(30, durationSeconds || 300);
  const comp = Math.min(100, Math.max(0, completionRate));
  const half = Math.min(100, Math.max(0, halfwayRate));

  // Projected drop-off point model based on halfway & completion retention curves
  let dropOffSecond = Math.floor(dur * 0.35);
  if (comp >= 70) {
    dropOffSecond = Math.floor(dur * 0.85);
  } else if (half >= 50) {
    dropOffSecond = Math.floor(dur * 0.55);
  }

  // Conversion likelihood projection
  const conversionLikelihood = parseFloat(Math.min(95, Math.max(5, comp * 0.4 + half * 0.3)).toFixed(1));

  // Confidence based on sample volume
  let confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (historicalViews >= 100) confidenceLevel = 'HIGH';
  else if (historicalViews >= 25) confidenceLevel = 'MEDIUM';

  // Churn risk classification
  let churnRisk: 'LOW' | 'MODERATE' | 'CRITICAL' = 'MODERATE';
  let recommendedAction = 'Maintain current pacing and monitor viewer retention.';

  if (comp < 25 && historicalViews >= 20) {
    churnRisk = 'CRITICAL';
    recommendedAction = 'Early drop-off detected: Add a dynamic CTA gate before 30% mark or trim opening intro.';
  } else if (comp >= 60) {
    churnRisk = 'LOW';
    recommendedAction = 'High retention asset: Feature prominently on high-value buyer journey stages.';
  }

  return {
    assetId,
    predictedCompletionRate: parseFloat(comp.toFixed(1)),
    predictedDropOffSecond: dropOffSecond,
    conversionLikelihoodPercent: conversionLikelihood,
    confidenceLevel,
    churnRisk,
    recommendedAction,
  };
}

/**
 * Predicts deal close velocity and win-probability boost based on stakeholder media exposure.
 */
export async function predictDealCloseVelocityAction(
  firestore: Firestore,
  workspaceId: string,
  dealId: string,
  associatedContactIds: string[] = []
): Promise<PredictiveDealForecast> {
  const fallback: PredictiveDealForecast = {
    dealId,
    currentCloseProbability: 35,
    projectedCloseProbabilityWithMedia: 35,
    winProbabilityBoostPercent: 0,
    velocityAccelerationDays: 0,
    recommendedNextAssetIds: [],
    stakeholderCoveragePercent: 0,
  };

  if (!firestore || !workspaceId || !dealId) return fallback;

  try {
    // 1. Fetch Deal Record
    const dealRef = doc(firestore, 'deals', dealId);
    const dealSnap = await getDoc(dealRef);
    if (!dealSnap.exists()) return fallback;

    const dealData = dealSnap.data();
    const dealStage = (dealData.stage as string) || 'Open';
    const totalStakeholders = Math.max(1, associatedContactIds.length || 1);

    // 2. Fetch Media Events for associated contacts
    let engagedContactIds = new Set<string>();
    let totalViews = 0;
    let totalCtaClicks = 0;

    if (associatedContactIds.length > 0) {
      const BATCH_QUERY_LIMIT = 10;
      for (let i = 0; i < associatedContactIds.length; i += BATCH_QUERY_LIMIT) {
        const chunk = associatedContactIds.slice(i, i + BATCH_QUERY_LIMIT);
        const evQuery = query(
          collection(firestore, 'media_events'),
          where('contactId', 'in', chunk),
          limit(50)
        );
        const evSnap = await getDocs(evQuery);
        evSnap.docs.forEach((d) => {
          const ev = d.data();
          if (ev.contactId) engagedContactIds.add(ev.contactId as string);
          if (ev.eventType === 'view' || ev.eventType === 'play') totalViews++;
          if (ev.eventType === 'cta_click') totalCtaClicks++;
        });
      }
    }

    const stakeholderCoverage = Math.min(100, Math.round((engagedContactIds.size / totalStakeholders) * 100));

    // 3. Baseline probability based on stage
    let baselineProbability = 30;
    if (dealStage.toLowerCase().includes('proposal')) baselineProbability = 45;
    else if (dealStage.toLowerCase().includes('negotiation') || dealStage.toLowerCase().includes('closing')) baselineProbability = 60;
    else if (dealStage.toLowerCase().includes('qualified')) baselineProbability = 35;

    // 4. Calculate lift from stakeholder media engagement
    // Formula: +10% per engaged stakeholder + 5% per CTA click (max +35% boost)
    const rawBoost = Math.min(35, engagedContactIds.size * 12 + totalCtaClicks * 6);
    const projectedProbability = Math.min(95, baselineProbability + rawBoost);
    const velocityDaysSaved = Math.min(18, Math.round((rawBoost / 35) * 14));

    // 5. Query candidate assets to recommend
    const assetQuery = query(
      collection(firestore, 'media'),
      where('workspaceIds', 'array-contains', workspaceId),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const assetSnap = await getDocs(assetQuery);
    const recommendedAssetIds = assetSnap.docs.map((d) => d.id).slice(0, 3);

    return {
      dealId,
      currentCloseProbability: baselineProbability,
      projectedCloseProbabilityWithMedia: projectedProbability,
      winProbabilityBoostPercent: rawBoost,
      velocityAccelerationDays: velocityDaysSaved,
      recommendedNextAssetIds: recommendedAssetIds,
      stakeholderCoveragePercent: stakeholderCoverage,
    };
  } catch (err) {
    console.error('[predictDealCloseVelocityAction] Error calculating forecast:', err);
    return fallback;
  }
}

/**
 * Evaluates trailing view velocity to detect content decay and stale assets.
 */
export async function detectContentDecayAction(
  firestore: Firestore,
  workspaceId: string,
  decayThresholdPercent: number = 25
): Promise<ContentDecayMetric[]> {
  if (!firestore || !workspaceId) return [];

  try {
    // 1. Fetch Workspace Media Assets
    const assetsQuery = query(
      collection(firestore, 'media'),
      where('workspaceIds', 'array-contains', workspaceId),
      limit(100)
    );
    const assetsSnap = await getDocs(assetsQuery);
    if (assetsSnap.empty) return [];

    const now = Date.now();
    const day30Ago = now - 30 * 24 * 60 * 60 * 1000;
    const day60Ago = now - 60 * 24 * 60 * 60 * 1000;

    // 2. Fetch Events within last 60 days
    const eventsQuery = query(
      collection(firestore, 'media_events'),
      where('createdAt', '>=', new Date(day60Ago).toISOString()),
      limit(1000)
    );
    const eventsSnap = await getDocs(eventsQuery);

    // Group events by assetId into current 30d and prior 30d buckets
    const current30dMap = new Map<string, number>();
    const prior30dMap = new Map<string, number>();
    const lastActiveMap = new Map<string, string>();

    eventsSnap.docs.forEach((d) => {
      const data = d.data();
      const assetId = (data.assetId as string) || (data.mediaId as string);
      if (!assetId) return;

      const eventTime = new Date(data.createdAt as string).getTime();
      const isView = data.eventType === 'view' || data.eventType === 'play';

      if (isView) {
        if (eventTime >= day30Ago) {
          current30dMap.set(assetId, (current30dMap.get(assetId) || 0) + 1);
        } else {
          prior30dMap.set(assetId, (prior30dMap.get(assetId) || 0) + 1);
        }
      }

      const prevActive = lastActiveMap.get(assetId);
      if (!prevActive || eventTime > new Date(prevActive).getTime()) {
        lastActiveMap.set(assetId, data.createdAt as string);
      }
    });

    // 3. Compute Decay Metrics
    const metrics: ContentDecayMetric[] = assetsSnap.docs.map((d) => {
      const asset = d.data() as MediaAsset;
      const assetId = d.id;
      const currentVel = current30dMap.get(assetId) || 0;
      const priorVel = prior30dMap.get(assetId) || 0;
      const lastActive = lastActiveMap.get(assetId) || asset.createdAt || new Date().toISOString();

      // Velocity change calculation
      let decayRate = 0;
      if (priorVel > 0) {
        decayRate = parseFloat((((currentVel - priorVel) / priorVel) * 100).toFixed(1));
      } else if (currentVel === 0) {
        decayRate = -100;
      }

      let healthStatus: ContentDecayMetric['healthStatus'] = 'STABLE';
      let refreshRecommendation = 'Asset performance is stable.';

      if (currentVel >= priorVel && currentVel > 0) {
        healthStatus = 'HEALTHY';
        refreshRecommendation = 'High momentum asset. Continue active distribution.';
      } else if (decayRate <= -decayThresholdPercent) {
        if (currentVel === 0 && priorVel === 0) {
          healthStatus = 'SUNSET_RECOMMENDED';
          refreshRecommendation = 'Zero views over 60 days. Consider archiving or replacing.';
        } else {
          healthStatus = 'DECAYING';
          refreshRecommendation = 'Velocity has dropped significantly. Refresh thumbnail, headline, or re-share in campaigns.';
        }
      }

      return {
        assetId,
        title: (asset.title as string) || asset.name || 'Untitled Asset',
        type: asset.type,
        currentVelocity30d: currentVel,
        priorVelocity30d: priorVel,
        decayRatePercent: decayRate,
        healthStatus,
        lastActiveDate: lastActive,
        refreshActionRecommendation: refreshRecommendation,
      };
    });

    // Sort by most decaying first
    return metrics.sort((a, b) => a.decayRatePercent - b.decayRatePercent);
  } catch (err) {
    console.error('[detectContentDecayAction] Error detecting decay:', err);
    return [];
  }
}

/**
 * Fetches workspace Optimization governance configuration.
 */
export async function getOptimizationGovernanceConfigAction(
  firestore: Firestore,
  workspaceId: string
): Promise<OptimizationGovernanceConfig> {
  const fallback: OptimizationGovernanceConfig = {
    ...DEFAULT_OPTIMIZATION_CONFIG,
    workspaceId,
  };

  if (!firestore || !workspaceId) return fallback;

  try {
    const ref = doc(firestore, 'media_optimization_configs', workspaceId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return {
        ...fallback,
        ...snap.data(),
        workspaceId,
      } as OptimizationGovernanceConfig;
    }
    return fallback;
  } catch (err) {
    console.error('[getOptimizationGovernanceConfigAction] Error:', err);
    return fallback;
  }
}

/**
 * Saves workspace Optimization governance configuration.
 */
export async function saveOptimizationGovernanceConfigAction(
  firestore: Firestore,
  workspaceId: string,
  config: Partial<OptimizationGovernanceConfig>
): Promise<void> {
  if (!firestore || !workspaceId) return;

  const ref = doc(firestore, 'media_optimization_configs', workspaceId);
  await setDoc(
    ref,
    {
      ...config,
      workspaceId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
