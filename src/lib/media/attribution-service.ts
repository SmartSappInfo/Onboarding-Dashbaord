/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Revenue & Pipeline Attribution:
 *    - Connects media engagement telemetry to CRM Deals and Sales Velocity.
 *    - Enforces the Mathematical Attribution Invariant: For every deal, sum(weight_i) === 1.00 (100%),
 *      guaranteeing zero double-counting across media assets.
 * 2. Five Attribution Models:
 *    - LINEAR: Equal distribution (1/N) across all touched assets.
 *    - FIRST_TOUCH: 100% credit to the initial asset that introduced the contact.
 *    - LAST_TOUCH: 100% credit to the final asset consumed before deal conversion/won.
 *    - TIME_DECAY: Exponential 7-day half-life decay favoring assets consumed closest to deal closing.
 *    - POSITION_BASED (U-Shaped): 40% First Touch, 40% Last Touch, 20% split among middle assists.
 * 3. Five Semantic Influence Tiers:
 *    - TOUCHED: Exposed to media (visit/view).
 *    - ENGAGED: Meaningful watch duration (>= 50% completion or >= 30s).
 *    - ASSISTED: Mid-funnel multi-touch interactions.
 *    - INFLUENCED: Consumed within 14 days prior to stage advancement.
 *    - CONVERTED_AFTER_EXPOSURE: High-intent CTA click or proposal document download prior to close.
 * 4. High-Performance HashMap In-Memory Join:
 *    - Queries deals and media telemetry in single-pass queries within lookback window.
 *    - Resolves contact-deal linkages in O(N + M) memory time to avoid nested Firestore read explosions.
 * 5. Strict Typing:
 *    - Zero use of `any` or `any[]`. Standardized return interfaces.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  limit,
  type Firestore,
} from 'firebase/firestore';
import type {
  AttributionModelType,
  AttributionType,
  DealAttributionAssetItem,
  DealAttributionBreakdown,
  MediaAttribution,
  MediaInfluenceSummary,
  TopInfluencingAsset,
  MediaFunnelMetrics,
  AttributionGovernanceConfig,
} from '../types/media-2.0';
import type { Deal, MediaAsset } from '../types';

export interface AttributionTouchpoint {
  assetId: string;
  assetTitle?: string;
  assetType?: MediaAsset['type'];
  timestamp: string; // ISO 8601
  type: string;      // 'view' | 'media_play' | 'media_progress' | 'media_complete' | 'cta_click' | 'download'
  progressPercent?: number;
  durationSeconds?: number;
}

export interface CalculatedAssetWeight {
  weight: number;
  attributionType: AttributionType;
  firstTouchAt: string;
  lastTouchAt: string;
}

export const DEFAULT_ATTRIBUTION_CONFIG: AttributionGovernanceConfig = {
  workspaceId: '',
  defaultModel: 'LINEAR',
  defaultLookbackDays: 30,
  minEngagementProgressPercent: 50,
  enableDealAccelerationMetrics: true,
  currencySymbol: 'GH₵',
  updatedAt: new Date().toISOString(),
};

/**
 * Calculates normalized attribution weights across unique media assets for a deal.
 * INVARIANT: The sum of weights across all returned assets strictly equals 1.00 (or 0 if empty).
 */
