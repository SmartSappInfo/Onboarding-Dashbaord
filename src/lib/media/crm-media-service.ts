/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for CRM Media Intelligence:
 *    Aggregates media session and event activity into contact-level and deal-level engagement profiles.
 * 2. Engagement Score Formula:
 *    Score (0 - 100) = (0.20 * Views [max 20pt]) + (0.40 * AvgCompletion% [max 40pt]) + (0.30 * CTAClicks [max 30pt]) + (0.10 * Downloads [max 10pt]).
 * 3. Self-Healing & Strict Typing:
 *    Zero use of `any` or `any[]`. Standardized return values even when event history is empty.
 */

import { collection, query, where, getDocs, orderBy, type Firestore } from 'firebase/firestore';
import type { 
  ContactMediaProfile, DealMediaSignals, MediaEngagementMetrics, 
  MediaActivitySummary 
} from '../types/media-2.0';
import type { MediaAsset } from '../types';

interface RawMediaEventData {
  id: string;
  shareId: string;
  assetId: string;
  type: 'view' | 'cta_click' | 'download' | 'media_play' | 'media_progress' | 'media_complete';
  contactId?: string;
  progressPercent?: number;
  sessionTimeSeconds?: number;
  createdAt?: string;
  timestamp?: string;
}

interface RawMediaShareData {
  id: string;
  title?: string;
  assetId?: string;
}

/**
 * Calculates a 0-100 normalized media engagement score.
 */
export function calculateMediaEngagementScore(
  totalViews: number,
  avgCompletionPercent: number,
  totalCtaClicks: number,
  totalDownloads: number
): number {
  const viewScore = Math.min(20, totalViews * 5);
  const completionScore = (Math.min(100, Math.max(0, avgCompletionPercent)) / 100) * 40;
  const ctaScore = Math.min(30, totalCtaClicks * 15);
  const downloadScore = Math.min(10, totalDownloads * 10);

  const rawScore = viewScore + completionScore + ctaScore + downloadScore;
  return Math.min(100, Math.round(rawScore));
}

/**
 * Fetches and compiles the ContactMediaProfile for a contact.
 */
