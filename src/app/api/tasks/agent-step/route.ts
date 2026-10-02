/**
 * @fileOverview Cloud Tasks Worker for Async Agent Execution Steps (Phase 0 / Phase 7)
 *
 * Implements Cloud Run blueprint §5.2 and Rules 19, 20, 25.
 * Thin HTTP shell: authenticates the Cloud Tasks handshake, then delegates to
 * `processAgentStep`, which claims the step transactionally, re-authorizes the run's principal,
 * executes the registered capability and records the real outcome.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Do not add execution logic here; put it in `src/platform/tasks/agent-step-executor.ts` (unit-tested).
 * - The response status drives Cloud Tasks retries (see the executor header). Returning 200 on a
 *   retryable failure would drop the step; returning 5xx on a permanent failure would retry forever.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isAuthorizedCloudTaskRequest } from '@/lib/security/cloud-tasks-auth';
import { verifyCloudTasksOidcToken } from '@/lib/security/cloud-tasks-oidc';
import { toClientErrorMessage } from '@/lib/errors/report-error';
import { createFirestoreApprovalVerifier } from '@/platform/capabilities/policy/approval-verifier';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';
import { ensureCapabilitiesRegistered } from '@/platform/capabilities/registry/register-capabilities';
import { processAgentStep } from '@/platform/tasks/agent-step-executor';
import { createFirestoreAgentStepStore } from '@/platform/tasks/firestore-agent-step-store';
import { createLivePrincipalCheck } from '@/platform/tasks/live-principal-check';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. Authenticate Cloud Tasks handshake (fail-closed)
  if (!(await isAuthorizedCloudTaskRequest(request.headers))) {
    console.warn('[AGENT-STEP-WORKER] Unauthorized Cloud Tasks handshake signature.');
    return NextResponse.json({ error: 'Unauthorized handshake signature' }, { status: 401 });
  }

  // 2. Authenticate Cloud Tasks OIDC token (fail-closed in prod, dev-bypass allowed in non-prod, Rule 13 & 34)
  const oidcResult = await verifyCloudTasksOidcToken(request.headers);
  if (!oidcResult.authorized) {
    console.warn('[AGENT-STEP-WORKER] Unauthorized Cloud Tasks OIDC token:', oidcResult.reason);
    return NextResponse.json({ error: oidcResult.reason || 'Unauthorized OIDC token' }, { status: 401 });
  }

  try {
    // 2. Body is untrusted `unknown`; the executor validates it with Zod before use (Rule 4)
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ status: 'rejected', code: 'INVALID_JSON' }, { status: 400 });
    }

    // The worker may run in a fresh process: load every domain's capabilities first.
    ensureCapabilitiesRegistered();

    const outcome = await processAgentStep(rawBody, {
      store: createFirestoreAgentStepStore(adminDb),
      resolveCapability: getCapability,
      approvals: createFirestoreApprovalVerifier(adminDb),
      principals: createLivePrincipalCheck(adminDb),
    });

    console.info(
      `[AGENT-STEP-WORKER] run=${outcome.body.runId ?? '?'} step=${outcome.body.stepNumber ?? '?'} ` +
        `status=${outcome.body.status}${outcome.body.code ? ` code=${outcome.body.code}` : ''}`
    );
    return NextResponse.json(outcome.body, { status: outcome.httpStatus });
  } catch (err: unknown) {
    // Infrastructure failure (e.g. Firestore unavailable): 500 so Cloud Tasks retries.
    console.error('[AGENT-STEP-WORKER] Unhandled exception processing agent step:', err);
    return NextResponse.json(
      { error: toClientErrorMessage('api.tasks.agent-step', err, undefined, 'Agent step execution critical error') },
      { status: 500 }
    );
  }
}