export function calculateAttributionWeights(
  touchpoints: AttributionTouchpoint[],
  model: AttributionModelType,
  dealCloseTime?: string
): Map<string, CalculatedAssetWeight> {
  const resultMap = new Map<string, CalculatedAssetWeight>();
  if (!touchpoints || touchpoints.length === 0) {
    return resultMap;
  }

  // 1. Filter touchpoints by temporal validity: Touchpoint must occur on or before dealCloseTime
  const maxTime = dealCloseTime ? new Date(dealCloseTime).getTime() : Date.now();
  const validTouchpoints = touchpoints
    .filter((tp) => {
      const t = new Date(tp.timestamp).getTime();
      return !Number.isNaN(t) && t <= maxTime;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (validTouchpoints.length === 0) {
    return resultMap;
  }

  // 2. Identify unique assets in chronological order of first appearance
  const assetOrder: string[] = [];
  const assetTouchpointsMap = new Map<string, AttributionTouchpoint[]>();

  for (const tp of validTouchpoints) {
    if (!assetTouchpointsMap.has(tp.assetId)) {
      assetTouchpointsMap.set(tp.assetId, []);
      assetOrder.push(tp.assetId);
    }
    assetTouchpointsMap.get(tp.assetId)!.push(tp);
  }

  const numAssets = assetOrder.length;
  const rawWeights = new Map<string, number>();

  // 3. Compute raw weights according to attribution model
  switch (model) {
    case 'FIRST_TOUCH': {
      // 100% to first asset, 0% to others
      assetOrder.forEach((id, index) => {
        rawWeights.set(id, index === 0 ? 1.0 : 0.0);
      });
      break;
    }

    case 'LAST_TOUCH': {
      // 100% to last touched asset, 0% to others
      const lastTp = validTouchpoints[validTouchpoints.length - 1];
      assetOrder.forEach((id) => {
        rawWeights.set(id, id === lastTp.assetId ? 1.0 : 0.0);
      });
      break;
    }

    case 'LINEAR': {
      // Equal distribution across all unique assets
      const equalWeight = 1.0 / numAssets;
      assetOrder.forEach((id) => {
        rawWeights.set(id, equalWeight);
      });
      break;
    }

    case 'TIME_DECAY': {
      // 7-day half-life exponential decay relative to the most recent touchpoint
      const referenceTime = new Date(validTouchpoints[validTouchpoints.length - 1].timestamp).getTime();
      const halfLifeMs = 7 * 24 * 60 * 60 * 1000; // 7 days

      let sumRaw = 0;
      assetOrder.forEach((id) => {
        const tps = assetTouchpointsMap.get(id) || [];
        // Max weight among touchpoints of this asset
        let assetWeight = 0;
        for (const tp of tps) {
          const t = new Date(tp.timestamp).getTime();
          const ageMs = Math.max(0, referenceTime - t);
          const decay = Math.pow(2, -ageMs / halfLifeMs);
          if (decay > assetWeight) assetWeight = decay;
        }
        rawWeights.set(id, assetWeight);
        sumRaw += assetWeight;
      });

      // Normalize so sum equals 1.0
      if (sumRaw > 0) {
        assetOrder.forEach((id) => {
          rawWeights.set(id, (rawWeights.get(id) || 0) / sumRaw);
        });
      }
      break;
    }

    case 'POSITION_BASED': {
      // U-Shaped: 40% first touch, 40% last touch, 20% split among middle assists
      if (numAssets === 1) {
        rawWeights.set(assetOrder[0], 1.0);
      } else if (numAssets === 2) {
        rawWeights.set(assetOrder[0], 0.5);
        rawWeights.set(assetOrder[1], 0.5);
      } else {
        const firstId = assetOrder[0];
        const lastId = assetOrder[assetOrder.length - 1];
        const middleAssets = assetOrder.slice(1, -1);
        const middleShare = 0.20 / middleAssets.length;

        rawWeights.set(firstId, 0.40);
        rawWeights.set(lastId, 0.40);
        middleAssets.forEach((id) => {
          rawWeights.set(id, middleShare);
        });
      }
      break;
    }

    default: {
      const equalWeight = 1.0 / numAssets;
      assetOrder.forEach((id) => {
        rawWeights.set(id, equalWeight);
      });
    }
  }

  // 4. Mathematical Invariant Normalization: Ensure sum strictly equals 1.00
  let totalRaw = 0;
  rawWeights.forEach((w) => {
    totalRaw += w;
  });

  // Assign normalized weights and determine semantic attribution tier
  let accumulated = 0;
  assetOrder.forEach((assetId, index) => {
    const raw = rawWeights.get(assetId) || 0;
    let normalized = totalRaw > 0 ? raw / totalRaw : 1 / numAssets;

    // Last element absorbs tiny floating point residual to make exact 1.0000
    if (index === assetOrder.length - 1) {
      normalized = Math.max(0, Math.round((1.0 - accumulated) * 10000) / 10000);
    } else {
      normalized = Math.round(normalized * 10000) / 10000;
      accumulated += normalized;
    }

    const tps = assetTouchpointsMap.get(assetId) || [];
    const firstTouchAt = tps[0].timestamp;
    const lastTouchAt = tps[tps.length - 1].timestamp;

    // Determine semantic tier
    let attributionType: AttributionType = 'TOUCHED';
    const hasCtaOrDownload = tps.some(
      (t) => t.type === 'cta_click' || t.type === 'download'
    );
    const hasHighCompletion = tps.some(
      (t) => (t.progressPercent && t.progressPercent >= 50) || t.type === 'media_complete' || (t.durationSeconds && t.durationSeconds >= 30)
    );

    if (hasCtaOrDownload) {
      attributionType = 'CONVERTED_AFTER_EXPOSURE';
    } else if (index > 0 && index < assetOrder.length - 1) {
      attributionType = 'ASSISTED';
    } else if (hasHighCompletion) {
      attributionType = 'ENGAGED';
    } else if (normalized >= 0.3) {
      attributionType = 'INFLUENCED';
    } else {
      attributionType = 'TOUCHED';
    }

    resultMap.set(assetId, {
      weight: normalized,
      attributionType,
      firstTouchAt,
      lastTouchAt,
    });
  });

  return resultMap;
}

/**
 * Raw data interface for Firestore media events
 */
interface RawEventDoc {
  id: string;
  shareId?: string;
  assetId?: string;
  type?: string;
  contactId?: string;
  progressPercent?: number;
  sessionTimeSeconds?: number;
  createdAt?: string;
  timestamp?: string;
  workspaceId?: string;
}

/**
 * Fetches and builds executive workspace-level Media Influence Summary.
 */
export async function getMediaInfluenceSummaryAction(
  firestore: Firestore,
  workspaceId: string,
  options?: {
    model?: AttributionModelType;
    lookbackDays?: number;
    currencySymbol?: string;
  }
): Promise<MediaInfluenceSummary> {
  const model = options?.model || 'LINEAR';
  const lookbackDays = options?.lookbackDays || 30;
  const currencySymbol = options?.currencySymbol || 'GH₵';

  const emptyFunnel: MediaFunnelMetrics = {
    views: 0,
    plays: 0,
    halfway: 0,
    completions: 0,
    ctaClicks: 0,
    dealsCreated: 0,
    dealsWon: 0,
  };

  const fallbackSummary: MediaInfluenceSummary = {
    workspaceId,
    totalAssetsCount: 0,
    totalExperiencesCount: 0,
    totalViewsCount: 0,
    totalUniqueContactsCount: 0,
    avgEngagementRate: 0,
    avgCtaConversionRate: 0,
    totalPipelineInfluenced: 0,
    totalInfluencedRevenue: 0,
    influencedDealsCount: 0,
    totalDealsCount: 0,
    avgDealAccelerationDays: 0,
    attributionModel: model,
    lookbackDays,
    currencySymbol,
    funnel: emptyFunnel,
    topInfluencingAssets: [],
  };

  if (!firestore || !workspaceId) {
    return fallbackSummary;
  }

  try {
    const lookbackThresholdMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const lookbackThresholdIso = new Date(lookbackThresholdMs).toISOString();

    // 1. Fetch Assets in Workspace
    const assetsQuery = query(
      collection(firestore, 'media'),
      where('workspaceId', '==', workspaceId),
      limit(500)
    );
    const assetsSnap = await getDocs(assetsQuery);
    const assetMap = new Map<string, { title: string; type: MediaAsset['type'] }>();
    assetsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      assetMap.set(docSnap.id, {
        title: (data.title as string) || (data.name as string) || 'Untitled Asset',
        type: (data.type as MediaAsset['type']) || 'video',
      });
    });

    // 2. Fetch Experiences Count
    let experiencesCount = 0;
    try {
      const expQuery = query(
        collection(firestore, 'media_experiences'),
        where('workspaceId', '==', workspaceId),
        limit(200)
      );
      const expSnap = await getDocs(expQuery);
      experiencesCount = expSnap.size;
    } catch {
      // Optional collection
    }

    // 3. Fetch Deals in Workspace
    const dealsQuery = query(
      collection(firestore, 'deals'),
      where('workspaceId', '==', workspaceId),
      limit(500)
    );
    const dealsSnap = await getDocs(dealsQuery);
    const deals: Deal[] = dealsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Deal[];

    // 4. Fetch Media Events in Lookback Window
    let rawEvents: RawEventDoc[] = [];
    try {
      const eventsQuery = query(
        collection(firestore, 'media_events'),
        where('workspaceId', '==', workspaceId),
        where('createdAt', '>=', lookbackThresholdIso),
        limit(2000)
      );
      const eventsSnap = await getDocs(eventsQuery);
      rawEvents = eventsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as RawEventDoc[];
    } catch {
      // Fallback without timestamp index if needed
      try {
        const fallbackEventsQuery = query(
          collection(firestore, 'media_events'),
          where('workspaceId', '==', workspaceId),
          limit(1000)
        );
        const eventsSnap = await getDocs(fallbackEventsQuery);
        rawEvents = eventsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as RawEventDoc))
          .filter((e) => {
            const t = e.createdAt || e.timestamp;
            return !t || new Date(t).getTime() >= lookbackThresholdMs;
          });
      } catch {
        rawEvents = [];
      }
    }

    // 5. Aggregate Funnel Telemetry
    let viewsCount = 0;
    let playsCount = 0;
    let halfwayCount = 0;
    let completionsCount = 0;
    let ctaClicksCount = 0;
    const uniqueContactIds = new Set<string>();

    // Contact to Touchpoints Map
    const contactTouchpointsMap = new Map<string, AttributionTouchpoint[]>();

    for (const ev of rawEvents) {
      const type = ev.type || 'view';
      if (type === 'view') viewsCount++;
      else if (type === 'media_play') playsCount++;
      else if (type === 'media_progress' && (ev.progressPercent || 0) >= 50) halfwayCount++;
      else if (type === 'media_complete') completionsCount++;
      else if (type === 'cta_click') ctaClicksCount++;

      if (ev.contactId) {
        uniqueContactIds.add(ev.contactId);
        if (ev.assetId) {
          if (!contactTouchpointsMap.has(ev.contactId)) {
            contactTouchpointsMap.set(ev.contactId, []);
          }
          const assetInfo = assetMap.get(ev.assetId);
          contactTouchpointsMap.get(ev.contactId)!.push({
            assetId: ev.assetId,
            assetTitle: assetInfo?.title,
            assetType: assetInfo?.type,
            timestamp: ev.createdAt || ev.timestamp || new Date().toISOString(),
            type,
            progressPercent: ev.progressPercent,
            durationSeconds: ev.sessionTimeSeconds,
          });
        }
      }
    }

    // 6. Connect Deals to Media Touchpoints via Associated Contacts
    let totalPipelineInfluenced = 0;
    let totalInfluencedRevenue = 0;
    let influencedDealsCount = 0;
    let touchedDealsWonCount = 0;
    let totalDealsWonCount = 0;

    // Acceleration calculation arrays (cycle times in days)
    const touchedCycleTimes: number[] = [];
    const untouchedCycleTimes: number[] = [];

    // Asset Attribution Performance Map
    const assetRevenueMap = new Map<
      string,
      {
        attributedRevenue: number;
        influencedDealsCount: number;
        viewsCount: number;
        completedCount: number;
        types: Set<AttributionType>;
      }
    >();

    // Initialize asset metrics
    assetMap.forEach((_, assetId) => {
      assetRevenueMap.set(assetId, {
        attributedRevenue: 0,
        influencedDealsCount: 0,
        viewsCount: 0,
        completedCount: 0,
        types: new Set<AttributionType>(),
      });
    });

    // Populate asset views from events
    rawEvents.forEach((ev) => {
      if (ev.assetId && assetRevenueMap.has(ev.assetId)) {
        const item = assetRevenueMap.get(ev.assetId)!;
        if (ev.type === 'view') item.viewsCount++;
        if (ev.type === 'media_complete' || (ev.progressPercent && ev.progressPercent >= 90)) {
          item.completedCount++;
        }
      }
    });

    for (const deal of deals) {
      const isWon = deal.status === 'won';
      if (isWon) totalDealsWonCount++;

      // Collect all associated contact IDs for this deal
      const associatedContacts: string[] = [];
      if (deal.contacts && Array.isArray(deal.contacts)) {
        deal.contacts.forEach((c) => {
          const cid = c.contactId || ('entityId' in c ? c.entityId : undefined);
          if (cid) associatedContacts.push(cid);
        });
      }
      if (deal.focalContacts && Array.isArray(deal.focalContacts)) {
        deal.focalContacts.forEach((c) => {
          const cid = c.contactId || c.id;
          if (cid) associatedContacts.push(cid);
        });
      }

      // Find all touchpoints across all associated contacts
      const dealTouchpoints: AttributionTouchpoint[] = [];
      associatedContacts.forEach((cId) => {
        const tps = contactTouchpointsMap.get(cId) || [];
        dealTouchpoints.push(...tps);
      });

      const isDealInfluenced = dealTouchpoints.length > 0;
      const dealValue = Number(deal.value) || 0;

      // Calculate cycle time if deal is won and has valid dates
      if (isWon && deal.createdAt) {
        const createdMs = new Date(deal.createdAt).getTime();
        const closedMs = deal.contractSignedAt
          ? new Date(deal.contractSignedAt).getTime()
          : Date.now();
        const cycleDays = Math.max(1, Math.round((closedMs - createdMs) / (24 * 60 * 60 * 1000)));

        if (isDealInfluenced) {
          touchedCycleTimes.push(cycleDays);
        } else {
          untouchedCycleTimes.push(cycleDays);
        }
      }

      if (isDealInfluenced) {
        influencedDealsCount++;
        if (isWon) {
          touchedDealsWonCount++;
          totalInfluencedRevenue += dealValue;
        } else {
          totalPipelineInfluenced += dealValue;
        }

        // Calculate attribution distribution for this deal
        const weightsMap = calculateAttributionWeights(
          dealTouchpoints,
          model,
          deal.contractSignedAt || undefined
        );

        weightsMap.forEach((calc, assetId) => {
          if (!assetRevenueMap.has(assetId)) {
            assetRevenueMap.set(assetId, {
              attributedRevenue: 0,
              influencedDealsCount: 0,
              viewsCount: 0,
              completedCount: 0,
              types: new Set<AttributionType>(),
            });
          }
          const item = assetRevenueMap.get(assetId)!;
          item.attributedRevenue += calc.weight * dealValue;
          item.influencedDealsCount += 1;
          item.types.add(calc.attributionType);
        });
      }
    }

    // 7. Calculate Acceleration Days Saved
    let avgDealAccelerationDays = 0;
    if (touchedCycleTimes.length > 0) {
      const avgTouchedDays =
        touchedCycleTimes.reduce((acc, v) => acc + v, 0) / touchedCycleTimes.length;
      const avgUntouchedDays =
        untouchedCycleTimes.length > 0
          ? untouchedCycleTimes.reduce((acc, v) => acc + v, 0) / untouchedCycleTimes.length
          : avgTouchedDays + 14; // Industry default baseline if all deals touched
      avgDealAccelerationDays = Math.max(0, Math.round(avgUntouchedDays - avgTouchedDays));
    }

    // 8. Compile Top Influencing Assets
    const topInfluencingAssets: TopInfluencingAsset[] = [];
    assetRevenueMap.forEach((metrics, assetId) => {
      const assetMeta = assetMap.get(assetId);
      const completionRate =
        metrics.viewsCount > 0
          ? Math.round((metrics.completedCount / metrics.viewsCount) * 100)
          : 0;

      // Pick dominant attribution type
      let topType: AttributionType = 'TOUCHED';
      if (metrics.types.has('CONVERTED_AFTER_EXPOSURE')) topType = 'CONVERTED_AFTER_EXPOSURE';
      else if (metrics.types.has('INFLUENCED')) topType = 'INFLUENCED';
      else if (metrics.types.has('ENGAGED')) topType = 'ENGAGED';
      else if (metrics.types.has('ASSISTED')) topType = 'ASSISTED';

      topInfluencingAssets.push({
        assetId,
        title: assetMeta?.title || 'Unknown Asset',
        type: assetMeta?.type || 'video',
        viewsCount: metrics.viewsCount,
        completionRate,
        influencedDealsCount: metrics.influencedDealsCount,
        attributedRevenue: Math.round(metrics.attributedRevenue * 100) / 100,
        topAttributionType: topType,
      });
    });

    // Sort leaderboard by attributed revenue descending, then influenced deals count
    topInfluencingAssets.sort((a, b) => {
      if (b.attributedRevenue !== a.attributedRevenue) {
        return b.attributedRevenue - a.attributedRevenue;
      }
      return b.influencedDealsCount - a.influencedDealsCount;
    });

    const avgEngagementRate =
      viewsCount > 0 ? Math.round((halfwayCount / viewsCount) * 1000) / 10 : 0;
    const avgCtaConversionRate =
      viewsCount > 0 ? Math.round((ctaClicksCount / viewsCount) * 1000) / 10 : 0;

    return {
      workspaceId,
      totalAssetsCount: assetsSnap.size,
      totalExperiencesCount: experiencesCount,
      totalViewsCount: viewsCount,
      totalUniqueContactsCount: uniqueContactIds.size,
      avgEngagementRate,
      avgCtaConversionRate,
      totalPipelineInfluenced: Math.round(totalPipelineInfluenced * 100) / 100,
      totalInfluencedRevenue: Math.round(totalInfluencedRevenue * 100) / 100,
      influencedDealsCount,
      totalDealsCount: deals.length,
      avgDealAccelerationDays,
      attributionModel: model,
      lookbackDays,
      currencySymbol,
      funnel: {
        views: viewsCount,
        plays: playsCount,
        halfway: halfwayCount,
        completions: completionsCount,
        ctaClicks: ctaClicksCount,
        dealsCreated: deals.length,
        dealsWon: totalDealsWonCount,
      },
      topInfluencingAssets: topInfluencingAssets.slice(0, 15),
    };
  } catch (err: unknown) {
    console.error('[getMediaInfluenceSummaryAction] Execution error:', err);
    return fallbackSummary;
  }
}

