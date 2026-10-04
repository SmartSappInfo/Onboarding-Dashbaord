/**
 * @fileOverview Cloud Tasks Scheduled Resumption Route Handler (Phase 7 Milestone 3)
 *
 * Invoked by Google Cloud Tasks when a scheduled wait delay expires.
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed throughout via Zod v4.
 * 2. CLOUD TASKS AUTHENTICATION (Rule 33 & 51):
 *    - Cloud Tasks HMAC handshake verification (`isAuthorizedCloudTaskRequest`)
 *    - Cloud Tasks Google OIDC bearer token verification (`verifyCloudTasksOidcToken`)
 * 3. DEAD-MAN 503 RETRY SEMANTICS (Rule 60):
 *    Evaluates `checkGovernanceDeadManSwitch` at Step 1. If active, returns HTTP 503
 *    so Google Cloud Tasks backs off and automatically retries.
 * 4. ANTI-IDOR & ANTI-TAMPERING (Rules 8 & 22):
 *    Validates cryptographic HMAC token before executing resumption.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCloudTaskRequest } from '@/lib/security/cloud-tasks-auth';
import { verifyCloudTasksOidcToken } from '@/lib/security/cloud-tasks-oidc';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  ScheduleResumePayloadSchema,
  executeScheduledResumption,
} from '@/platform/workflows/resumption/schedule-resumption-worker';
import { getWorkflowResumptionService } from '@/platform/workflows/resumption/workflow-resumption-service';
import {
  WorkflowResumptionError,
  mapResumptionErrorToHttpStatus,
} from '@/platform/workflows/resumption/workflow-resumption-types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. Authenticate Cloud Tasks queue signature (fail-closed, Rule 34 / 51)
  if (!(await isAuthorizedCloudTaskRequest(request.headers))) {
    console.warn('[SCHEDULE-RESUME] Unauthorized Cloud Tasks handshake signature.');
    return NextResponse.json(
      { error: 'Unauthorized handshake signature' },
      { status: 401 }
    );
  }

  // 2. Authenticate Cloud Tasks OIDC token (fail-closed in prod, Rule 33)
  const oidcResult = await verifyCloudTasksOidcToken(request.headers);
  if (!oidcResult.authorized) {
    console.warn('[SCHEDULE-RESUME] Unauthorized Cloud Tasks OIDC token:', oidcResult.reason);
    return NextResponse.json(
      { error: oidcResult.reason || 'Unauthorized OIDC token' },
      { status: 401 }
    );
  }

  // 3. Body validation with Zod v4 (Rule 4)
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

  const parseResult = ScheduleResumePayloadSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid schedule resume payload',
        details: parseResult.error.format(),
      },
      { status: 400 }
    );
  }

  const payload = parseResult.data;

  // 4. Dead-Man Switch Evaluation (Rule 60)
  try {
    await checkGovernanceDeadManSwitch(payload.tenant.organizationId);
  } catch (dmErr: unknown) {
    return NextResponse.json(
      {
        code: 'DEAD_MAN_PAUSED',
        error: `Schedule resumption paused by emergency dead-man switch for org '${payload.tenant.organizationId}'`,
        message: dmErr instanceof Error ? dmErr.message : String(dmErr),
      },
      { status: 503 }
    );
  }

  // 5. Execute scheduled resumption
  try {
    const resumptionService = getWorkflowResumptionService();
    const result = await executeScheduledResumption(payload, resumptionService);

    return NextResponse.json(
      {
        success: true,
        workflowId: payload.workflowId,
        stepId: payload.stepId,
        status: result.status,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof WorkflowResumptionError) {
      const status = mapResumptionErrorToHttpStatus(err.code);
      return NextResponse.json(
        {
          code: err.code,
          error: err.message,
        },
        { status }
      );
    }

    const message = err instanceof Error ? err.message : 'Internal resumption error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
