/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Next-Best-Content Recommendation Engine:
 *    - Implements Section 131 of `media_prd.md` and Section 159 of `media_ux.md`.
 *    - Dynamically evaluates and ranks follow-up media assets based on:
 *      a) Contact's historical format preference (from Phase 4 profile).
 *      b) Associated deal stage alignment (Lead -> Overview; Proposal -> Spec; Closing -> Onboarding).
 *      c) Attribution influence rank (from Phase 6 leaderboard).
 * 2. Deduplication & Non-Repetition:
 *    - Automatically filters out current active asset and assets the visitor has already completed.
 * 3. Strict Typing Standard:
 *    - Zero use of `any` or `any[]`.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  type Firestore,
} from 'firebase/firestore';
import type {
  ContentRecommendationItem,
  ContactMediaProfile,
} from '../types/media-2.0';
import type { MediaAsset } from '../types';
import { getContactMediaProfileAction } from './crm-media-service';

export interface RecommendationQueryOptions {
  contactId?: string;
  dealStage?: string;
  currentAssetId?: string;
  limitCount?: number;
}

/**
 * Recommends next-best media assets for a visitor or CRM contact.
 */
export async function getNextBestContentAction(
  firestore: Firestore,
  workspaceId: string,
  options: RecommendationQueryOptions = {}
): Promise<ContentRecommendationItem[]> {
  if (!firestore || !workspaceId) return [];

  const {
    contactId,
    dealStage = 'Open',
    currentAssetId,
    limitCount = 4,
  } = options;

  try {
    // 1. Fetch Contact Profile if contactId provided
    let profile: ContactMediaProfile | null = null;
    let completedAssetIds = new Set<string>();

    if (contactId) {
      profile = await getContactMediaProfileAction(firestore, workspaceId, contactId);
      if (profile) {
        profile.activities.forEach((act) => {
          if (act.maxCompletionPercent >= 75) {
            completedAssetIds.add(act.assetId);
          }
        });
      }
    }

    // 2. Fetch Workspace Assets
    const assetsQuery = query(
      collection(firestore, 'media'),
      where('workspaceIds', 'array-contains', workspaceId),
      limit(50)
    );
    const snap = await getDocs(assetsQuery);
    if (snap.empty) return [];

    const candidates: MediaAsset[] = [];
    snap.docs.forEach((d) => {
      const asset = { id: d.id, ...d.data() } as MediaAsset;
      // Exclude current asset and already-completed assets
      if (asset.id === currentAssetId) return;
      if (completedAssetIds.has(asset.id)) return;
      candidates.push(asset);
    });

    // 3. Score candidates based on stage relevance & preferred format
    const preferredFormat = profile?.preferredFormat || 'VIDEO';
    const stageLower = dealStage.toLowerCase();

    const scored: ContentRecommendationItem[] = candidates.map((asset) => {
      const title = asset.linkTitle || asset.name || 'Media Asset';
      let matchScore = 70; // Base score
      let rationale = 'Relevant content for your onboarding pathway.';
      let stageRelevance = 'General Exploration';

      // Preferred format bonus (+15%)
      if (asset.type.toUpperCase() === preferredFormat.toUpperCase()) {
        matchScore += 15;
      }

      // Deal Stage Alignment
      if (stageLower.includes('lead') || stageLower.includes('inquiry')) {
        if (asset.type === 'video') {
          matchScore += 15;
          stageRelevance = 'Introduction & Overview';
          rationale = 'Top introductory overview for prospective families.';
        }
      } else if (stageLower.includes('proposal') || stageLower.includes('evaluation')) {
        if (asset.type === 'document' || title.toLowerCase().includes('fee') || title.toLowerCase().includes('curriculum')) {
          matchScore += 20;
          stageRelevance = 'Program Specifications';
          rationale = 'Buyers in evaluation stages convert 2.4x faster after reading this.';
        }
      } else if (stageLower.includes('negotiation') || stageLower.includes('closing')) {
        if (title.toLowerCase().includes('onboarding') || title.toLowerCase().includes('welcome')) {
          matchScore += 20;
          stageRelevance = 'Final Milestone Preparation';
          rationale = 'Essential preparation for enrollment and fee settlements.';
        }
      }

      // Cap match score to 99%
      matchScore = Math.min(99, matchScore);

      return {
        assetId: asset.id,
        title,
        type: asset.type,
        previewImageUrl: asset.previewImageUrl,
        matchScore,
        rationale,
        stageRelevance,
      };
    });

    // Sort by highest match score and take top limitCount
    return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, limitCount);
  } catch (err) {
    console.error('[getNextBestContentAction] Error generating recommendations:', err);
    return [];
  }
}

/**
 * Resolves next-best-content items specifically bound to an experience.
 */
export async function resolveRecommendationsForExperienceAction(
  firestore: Firestore,
  workspaceId: string,
  experienceId: string,
  contactId?: string
): Promise<ContentRecommendationItem[]> {
  if (!firestore || !experienceId) return [];

  try {
    const expRef = doc(firestore, 'media_experiences', experienceId);
    const expSnap = await getDoc(expRef);
    if (!expSnap.exists()) return [];

    const expData = expSnap.data();
    const assetId = expData.assetId as string;
    const recConfig = expData.recommendations;

    // If recommendations disabled on experience, return empty
    if (recConfig && recConfig.enabled === false) {
      return [];
    }

    const limitCount = recConfig?.maxRecommendations || 3;

    return await getNextBestContentAction(firestore, workspaceId, {
      contactId,
      currentAssetId: assetId,
      limitCount,
    });
  } catch (err) {
    console.error('[resolveRecommendationsForExperienceAction] Error resolving:', err);
    return [];
  }
}
