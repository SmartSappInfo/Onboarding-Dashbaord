/**
 * @fileOverview Cloud Tasks Memory Indexer Route Handler (Phase 4 Milestone 3)
 *
 * Implements Rule 4 (Zero-any), Rule 13 (No Anonymous Fallback),
 * Rule 34 (SSRF & Boundary Controls), Rule 51 (Route Handler Security Gate),
 * and Rule 69 (Master Layering Axiom).
 *
 * Invoked by Google Cloud Tasks to asynchronously chunk, embed, and index memories.
 * Authenticated via dual verification: Cloud Tasks handshake header + Google OIDC token.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCloudTaskRequest } from '@/lib/security/cloud-tasks-auth';
import { verifyCloudTasksOidcToken } from '@/lib/security/cloud-tasks-oidc';
import {
  INGESTION_ERROR_CODES,
  MemoryIngestionJobPayloadSchema,
} from '@/platform/memory/ingestion/ingestion-types';
import { processMemoryIngestionJob } from '@/platform/memory/ingestion/memory-ingestion-worker';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. Authenticate Cloud Tasks queue signature (fail-closed, Rule 34)
  if (!(await isAuthorizedCloudTaskRequest(request.headers))) {
    console.warn('[MEMORY-INDEXER] Unauthorized Cloud Tasks handshake signature.');
    return NextResponse.json(
      { error: 'Unauthorized handshake signature' },
      { status: 401 }
    );
  }

  // 2. Authenticate Cloud Tasks OIDC token (fail-closed in prod, dev-bypass allowed in non-prod, Rule 13 & 34)
  const oidcResult = await verifyCloudTasksOidcToken(request.headers);
  if (!oidcResult.authorized) {
    console.warn('[MEMORY-INDEXER] Unauthorized Cloud Tasks OIDC token:', oidcResult.reason);
    return NextResponse.json(
      { error: oidcResult.reason || 'Unauthorized OIDC token' },
      { status: 401 }
    );
  }

  // 3. Body is untrusted unknown; validate with Zod schema (Rule 4)
  let rawBody: unknown = {};
  try {
    const text = await request.text();
    if (text && text.trim().length > 0) {
      rawBody = JSON.parse(text);
    }
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload' },
      { status: 400 }
    );
  }

  const parseResult = MemoryIngestionJobPayloadSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid memory ingestion payload', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await processMemoryIngestionJob(parseResult.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown memory indexer error';
    console.error('[MEMORY-INDEXER] Fatal worker error:', err);

    if (errorMessage.includes(INGESTION_ERROR_CODES.DEAD_MAN_PAUSED)) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
