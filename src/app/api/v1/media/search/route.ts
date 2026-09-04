/**
 * @fileOverview REST API v1: Semantic Search Endpoint
 * Route: POST /api/v1/media/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '../_utils/auth-rate-limit';
import { searchMediaSemanticallyAction } from '@/lib/media/content-intelligence-service';

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'media:read');
  if (errorResponse) return errorResponse;

  try {
    const body = (await req.json()) as { query?: string; assetId?: string; limit?: number };
    if (!body.query || !body.query.trim()) {
      return NextResponse.json({ success: false, error: 'Search query string is required.' }, { status: 400 });
    }

    const searchRes = await searchMediaSemanticallyAction(auth!.workspaceId, body.query.trim(), {
      assetId: body.assetId,
      limit: body.limit || 10,
    });

    if (!searchRes.success) {
      return NextResponse.json({ success: false, error: searchRes.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      query: body.query,
      count: searchRes.hits?.length || 0,
      data: searchRes.hits || [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Search processing failed.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