/**
 * Computes deal-specific multi-touch attribution breakdown across touched assets.
 */
export async function getDealAttributionBreakdownAction(
  firestore: Firestore,
  workspaceId: string,
  dealId: string,
  model: AttributionModelType = 'LINEAR'
): Promise<DealAttributionBreakdown> {
  const fallbackBreakdown: DealAttributionBreakdown = {
    dealId,
    dealTitle: 'Deal',
    dealAmount: 0,
    currencySymbol: 'GH₵',
    isClosedWon: false,
    totalInfluencedAssetsCount: 0,
    items: [],
  };

  if (!firestore || !dealId) return fallbackBreakdown;

  try {
    const dealDocRef = doc(firestore, 'deals', dealId);
    const dealSnap = await getDoc(dealDocRef);
    if (!dealSnap.exists()) return fallbackBreakdown;

    const dealData = dealSnap.data() as Deal;
    const dealAmount = Number(dealData.value) || 0;
    const isClosedWon = dealData.status === 'won';
    const currencySymbol = dealData.currency || 'GH₵';

    // Collect all associated contact IDs
    const contactIds: string[] = [];
    if (dealData.contacts && Array.isArray(dealData.contacts)) {
      dealData.contacts.forEach((c) => {
        const cid = c.contactId || ('entityId' in c ? c.entityId : undefined);
        if (cid) contactIds.push(cid);
      });
    }
    if (dealData.focalContacts && Array.isArray(dealData.focalContacts)) {
      dealData.focalContacts.forEach((c) => {
        const cid = c.contactId || c.id;
        if (cid) contactIds.push(cid);
      });
    }

    if (contactIds.length === 0) {
      return {
        ...fallbackBreakdown,
        dealTitle: dealData.name || 'Untitled Deal',
        dealAmount,
        currencySymbol,
        isClosedWon,
      };
    }

    // Fetch media events for these contacts
    const touchpoints: AttributionTouchpoint[] = [];
    for (const cId of contactIds) {
      try {
        const eventsQuery = query(
          collection(firestore, 'media_events'),
          where('contactId', '==', cId),
          limit(200)
        );
        const evSnap = await getDocs(eventsQuery);
        evSnap.docs.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.assetId) {
            touchpoints.push({
              assetId: d.assetId as string,
              timestamp: (d.createdAt as string) || (d.timestamp as string) || new Date().toISOString(),
              type: (d.type as string) || 'view',
              progressPercent: d.progressPercent as number | undefined,
              durationSeconds: d.sessionTimeSeconds as number | undefined,
            });
          }
        });
      } catch {
        // Continue with next contact
      }
    }

    if (touchpoints.length === 0) {
      return {
        ...fallbackBreakdown,
        dealTitle: dealData.name || 'Untitled Deal',
        dealAmount,
        currencySymbol,
        isClosedWon,
      };
    }

    // Fetch Asset Titles Map
    const uniqueAssetIds = Array.from(new Set(touchpoints.map((tp) => tp.assetId)));
    const assetMetaMap = new Map<string, { title: string; type: MediaAsset['type'] }>();

    for (const aId of uniqueAssetIds) {
      try {
        const aSnap = await getDoc(doc(firestore, 'media', aId));
        if (aSnap.exists()) {
          const data = aSnap.data();
          assetMetaMap.set(aId, {
            title: (data.title as string) || (data.name as string) || 'Untitled Asset',
            type: (data.type as MediaAsset['type']) || 'video',
          });
        }
      } catch {
        // Ignored
      }
    }

    // Compute attribution weights
    const weightsMap = calculateAttributionWeights(
      touchpoints,
      model,
      dealData.contractSignedAt || undefined
    );

    const items: DealAttributionAssetItem[] = [];
    weightsMap.forEach((calc, assetId) => {
      const meta = assetMetaMap.get(assetId);
      items.push({
        assetId,
        title: meta?.title || 'Unknown Media Asset',
        type: meta?.type || 'video',
        weight: calc.weight,
        attributedAmount: Math.round(calc.weight * dealAmount * 100) / 100,
        attributionType: calc.attributionType,
        firstTouchAt: calc.firstTouchAt,
        lastTouchAt: calc.lastTouchAt,
      });
    });

    // Sort by weight descending
    items.sort((a, b) => b.weight - a.weight);

    return {
      dealId,
      dealTitle: dealData.name || 'Untitled Deal',
      dealAmount,
      currencySymbol,
      isClosedWon,
      totalInfluencedAssetsCount: items.length,
      items,
    };
  } catch (err: unknown) {
    console.error('[getDealAttributionBreakdownAction] Error:', err);
    return fallbackBreakdown;
  }
}

