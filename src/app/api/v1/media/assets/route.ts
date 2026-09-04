/**
 * @fileOverview REST API v1: Media Assets Endpoint
 * Route: GET /api/v1/media/assets, POST /api/v1/media/assets
 *
 * Provides external programmatic access to list and register media assets.
 * Requires `media:read` for GET and `media:write` for POST.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateApiRequest } from '../_utils/auth-rate-limit';
import { dispatchMediaWebhookAction } from '@/lib/media/webhook-service';
import type { MediaAsset } from '@/lib/types/media-2.0';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'media:read');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type');
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const limitCount = Math.min(Math.max(limitParam, 1), 100);

    let q = adminDb
      .collection('media')
      .where('workspaceId', '==', auth!.workspaceId);

    if (typeFilter && ['video', 'audio', 'document', 'interactive', 'image'].includes(typeFilter)) {
      q = q.where('type', '==', typeFilter);
    }

    const snap = await q.orderBy('createdAt', 'desc').limit(limitCount).get();
    const assets = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({
      success: true,
      count: assets.length,
      workspaceId: auth!.workspaceId,
      data: assets,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query media assets.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'media:write');
  if (errorResponse) return errorResponse;

  try {
    const body = (await req.json()) as Partial<MediaAsset>;

    if (!body.name || !body.type || !body.url) {
      return NextResponse.json(
        { success: false, error: 'Asset name, type (video|audio|document|image), and url are required.' },
        { status: 400 }
      );
    }

    const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    const assetData: Partial<MediaAsset> = {
      id: assetId,
      workspaceId: auth!.workspaceId,
      name: body.name.trim(),
      type: body.type,
      url: body.url,
      description: body.description || '',
      category: body.category || 'General',
      durationSeconds: body.durationSeconds || 0,
      viewsCount: 0,
      playsCount: 0,
      completionsCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await adminDb.collection('media').doc(assetId).set(assetData);

    // Trigger outbound webhook event (asynchronous fire-and-forget)
    dispatchMediaWebhookAction(auth!.workspaceId, 'media.asset.created', {
      assetId,
      name: assetData.name,
      type: assetData.type,
      url: assetData.url,
      createdAt: timestamp,
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: 'Media asset created successfully.',
        data: assetData,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create media asset.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
