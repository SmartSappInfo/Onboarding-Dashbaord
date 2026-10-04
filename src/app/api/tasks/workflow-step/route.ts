/**
 * @fileOverview Cloud Tasks Workflow Step Route Handler (Phase 7 Milestone 2)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed throughout with Zod v4.
 * 2. DUAL CLOUD TASKS AUTH (Rule 33 & 51):
 *    - Cloud Tasks HMAC handshake header (`isAuthorizedCloudTaskRequest`)
 *    - Google Cloud Tasks OIDC token (`verifyCloudTasksOidcToken`)
 * 3. DEAD-MAN 503 RETRY SEMANTICS (Rule 60):
 *    Returns HTTP 503 when dead-man switch is active so Google Cloud Tasks backs off and retries automatically.
 * 4. LIGHTWEIGHT TASK PAYLOAD (< 2KB):
 *    Payload contains only workflowId, stepId, tenant, attempt, idempotencyKey, correlationId.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCloudTaskRequest } from '@/lib/security/cloud-tasks-auth';
import { verifyCloudTasksOidcToken } from '@/lib/security/cloud-tasks-oidc';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  WorkflowTaskPayloadSchema,
} from '@/platform/workflows/dispatcher/workflow-dispatcher-types';
import {
  getWorkflowStepRunner,
} from '@/platform/workflows/execution/workflow-step-runner';
import {
  WorkflowExecutionError,
} from '@/platform/workflows/execution/workflow-execution-types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. Authenticate Cloud Tasks queue signature (fail-closed, Rule 34 / 51)
  if (!(await isAuthorizedCloudTaskRequest(request.headers))) {
    console.warn('[WORKFLOW-WORKER] Unauthorized Cloud Tasks handshake signature.');
    return NextResponse.json(
      { error: 'Unauthorized handshake signature' },
      { status: 401 }
    );
  }

  // 2. Authenticate Cloud Tasks OIDC token (fail-closed in prod, Rule 33)
  const oidcResult = await verifyCloudTasksOidcToken(request.headers);
  if (!oidcResult.authorized) {
    console.warn('[WORKFLOW-WORKER] Unauthorized Cloud Tasks OIDC token:', oidcResult.reason);
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

  const parseResult = WorkflowTaskPayloadSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid workflow task payload', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parseResult.data;

  // 4. Emergency Dead-Man Switch Evaluation (Rule 60)
  try {
    await checkGovernanceDeadManSwitch(payload.organizationId);
  } catch {
    // Return HTTP 503 so Cloud Tasks automatically retries with backoff
    return NextResponse.json(
      {
        error: 'Execution paused by emergency dead-man switch',
        retryable: true,
      },
      { status: 503 }
    );
  }

  // 5. Execute Step Pipeline
  try {
    const runner = getWorkflowStepRunner();
    const result = await runner.executeWorkflowStep(payload);

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown workflow execution error';
    console.error('[WORKFLOW-WORKER] Execution error:', err);

    if (err instanceof WorkflowExecutionError && err.code === 'DEAD_MAN_PAUSED') {
      return NextResponse.json(
        { error: errorMessage, retryable: true },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
