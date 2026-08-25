import { NextRequest, NextResponse } from 'next/server';
import { ingestDocumentEvent, IngestEventPayload } from '@/lib/documents/event-collector';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Document Telemetry Ingestion Route Handler:
 *    Handles high-concurrency POST requests for document events from public readers.
 * 2. Next.js 16 Route Handler Standards:
 *    Uses native `NextRequest` and `NextResponse` with strict payload parsing and standard HTTP status codes.
 * 3. Security & Validation:
 *    All payloads are strictly validated before committing to Firestore to prevent injection or malformed data.
 * 4. Strict Typing:
 *    Zero `any` or `any[]` types are permitted.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 32768) {
      return NextResponse.json({ success: false, error: 'Payload exceeds size limit (32KB)' }, { status: 413 });
    }

    const body = await request.json() as unknown;

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON request body' }, { status: 400 });
    }

    const payload = body as IngestEventPayload;
    if (!payload.workspaceId || !payload.documentId || !payload.eventType) {
      return NextResponse.json({ success: false, error: 'Missing required event fields (workspaceId, documentId, eventType)' }, { status: 400 });
    }

    const result = await ingestDocumentEvent(payload);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, eventId: result.eventId }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error processing event';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
