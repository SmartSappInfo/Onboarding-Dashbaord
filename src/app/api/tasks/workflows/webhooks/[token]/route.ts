/**
 * @fileOverview Universal External Webhook Ingress Route Handler (Phase 7 Milestone 3)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed parameters and return objects.
 * 2. CRYPTOGRAPHIC TOKEN VERIFICATION (Rule 22 & 46): Enforces constant-time HMAC-SHA256 signature verification.
 * 3. EMERGENCY DEAD-MAN 503 RETRY SEMANTICS (Rule 60):
 *    Returns HTTP 503 with retryable flag when dead-man pause is active so third-party webhook dispatchers
 *    (Stripe, DocuSign, Zoom, WhatsApp) automatically back off and retry.
 * 4. CLOUD RUN 32MB CEILING (Rule 9 & Cloud Run Blueprint): Rejects payloads exceeding 32MB with HTTP 413.
 * 5. UNTRUSTED DATA ISOLATION (Rule 13 & 30): Wraps webhook payload in `<untrusted_reference_data>` container.
 * 6. REPLAY DEFENSE (Rule 46): Consumed tokens rejected with HTTP 409 Conflict.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  verifyResumptionToken,
  WorkflowResumptionError,
  mapResumptionErrorToHttpStatus,
} from '@/platform/workflows/resumption/workflow-resumption-types';
import { getWorkflowResumptionService } from '@/platform/workflows/resumption/workflow-resumption-service';

export const dynamic = 'force-dynamic';

const CLOUD_RUN_MAX_PAYLOAD_BYTES = 32 * 1024 * 1024; // 32MB ceiling

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SmartSapp-Correlation-Id',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  // 1. Verify Cryptographic Token & Expiration (Rules 22, 23 & 46)
  const tokenVerification = verifyResumptionToken(token);
  if (!tokenVerification.valid || !tokenVerification.payload) {
    const status = tokenVerification.error === 'RESUMPTION_TOKEN_EXPIRED' ? 410 : 401;
    return NextResponse.json(
      {
        error: tokenVerification.error === 'RESUMPTION_TOKEN_EXPIRED'
          ? 'Resumption token has expired'
          : 'Invalid or forged resumption token',
        code: tokenVerification.error ?? 'RESUMPTION_TOKEN_INVALID',
      },
      { status, headers: CORS_HEADERS }
    );
  }

  const tokenPayload = tokenVerification.payload;

  // 2. Emergency Dead-Man Switch Evaluation (Rule 60)
  try {
    await checkGovernanceDeadManSwitch(tokenPayload.organizationId);
  } catch {
    // Return HTTP 503 so sender backs off and retries automatically
    return NextResponse.json(
      {
        error: 'Execution paused by emergency dead-man switch',
        code: 'DEAD_MAN_PAUSED',
        retryable: true,
      },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  // 3. Payload Size Ceiling Enforcement (Rule 9)
  let rawText = '';
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json(
      { error: 'Failed to read request body', code: 'INVALID_PAYLOAD' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (rawText.length > CLOUD_RUN_MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: 'Payload exceeds Cloud Run 32MB ceiling', code: 'PAYLOAD_TOO_LARGE' },
      { status: 413, headers: CORS_HEADERS }
    );
  }

  // 4. Parse Body (Fail-safe for empty body)
  let rawBody: Record<string, unknown> = {};
  if (rawText.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        rawBody = parsed as Record<string, unknown>;
      } else {
        rawBody = { value: parsed };
      }
    } catch {
      rawBody = { rawContent: rawText };
    }
  }

  // 5. Execute Resumption Pipeline via Service
  try {
    const resumptionService = getWorkflowResumptionService();
    const result = await resumptionService.resumeStep({
      workflowId: tokenPayload.workflowId,
      stepId: tokenPayload.stepId,
      token,
      tenant: {
        organizationId: tokenPayload.organizationId,
        workspaceId: tokenPayload.workspaceId,
      },
      signalData: rawBody,
      verifiedBy: `webhook_${tokenPayload.conditionType}`,
      source: 'external_webhook',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        workflowId: result.workflowId,
        stepId: result.stepId,
        status: result.status,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    if (err instanceof WorkflowResumptionError) {
      const status = mapResumptionErrorToHttpStatus(err.code);
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          retryable: status === 503,
        },
        { status, headers: CORS_HEADERS }
      );
    }

    const message = err instanceof Error ? err.message : 'Unknown resumption error';
    return NextResponse.json(
      { error: message, code: 'RESUMPTION_FAILED' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
