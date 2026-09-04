/**
 * @fileOverview REST API v1: Recommendations Endpoint
 * Route: POST /api/v1/media/recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateApiRequest } from '../_utils/auth-rate-limit';
import { getNextBestContentAction } from '@/lib/media/recommendation-service';

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

    const recommendations = await getNextBestContentAction(adminDb, auth!.workspaceId, {
      contactId: body.contactId,
      dealStage: body.dealStage,
      currentAssetId: body.currentAssetId,
      limitCount: body.limit || 4,
    });

    return NextResponse.json({
      success: true,
      count: recommendations.length,
      data: recommendations,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Recommendation processing failed.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
