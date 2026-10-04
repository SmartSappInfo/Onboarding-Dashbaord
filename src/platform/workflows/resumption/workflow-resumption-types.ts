/**
 * @fileOverview Canonical Workflow Resumption Contracts, Schemas & HMAC Token Utilities (Phase 7 Milestone 3)
 *
 * ARCHITECTURAL INVARIANTS & SECURITY:
 * 1. ZERO ANY POLICY (Rule 4): All schemas strictly typed using Zod v4.
 * 2. ANTI-IDOR & MULTI-TENANCY (Rule 8 & 47): Resumption tokens immutably bind organizationId and workspaceId.
 * 3. CRYPTOGRAPHIC TOKEN VERIFICATION (Rule 22 & 46): HMAC-SHA256 signature checked via constant-time comparison
 *    (`crypto.timingSafeEqual`) to prevent timing and forgery attacks.
 * 4. STRUCTURED ERROR TAXONOMY (Rule 48): Granular error codes with safe HTTP status mappings.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod/v4';
import { WAIT_CONDITION_TYPES, type WaitConditionType } from '../workflow-types';
export type { WaitConditionType };

// ── 1. Resumption Token Payload Schema ───────────────────────────────────────
export const ResumptionTokenPayloadSchema = z.object({
  workflowId: z.string().min(1),
  stepId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  conditionType: z.enum(WAIT_CONDITION_TYPES),
  nonce: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type ResumptionTokenPayload = z.output<typeof ResumptionTokenPayloadSchema>;
export type ResumptionTokenPayloadInput = z.input<typeof ResumptionTokenPayloadSchema>;

// ── 2. Resumption Signal Schema (Ingress Payload) ───────────────────────────
export const ResumptionSignalSchema = z.object({
  workflowId: z.string().min(1),
  stepId: z.string().min(1),
  token: z.string().min(1),
  tenant: z.object({
    organizationId: z.string().min(1),
    workspaceId: z.string().min(1),
  }),
  signalData: z.record(z.string(), z.unknown()).optional().default({}),
  verifiedBy: z.string().optional(),
  source: z.string().optional().default('external_signal'),
  timestamp: z.string().datetime().optional(),
});
export type ResumptionSignal = z.output<typeof ResumptionSignalSchema>;
export type ResumptionSignalInput = z.input<typeof ResumptionSignalSchema>;

// ── 3. Wait Condition Evaluation Result ─────────────────────────────────────
export const WaitConditionEvaluationResultSchema = z.object({
  shouldSuspend: z.boolean(),
  conditionType: z.enum(WAIT_CONDITION_TYPES).optional(),
  token: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  callbackUrl: z.string().optional(),
  actionProposalId: z.string().optional(),
  payloadHash: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional().default({}),
});
export type WaitConditionEvaluationResult = z.output<typeof WaitConditionEvaluationResultSchema>;
export type WaitConditionEvaluationResultInput = z.input<typeof WaitConditionEvaluationResultSchema>;

// ── 4. Step Resumption Result Schema ────────────────────────────────────────
export const StepResumptionResultSchema = z.object({
  workflowId: z.string().min(1),
  stepId: z.string().min(1),
  status: z.literal('RESUMED'),
  durationMs: z.number().nonnegative(),
  taskKey: z.string().optional(),
});
export type StepResumptionResult = z.infer<typeof StepResumptionResultSchema>;

// ── 5. Timeout Action Schema ────────────────────────────────────────────────
export const TimeoutActionSchema = z.enum(['fail', 'cancel', 'proceed', 'compensate']);
export type TimeoutAction = z.infer<typeof TimeoutActionSchema>;

// ── 6. Error Taxonomy & Mapping ─────────────────────────────────────────────
export const RESUMPTION_ERROR_CODES = [
  'RESUMPTION_TOKEN_INVALID',
  'RESUMPTION_TOKEN_EXPIRED',
  'RESUMPTION_TOKEN_ALREADY_CONSUMED',
  'TENANT_MISMATCH',
  'WORKFLOW_NOT_WAITING',
  'STEP_NOT_WAITING',
  'WAIT_CONDITION_MISMATCH',
  'PAYLOAD_TAMPERED',
  'DEAD_MAN_PAUSED',
  'PROMPT_INJECTION_DETECTED',
  'UNAUTHORIZED_CALLER',
  'TIMEOUT_EXPIRED',
] as const;

export type ResumptionErrorCode = (typeof RESUMPTION_ERROR_CODES)[number];

export class WorkflowResumptionError extends Error {
  constructor(
    public readonly code: ResumptionErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WorkflowResumptionError';
  }
}

export function mapResumptionErrorToHttpStatus(code: ResumptionErrorCode): number {
  switch (code) {
    case 'RESUMPTION_TOKEN_INVALID':
    case 'UNAUTHORIZED_CALLER':
      return 401;
    case 'TENANT_MISMATCH':
      return 403;
    case 'WORKFLOW_NOT_WAITING':
    case 'STEP_NOT_WAITING':
    case 'WAIT_CONDITION_MISMATCH':
    case 'PROMPT_INJECTION_DETECTED':
    case 'PAYLOAD_TAMPERED':
      return 400;
    case 'RESUMPTION_TOKEN_ALREADY_CONSUMED':
      return 409;
    case 'RESUMPTION_TOKEN_EXPIRED':
    case 'TIMEOUT_EXPIRED':
      return 410;
    case 'DEAD_MAN_PAUSED':
      return 503;
    default:
      return 500;
  }
}

// ── 7. Cryptographic HMAC Token Utilities (Rule 22 & 46) ───────────────────

function getResumptionSecret(explicitSecret?: string): string {
  return (
    explicitSecret ||
    process.env.WORKFLOW_RESUMPTION_SECRET ||
    process.env.CLOUD_TASKS_SECRET ||
    'smartsapp-resumption-secret-fallback'
  );
}

/**
 * Generates a signed cryptographic resumption token containing tenant and step identity.
 * Format: `<base64url(payloadJson)>.<hexHmacSha256(payloadJson, secret)>`
 */
