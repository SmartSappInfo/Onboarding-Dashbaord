/**
 * @fileOverview Cloud Tasks worker: meeting intelligence `meeting_postprocess_v2` (Phase 11 M2 · T3.3).
 *
 * SECURITY (Rules 33, 51): Cloud Tasks HMAC handshake AND OIDC token, both fail-closed. The body is
 * `{ runId }` only; the run, transcript, consent and policy are reloaded server-side.
 * DEAD-MAN (Rule 60): the governance switch answers 503 so Cloud Tasks backs off and retries.
 * RETRIES (Rule 25): a retryable outcome answers 503 (Cloud Tasks retries with backoff); the
 * pipeline dead-letters after MAX_RUN_ATTEMPTS. Terminal outcomes answer 200 (no retry).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { isAuthorizedCloudTaskRequest } from '@/lib/security/cloud-tasks-auth';
import { verifyCloudTasksOidcToken } from '@/lib/security/cloud-tasks-oidc';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { adminDb } from '@/lib/firebase-admin';
import { processIntelligenceRun } from '@/lib/meetings/intelligence/pipeline';
import { createIntelligenceModel } from '@/lib/meetings/intelligence/intelligence-model';

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

const PayloadSchema = z.object({ runId: z.string().regex(/^mir_[0-9a-f]{32}$/) });

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedCloudTaskRequest(request.headers))) {
    return NextResponse.json({ error: 'Unauthorized handshake signature' }, { status: 401 });
  }
  const oidc = await verifyCloudTasksOidcToken(request.headers);
  if (!oidc.authorized) {
    return NextResponse.json({ error: oidc.reason || 'Unauthorized OIDC token' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }
  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  try {
    await checkGovernanceDeadManSwitch();
  } catch {
    return NextResponse.json({ error: 'Paused by emergency switch', retryable: true }, { status: 503 });
  }

  try {
    const outcome = await processIntelligenceRun(adminDb, { model: createIntelligenceModel(adminDb), nowMs: () => Date.now() }, parsed.data.runId);
    if (outcome.status === 'retry') {
      return NextResponse.json({ status: 'retry', reason: outcome.reason, retryable: true }, { status: 503 });
    }
    return NextResponse.json(outcome, { status: 200 });
  } catch (err) {
    // Unexpected: let Cloud Tasks retry; the attempt counter bounds this.
    console.error('[MEETING-INTELLIGENCE] unexpected error', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Meeting intelligence worker error', retryable: true }, { status: 500 });
  }
}