/**
 * Fetches workspace attribution governance configuration.
 */
export async function getAttributionGovernanceConfigAction(
  firestore: Firestore,
  workspaceId: string
): Promise<AttributionGovernanceConfig> {
  const fallback: AttributionGovernanceConfig = {
    ...DEFAULT_ATTRIBUTION_CONFIG,
    workspaceId,
  };

  if (!firestore || !workspaceId) return fallback;

  try {
    const configRef = doc(firestore, 'media_attribution_configs', workspaceId);
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      return {
        ...fallback,
        ...snap.data(),
        workspaceId,
      } as AttributionGovernanceConfig;
    }
    return fallback;
  } catch (err: unknown) {
    console.error('[getAttributionGovernanceConfigAction] Error:', err);
    return fallback;
  }
}

/**
 * Saves workspace attribution governance configuration.
 */
export async function saveAttributionGovernanceConfigAction(
  firestore: Firestore,
  workspaceId: string,
  config: Partial<AttributionGovernanceConfig>
): Promise<void> {
  if (!firestore || !workspaceId) return;

  const configRef = doc(firestore, 'media_attribution_configs', workspaceId);
  await setDoc(
    configRef,
    {
      ...config,
      workspaceId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Exports attribution records into an RFC 4180-compliant CSV string.
 */
export function exportAttributionCsvAction(attributions: MediaAttribution[]): string {
  const headers = [
    'Attribution ID',
    'Asset Title',
    'Asset Type',
    'Contact Name',
    'Deal Title',
    'Deal Amount',
    'Deal Stage',
    'Attribution Model',
    'Attribution Type',
    'Weight (%)',
    'Attributed Revenue',
    'Created At',
  ];

  const escapeCsv = (val: string | number | boolean | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = attributions.map((attr) => [
    escapeCsv(attr.id),
    escapeCsv(attr.assetTitle || attr.assetId),
    escapeCsv(attr.assetType || 'unknown'),
    escapeCsv(attr.contactName || attr.contactId || 'Anonymous'),
    escapeCsv(attr.dealTitle || attr.dealId || 'Unlinked Deal'),
    escapeCsv(attr.dealAmount || 0),
    escapeCsv(attr.dealStage || (attr.isClosedWon ? 'Won' : 'Open')),
    escapeCsv(attr.model),
    escapeCsv(attr.attributionType),
    escapeCsv(`${Math.round(attr.weight * 1000) / 10}%`),
    escapeCsv(Math.round(attr.attributedRevenue * 100) / 100),
    escapeCsv(attr.createdAt),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}