export function generateResumptionToken(
  payload: ResumptionTokenPayloadInput,
  explicitSecret?: string
): string {
  const secret = getResumptionSecret(explicitSecret);
  const validatedPayload = ResumptionTokenPayloadSchema.parse(payload);
  const jsonStr = JSON.stringify(validatedPayload);
  const payloadB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(jsonStr).digest('hex');
  return `${payloadB64}.${signature}`;
}

export interface VerifyResumptionTokenResult {
  valid: boolean;
  payload?: ResumptionTokenPayload;
  error?: ResumptionErrorCode;
}

/**
 * Verifies a cryptographic resumption token using constant-time equality check.
 * Guarantees zero timing attack vulnerability and enforces expiration checks.
 */
export function verifyResumptionToken(
  token: string,
  explicitSecret?: string
): VerifyResumptionTokenResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'RESUMPTION_TOKEN_INVALID' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'RESUMPTION_TOKEN_INVALID' };
  }

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature || signature.length !== 64) {
    return { valid: false, error: 'RESUMPTION_TOKEN_INVALID' };
  }

  let jsonStr: string;
  try {
    jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
  } catch {
    return { valid: false, error: 'RESUMPTION_TOKEN_INVALID' };
  }

  const secret = getResumptionSecret(explicitSecret);
  const expectedSignature = createHmac('sha256', secret).update(jsonStr).digest('hex');

  // Constant-time signature verification
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'RESUMPTION_TOKEN_INVALID' };
  }

  let parsedPayload: ResumptionTokenPayload;
  try {
    const raw: unknown = JSON.parse(jsonStr);
    parsedPayload = ResumptionTokenPayloadSchema.parse(raw);
  } catch {
    return { valid: false, error: 'RESUMPTION_TOKEN_INVALID' };
  }

  // Check expiration if present
  if (parsedPayload.expiresAt) {
    const expiresMs = new Date(parsedPayload.expiresAt).getTime();
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) {
      return { valid: false, error: 'RESUMPTION_TOKEN_EXPIRED' };
    }
  }

  return {
    valid: true,
    payload: parsedPayload,
  };
}
