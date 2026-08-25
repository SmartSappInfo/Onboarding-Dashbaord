import { NextRequest, NextResponse } from 'next/server';
import { queueDocumentProcessingAction, QueueProcessingJobPayload } from '@/lib/documents/processing-actions';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Document Processing Ingestion Route Handler:
 *    Receives asynchronous processing initiation requests from the Document Studio and client uploaders.
 * 2. Next.js 16 Route Handler Standards:
 *    Uses native `NextRequest` and `NextResponse` with explicit validation and HTTP response codes.
 * 3. Security & Validation:
 *    Validates payload integrity and checks for malicious payload sizes.
 * 4. Strict Typing:
 *    Zero `any` or `any[]` types are permitted.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 32768) {
      return NextResponse.json({ success: false, error: 'Payload exceeds maximum limit (32KB)' }, { status: 413 });
    }

    const body = await request.json() as unknown;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON request body' }, { status: 400 });
    }

    const payload = body as QueueProcessingJobPayload;
    if (!payload.workspaceId || !payload.documentId || !payload.versionId || !payload.sourceUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields (workspaceId, documentId, versionId, sourceUrl)' },
        { status: 400 }
      );
    }

    const result = await queueDocumentProcessingAction(payload);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, jobId: result.jobId, stage: result.stage }, { status: 202 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error queuing processing job';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
