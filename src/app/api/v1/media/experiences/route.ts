/**
 * @fileOverview REST API v1: Media Experiences Endpoint
 * Route: GET /api/v1/media/experiences
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateApiRequest } from '../_utils/auth-rate-limit';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'media:read');
  if (errorResponse) return errorResponse;

  try {
    const snap = await adminDb
      .collection('media_experiences')
      .where('workspaceId', '==', auth!.workspaceId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const experiences = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({
      success: true,
      count: experiences.length,
      data: experiences,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query experiences.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
