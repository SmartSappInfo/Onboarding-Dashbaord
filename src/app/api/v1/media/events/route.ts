/**
 * @fileOverview REST API v1: Media Telemetry Ingestion Endpoint
 * Route: POST /api/v1/media/events
 *
 * Ingests external playback telemetry events (view, progress, cta_click, complete)
 * and dispatches corresponding outbound webhooks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateApiRequest } from '../_utils/auth-rate-limit';
import { dispatchMediaWebhookAction } from '@/lib/media/webhook-service';

export interface ExternalEventPayload {
  assetId: string;
  eventType: 'view' | 'play' | 'progress' | 'complete' | 'cta_click' | 'download';
  contactId?: string;
  sessionId?: string;
  progressPercent?: number;
  durationSeconds?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'media:write');
  if (errorResponse) return errorResponse;

  try {
    const body = (await req.json()) as ExternalEventPayload;

    if (!body.assetId || !body.eventType) {
      return NextResponse.json(
        { success: false, error: 'Asset ID and eventType (view|play|progress|complete|cta_click) are required.' },
        { status: 400 }
      );
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = body.timestamp || new Date().toISOString();

    const eventRecord = {
      id: eventId,
      workspaceId: auth!.workspaceId,
      assetId: body.assetId,
      eventType: body.eventType,
      contactId: body.contactId || null,
      sessionId: body.sessionId || null,
      progressPercent: body.progressPercent || 0,
      durationSeconds: body.durationSeconds || 0,
      source: 'external_api',
      timestamp,
      metadata: body.metadata || {},
    };

    // Save event asynchronously
    await adminDb.collection('media_page_events').doc(eventId).set(eventRecord);

    // Trigger matching webhook event if relevant
    if (body.eventType === 'complete') {
      dispatchMediaWebhookAction(auth!.workspaceId, 'media.session.completed', {
        assetId: body.assetId,
        contactId: body.contactId,
        timestamp,
      }).catch(() => {});
    } else if (body.eventType === 'cta_click') {
      dispatchMediaWebhookAction(auth!.workspaceId, 'media.cta.clicked', {
        assetId: body.assetId,
        contactId: body.contactId,
        timestamp,
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        eventId,
        message: 'Telemetry event ingested successfully.',
      },
      { status: 202 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Telemetry event ingestion failed.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
