/**
 * @fileOverview Cloud Tasks Event Dispatcher Route Handler (Milestone 1)
 *
 * Implements Rule 13 (No Anonymous Fallback), Rule 34 (SSRF & Boundary Controls),
 * Rule 51 (Server Action / Route Handler Security Gate), and Rule 69 (Master Layering Axiom).
 *
 * Invoked by Google Cloud Tasks to asynchronously dispatch pending outbox events.
 * Authenticated via dual verification: Cloud Tasks handshake header + Google OIDC token.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCloudTaskRequest } from '@/lib/security/cloud-tasks-auth';
import { verifyCloudTasksOidcToken } from '@/lib/security/cloud-tasks-oidc';
import { EventDispatchOptionsSchema } from '@/platform/events/contracts/event-dispatcher.contract';
import { processEventDispatch } from '@/platform/tasks/event-dispatcher-worker';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. Authenticate Cloud Tasks queue signature (fail-closed, Rule 34)
  if (!(await isAuthorizedCloudTaskRequest(request.headers))) {
    console.warn('[EVENT-DISPATCHER] Unauthorized Cloud Tasks handshake signature.');
    return NextResponse.json(
      { error: 'Unauthorized handshake signature' },
      { status: 401 }
    );
  }

  // 2. Authenticate Cloud Tasks OIDC token (fail-closed in prod, dev-bypass allowed in non-prod, Rule 13 & 34)
  const oidcResult = await verifyCloudTasksOidcToken(request.headers);
  if (!oidcResult.authorized) {
    console.warn('[EVENT-DISPATCHER] Unauthorized Cloud Tasks OIDC token:', oidcResult.reason);
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

  const parseResult = EventDispatchOptionsSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid dispatch options', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await processEventDispatch(parseResult.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown event dispatcher error';
    console.error('[EVENT-DISPATCHER] Fatal worker error:', err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
