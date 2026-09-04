/**
 * @fileOverview REST API v1: Single Media Asset Endpoint
 * Route: GET /api/v1/media/assets/[assetId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateApiRequest } from '../../_utils/auth-rate-limit';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'media:read');
  if (errorResponse) return errorResponse;

  try {
    const { assetId } = await context.params;
    if (!assetId) {
      return NextResponse.json({ success: false, error: 'Asset ID is required.' }, { status: 400 });
    }

    const snap = await adminDb.collection('media').doc(assetId).get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Asset not found.' }, { status: 404 });
    }

    const data = snap.data();
    if (data?.workspaceId !== auth!.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: asset belongs to different workspace.' }, { status: 403 });
    }

    // Fetch versions subcollection
    const versionsSnap = await adminDb
      .collection('media_versions')
      .where('assetId', '==', assetId)
      .orderBy('createdAt', 'desc')
      .get();

    const versions = versionsSnap.docs.map((d) => d.data());

    return NextResponse.json({
      success: true,
      data: {
        id: snap.id,
        ...data,
        versions,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query asset details.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
