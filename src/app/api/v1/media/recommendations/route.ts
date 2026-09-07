/**
 * @fileOverview REST API v1: Recommendations Endpoint
 * Route: POST /api/v1/media/recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateApiRequest } from '../_utils/auth-rate-limit';
import type { ContentRecommendationItem } from '@/lib/types/media-2.0';
import type { MediaAsset } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'media:read');
  if (errorResponse) return errorResponse;

  try {
    const body = (await req.json()) as {
      contactId?: string;
      dealStage?: string;
      currentAssetId?: string;
      limit?: number;
    };

    const workspaceId = auth!.workspaceId;
    const dealStage = body.dealStage || 'Open';
    const limitCount = body.limit || 4;

    const snap = await adminDb
      .collection('media')
      .where('workspaceIds', 'array-contains', workspaceId)
      .limit(50)
      .get();

    if (snap.empty) {
      return NextResponse.json({ success: true, count: 0, data: [] });
    }

    const candidates: MediaAsset[] = [];
    snap.docs.forEach((d) => {
      const asset = { id: d.id, ...d.data() } as MediaAsset;
      if (asset.id === body.currentAssetId) return;
      candidates.push(asset);
    });

    const stageLower = dealStage.toLowerCase();

    const scored: ContentRecommendationItem[] = candidates.map((asset) => {
      const title = asset.linkTitle || asset.name || 'Media Asset';
      let matchScore = 70;
      let rationale = 'Relevant content for your onboarding pathway.';
      let stageRelevance = 'General Exploration';

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

    const ranked = scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, limitCount);

    return NextResponse.json({
      success: true,
      count: ranked.length,
      data: ranked,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Recommendation processing failed.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