export async function getContactMediaProfileAction(
  firestore: Firestore,
  workspaceId: string,
  contactId: string
): Promise<ContactMediaProfile> {
  const emptyMetrics: MediaEngagementMetrics = {
    totalViews: 0,
    totalSessions: 0,
    totalTimeSeconds: 0,
    avgCompletionPercent: 0,
    totalCtaClicks: 0,
    totalDownloads: 0,
    overallScore: 0,
  };

  const fallbackProfile: ContactMediaProfile = {
    contactId,
    workspaceId,
    metrics: emptyMetrics,
    activities: [],
    preferredFormat: 'balanced',
    highIntentSignalsCount: 0,
  };

  if (!firestore || !contactId) return fallbackProfile;

  try {
    const eventsQuery = query(
      collection(firestore, 'media_events'),
      where('contactId', '==', contactId),
      orderBy('createdAt', 'desc')
    );

    const snap = await getDocs(eventsQuery);
    if (snap.empty) return fallbackProfile;

    const events: RawMediaEventData[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as RawMediaEventData[];

    // Fetch share titles map for quick naming
    const shareIds = Array.from(new Set(events.map((e) => e.shareId).filter(Boolean)));
    const sharesMap: Record<string, { title: string; assetId: string }> = {};

    for (let i = 0; i < shareIds.length; i += 10) {
      const batch = shareIds.slice(i, i + 10);
      if (batch.length === 0) continue;
      const sharesQuery = query(collection(firestore, 'media_shares'), where('__name__', 'in', batch));
      const sharesSnap = await getDocs(sharesQuery);
      sharesSnap.forEach((sd) => {
        const sData = sd.data() as RawMediaShareData;
        sharesMap[sd.id] = {
          title: sData.title || 'Shared Media Page',
          assetId: sData.assetId || '',
        };
      });
    }

    // Group activity by shareId
    const activityMap: Record<string, MediaActivitySummary> = {};
    let totalViews = 0;
    let totalCtaClicks = 0;
    let totalDownloads = 0;
    let totalTimeSeconds = 0;
    const completionPercents: number[] = [];
    const mediaTypeCounts: Record<MediaAsset['type'], number> = {
      video: 0,
      audio: 0,
      image: 0,
      document: 0,
      link: 0,
    };
    let highIntentSignalsCount = 0;

    events.forEach((ev) => {
      const sId = ev.shareId || 'unknown';
      const createdStr = ev.createdAt || ev.timestamp || new Date().toISOString();
      const shareMeta = sharesMap[sId] || { title: 'Shared Media', assetId: ev.assetId || '' };

      if (!activityMap[sId]) {
        activityMap[sId] = {
          shareId: sId,
          assetId: shareMeta.assetId,
          assetTitle: shareMeta.title,
          mediaType: 'video',
          viewCount: 0,
          totalDurationSeconds: 0,
          watchedDurationSeconds: 0,
          maxCompletionPercent: 0,
          ctaClickedCount: 0,
          downloadCount: 0,
          firstSeenAt: createdStr,
          lastSeenAt: createdStr,
        };
      }

      const act = activityMap[sId];
      if (new Date(createdStr) < new Date(act.firstSeenAt)) act.firstSeenAt = createdStr;
      if (new Date(createdStr) > new Date(act.lastSeenAt)) act.lastSeenAt = createdStr;

      if (ev.type === 'view') {
        act.viewCount += 1;
        totalViews += 1;
      } else if (ev.type === 'cta_click') {
        act.ctaClickedCount += 1;
        totalCtaClicks += 1;
        highIntentSignalsCount += 1;
      } else if (ev.type === 'download') {
        act.downloadCount += 1;
        totalDownloads += 1;
      } else if (ev.type === 'media_progress' && typeof ev.progressPercent === 'number') {
        if (ev.progressPercent > act.maxCompletionPercent) {
          act.maxCompletionPercent = ev.progressPercent;
        }
        completionPercents.push(ev.progressPercent);
        if (ev.progressPercent >= 75) highIntentSignalsCount += 1;
      }

      if (typeof ev.sessionTimeSeconds === 'number' && ev.sessionTimeSeconds > act.watchedDurationSeconds) {
        totalTimeSeconds += ev.sessionTimeSeconds - act.watchedDurationSeconds;
        act.watchedDurationSeconds = ev.sessionTimeSeconds;
      }
    });

    const activities = Object.values(activityMap);
    const avgCompletionPercent = completionPercents.length > 0
      ? Math.round(completionPercents.reduce((a, b) => a + b, 0) / completionPercents.length)
      : 0;

    const overallScore = calculateMediaEngagementScore(
      totalViews,
      avgCompletionPercent,
      totalCtaClicks,
      totalDownloads
    );

    // Preferred media format determination
    let preferredFormat: MediaAsset['type'] | 'balanced' = 'balanced';
    let maxTypeCount = 0;
    (Object.keys(mediaTypeCounts) as MediaAsset['type'][]).forEach((t) => {
      if (mediaTypeCounts[t] > maxTypeCount) {
        maxTypeCount = mediaTypeCounts[t];
        preferredFormat = t;
      }
    });

    const metrics: MediaEngagementMetrics = {
      totalViews,
      totalSessions: activities.length,
      totalTimeSeconds,
      avgCompletionPercent,
      totalCtaClicks,
      totalDownloads,
      overallScore,
    };

    return {
      contactId,
      workspaceId,
      metrics,
      activities,
      preferredFormat,
      highIntentSignalsCount,
      lastActiveAt: activities.length > 0 ? activities[0].lastSeenAt : undefined,
    };
  } catch (err: unknown) {
    console.error('[getContactMediaProfileAction] Error fetching profile:', err);
    return fallbackProfile;
  }
}

/**
 * Fetches deal-level media intelligence signals across all linked deal contacts.
 */
export async function getDealMediaSignalsAction(
  firestore: Firestore,
  workspaceId: string,
  dealId: string,
  associatedContactIds: string[]
): Promise<DealMediaSignals> {
  const fallbackSignals: DealMediaSignals = {
    dealId,
    workspaceId,
    combinedEngagementScore: 0,
    associatedContactsCount: associatedContactIds.length,
    stakeholdersWithActivityCount: 0,
    hasHighIntentProposalViews: false,
    hasCompletedVideoViews: false,
    hasCtaInteractions: false,
    suggestedHealthMultiplier: 1.0,
  };

  if (!firestore || !associatedContactIds || associatedContactIds.length === 0) {
    return fallbackSignals;
  }

  try {
    let combinedScore = 0;
    let activeStakeholdersCount = 0;
    let hasHighIntentProposalViews = false;
    let hasCompletedVideoViews = false;
    let hasCtaInteractions = false;
    let topEngagedAssetTitle: string | undefined;

    for (const cId of associatedContactIds) {
      const prof = await getContactMediaProfileAction(firestore, workspaceId, cId);
      if (prof.metrics.totalViews > 0) {
        activeStakeholdersCount += 1;
        combinedScore += prof.metrics.overallScore;
      }
      if (prof.metrics.totalCtaClicks > 0) hasCtaInteractions = true;
      if (prof.metrics.avgCompletionPercent >= 75) hasCompletedVideoViews = true;
      if (prof.activities.some((a) => a.assetTitle.toLowerCase().includes('proposal') || a.assetTitle.toLowerCase().includes('pricing'))) {
        hasHighIntentProposalViews = true;
        topEngagedAssetTitle = prof.activities[0]?.assetTitle;
      }
    }

    const avgScore = activeStakeholdersCount > 0 ? Math.round(combinedScore / activeStakeholdersCount) : 0;
    
    // Calculate health multiplier
    let multiplier = 1.0;
    if (hasHighIntentProposalViews) multiplier += 0.15;
    if (hasCtaInteractions) multiplier += 0.10;
    if (hasCompletedVideoViews) multiplier += 0.05;

    return {
      dealId,
      workspaceId,
      combinedEngagementScore: avgScore,
      associatedContactsCount: associatedContactIds.length,
      stakeholdersWithActivityCount: activeStakeholdersCount,
      topEngagedAssetTitle,
      hasHighIntentProposalViews,
      hasCompletedVideoViews,
      hasCtaInteractions,
      suggestedHealthMultiplier: Number(multiplier.toFixed(2)),
    };
  } catch (err: unknown) {
    console.error('[getDealMediaSignalsAction] Error computing deal signals:', err);
    return fallbackSignals;
  }
}
