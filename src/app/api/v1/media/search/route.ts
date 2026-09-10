/**
 * @fileOverview REST API v1: Semantic Search Endpoint
 * Route: POST /api/v1/media/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateApiRequest } from '../_utils/auth-rate-limit';
import type { MediaTranscript, SemanticSearchHit } from '@/lib/types/media-2.0';

export async function POST(req: NextRequest) {
  const { auth: _auth, errorResponse } = await authenticateApiRequest(req, 'media:read');
  if (errorResponse) return errorResponse;

  try {
    const body = (await req.json()) as { query?: string; assetId?: string; limit?: number };
    if (!body.query || !body.query.trim()) {
      return NextResponse.json({ success: false, error: 'Search query string is required.' }, { status: 400 });
    }

    const searchQuery = body.query.trim();
    const queryTokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const limitCount = body.limit || 10;

    const snap = await adminDb.collection('media_transcripts').get();
    const hits: SemanticSearchHit[] = [];

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data() as MediaTranscript;
      if (body.assetId && data.assetId !== body.assetId) return;

      data.cues?.forEach((cue) => {
        const cueLower = cue.text.toLowerCase();
        const matchedTokens = queryTokens.filter((token) => cueLower.includes(token));

        if (matchedTokens.length > 0) {
          const relevanceScore = Number(
            Math.min(
              0.99,
              (matchedTokens.length / queryTokens.length) * 0.85 +
                (cueLower.includes(searchQuery.toLowerCase()) ? 0.14 : 0.05)
            ).toFixed(2)
          );

          hits.push({
            assetId: data.assetId,
            assetName: `Media Asset (${data.assetId.slice(0, 8)})`,
            mediaType: 'video',
            cueText: cue.text,
            startTime: cue.startTime,
            relevanceScore,
            jumpUrl: `/m/${data.assetId}?t=${cue.startTime}`,
          });
        }
      });
    });

    const rankedHits = hits.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limitCount);

    return NextResponse.json({
      success: true,
      query: body.query,
      count: rankedHits.length,
      data: rankedHits,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Search processing failed.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
