/**
 * @fileOverview Canonical Contracts, Types, and Zod v4 Schemas for Agentic Postcondition Verification (Phase 14 Milestone 1)
 *
 * Implements Rule 2 (FMEA Failure Analysis), Rule 4 (Strict Typing: zero any/any[]),
 * Rule 8 (Anti-IDOR Multi-Tenant Lock), Rule 10 (Inline Architectural Documentation),
 * Rule 11 (Mathematical Determinism), Rule 12 (Risk Level L0_READ for Verification),
 * Rule 13/30 (Untrusted Data Isolation Containers), Rule 19 (Deterministic Idempotency),
 * Rule 21 (Two-Phase Execution: Verify before Commit), Rule 23 (Resource Governance),
 * Rule 26 (Cooperative Cancellation), Rule 40 (Domain Event Auditing),
 * Rule 41 (Explainability Grid), Rule 48 (Sanitized Error Taxonomy),
 * Rule 60 (Emergency Dead-Man Switch Evaluation), Rule 67 (The Agent Implementation Gate),
 * Rule 68 (The Five Non-Negotiable Invariants), and Rule 69 (Strangler Fig Invariant).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - This file establishes the Single Source of Truth for postcondition assertions in SmartSapp.
 * - Every mutating capability executes within the 6-Step Responsible Execution Loop:
 *   PLAN → PREDICT → EXECUTE → VERIFY (Postconditions) → COMMIT → LEARN
 * - Mutating actions must never be considered successful solely based on an HTTP 200 or database write ack;
 *   postconditions evaluate concrete post-state invariant changes and fail closed if invariants are violated.
 * - Strict typing is non-negotiable: zero `any` or `any[]` are permitted.
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. POSTCONDITION SEVERITY, STATUS & STRATEGY ENUMS
// ============================================================================

export const PostconditionSeveritySchema = z.enum(['CRITICAL', 'WARNING']);
export type PostconditionSeverity = z.infer<typeof PostconditionSeveritySchema>;

export const PostconditionStatusSchema = z.enum(['VERIFIED', 'FAILED', 'SKIPPED']);
export type PostconditionStatus = z.infer<typeof PostconditionStatusSchema>;

export const OverallVerificationStatusSchema = z.enum(['PASS', 'FAIL', 'DEGRADED']);
export type OverallVerificationStatus = z.infer<typeof OverallVerificationStatusSchema>;

export const VerificationStrategySchema = z.enum([
  'FAIL_AND_COMPENSATE',
  'ESCALATE_TO_APPROVAL',
  'RECORD_WARNING',
]);
export type VerificationStrategy = z.infer<typeof VerificationStrategySchema>;

// ============================================================================
// 2. ASSERTION CONTRACTS & CONTEXT
// ============================================================================

export const PostconditionAssertionSchema = z.object({
  assertionId: z.string().min(1),
  ruleName: z.string().min(1),
  targetResource: z.string().min(1),
  targetId: z.string().min(1),
  severity: PostconditionSeveritySchema,
  status: PostconditionStatusSchema,
  errorMessage: z.string().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  evaluatedAt: z.string().datetime(),
});
export type PostconditionAssertion = z.infer<typeof PostconditionAssertionSchema>;

export const PostconditionContextSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  actorId: z.string().min(1),
  preStateSnapshot: z.record(z.string(), z.unknown()),
  postStateSnapshot: z.record(z.string(), z.unknown()).nullable(),
  mutationPayload: z.record(z.string(), z.unknown()),
});
export type PostconditionContext = z.infer<typeof PostconditionContextSchema>;

// ============================================================================
// 3. VERIFICATION RESULT CONTRACT
// ============================================================================

export const VerificationResultSchema = z.object({
  executionId: z.string().min(1),
  capabilityId: z.string().min(1),
  overallStatus: OverallVerificationStatusSchema,
  assertionsCount: z.number().int().nonnegative(),
  passedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  assertions: z.array(PostconditionAssertionSchema),
  durationMs: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

// ============================================================================
// 4. STRUCTURED ERROR TAXONOMY & BOUNDED ERROR CLASS
// ============================================================================

export const VERIFICATION_ERROR_CODES = {
  POSTCONDITION_ASSERTION_FAILED: 'POSTCONDITION_ASSERTION_FAILED',
  VERIFICATION_TIMEOUT: 'VERIFICATION_TIMEOUT',
  INVALID_POSTCONDITION_CONTEXT: 'INVALID_POSTCONDITION_CONTEXT',
  UNVERIFIED_MUTATION_REJECTED: 'UNVERIFIED_MUTATION_REJECTED',
  VERIFICATION_DEAD_MAN_PAUSED: 'VERIFICATION_DEAD_MAN_PAUSED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
} as const;

export type VerificationErrorCode =
  (typeof VERIFICATION_ERROR_CODES)[keyof typeof VERIFICATION_ERROR_CODES];

export class AgentVerificationError extends Error {
  public readonly code: VerificationErrorCode;
  public readonly statusCode: number;

  constructor(code: VerificationErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'AgentVerificationError';
    this.code = code;
    this.statusCode = statusCode ?? this.resolveStatusCode(code);
  }

  private resolveStatusCode(code: VerificationErrorCode): number {
    switch (code) {
      case 'INVALID_POSTCONDITION_CONTEXT':
        return 400;
      case 'IDOR_VIOLATION':
        return 403;
      case 'POSTCONDITION_ASSERTION_FAILED':
        return 422;
      case 'UNVERIFIED_MUTATION_REJECTED':
        return 409;
      case 'VERIFICATION_DEAD_MAN_PAUSED':
        return 503;
      case 'VERIFICATION_TIMEOUT':
        return 504;
      default:
        return 500;
    }
  }
}
