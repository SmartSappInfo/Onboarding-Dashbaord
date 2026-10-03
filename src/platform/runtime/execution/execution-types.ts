/**
 * @fileOverview Execution Contracts, Schemas & Error Taxonomy (Rules 4, 13, 21, 22, 30, 31, 48)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy with Zod v4 schemas.
 * - Rule 13 & 30: Formal trust boundaries and XML isolation containers for tool outputs.
 * - Rule 21 & 22: Two-Phase Action model and cryptographic SHA-256 payloadHash binding.
 * - Rule 31: Strict output schema validation between agent and tool.
 * - Rule 47: "Never Trust the Model" — formal verification pipeline.
 * - Rule 48: "Never Trust the Tool Either" — sanitized error taxonomy.
 * - Rule 60: Emergency dead-man controls integration.
 */

import { z } from 'zod/v4';
import { RISK_LEVELS } from '@/platform/capabilities/contracts/risk-levels';
import { type AgentRunStatus } from '../agent-run-types';

export const EXECUTION_ERROR_CODES = [
  'SCHEMA_VALIDATION_FAILED',
  'VERIFICATION_FAILED',
  'APPROVAL_REQUIRED',
  'APPROVAL_REJECTED',
  'PAYLOAD_TAMPERED',
  'TOOL_EXECUTION_FAILED',
  'UNTRUSTED_OUTPUT_DETECTED',
  'EXECUTION_TIMEOUT',
  'DEAD_MAN_PAUSED',
  'INVALID_EXECUTION_STATE',
  'CAPABILITY_NOT_FOUND',
  'TOCTOU_CONFLICT',
] as const;

export type ExecutionErrorCode = (typeof EXECUTION_ERROR_CODES)[number];

export interface ExecutionErrorDetails {
  readonly code: ExecutionErrorCode;
  readonly message: string;
  readonly runId?: string;
  readonly stepId?: string;
  readonly capabilityId?: string;
  readonly organizationId?: string;
  readonly details?: Record<string, unknown>;
}

export class ExecutionError extends Error {
  readonly code: ExecutionErrorCode;
  readonly runId?: string;
  readonly stepId?: string;
  readonly capabilityId?: string;
  readonly organizationId?: string;
  readonly details?: Record<string, unknown>;

  constructor(opts: ExecutionErrorDetails) {
    super(`[Execution:${opts.code}] ${opts.message}`);
    this.name = 'ExecutionError';
    this.code = opts.code;
    this.runId = opts.runId;
    this.stepId = opts.stepId;
    this.capabilityId = opts.capabilityId;
    this.organizationId = opts.organizationId;
    this.details = opts.details;
    Object.setPrototypeOf(this, ExecutionError.prototype);
  }
}

// ============================================================================
// 1. STEP OUTPUT VALIDATION CONTRACTS (Rules 31, 30, 48)
// ============================================================================

export const SanitizedStepErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type SanitizedStepError = z.infer<typeof SanitizedStepErrorSchema>;

export const StepValidationResultSchema = z.object({
  valid: z.boolean(),
  validatedOutput: z.record(z.string(), z.unknown()).optional(),
  sanitizedError: SanitizedStepErrorSchema.optional(),
  validationErrors: z.array(z.string()).optional(),
  isolatedXmlOutput: z.string().min(1),
  tokensUsed: z.number().int().min(0).default(0),
});

export type StepValidationResult = z.infer<typeof StepValidationResultSchema>;

// ============================================================================
// 2. POST-CONDITION VERIFICATION CONTRACTS (Rule 47 & Step 9 Lifecycle)
// ============================================================================

export const StepVerificationResultSchema = z.object({
  verified: z.boolean(),
  assertionDetails: z.string().optional(),
  rejectionReason: z.string().optional(),
  observedState: z.record(z.string(), z.unknown()).optional(),
  expectedState: z.record(z.string(), z.unknown()).optional(),
  suggestedRemediation: z.string().optional(),
});

export type StepVerificationResult = z.infer<typeof StepVerificationResultSchema>;

// ============================================================================
// 3. TWO-PHASE APPROVAL INTERCEPTION CONTRACTS (Rules 17, 21, 22)
// ============================================================================

export const ApprovalInterceptionResultSchema = z.object({
  requiresApproval: z.boolean(),
  actionProposalId: z.string().optional(),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  reason: z.string().optional(),
  isNonDelegable: z.boolean().default(false),
});

export type ApprovalInterceptionResult = z.infer<typeof ApprovalInterceptionResultSchema>;

// ============================================================================
// 4. EXECUTION LOOP OPTIONS & OUTCOME (Rule 23, 42, 60)
// ============================================================================

export const ExecutionLoopOptionsSchema = z.object({
  dryRun: z.boolean().default(false),
  maxReplans: z.number().int().min(0).max(5).default(3),
  verifyPostConditions: z.boolean().default(true),
  autoTriggerSagaRollbackOnFailure: z.boolean().default(true),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
});

export type ExecutionLoopOptions = z.infer<typeof ExecutionLoopOptionsSchema>;

export const AgentExecutionOutcomeSchema = z.object({
  runId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  status: z.custom<AgentRunStatus>((val) => typeof val === 'string'),
  totalStepsExecuted: z.number().int().min(0),
  completedStepsCount: z.number().int().min(0),
  failedStepsCount: z.number().int().min(0),
  approvalPausedStepId: z.string().optional(),
  actionProposalId: z.string().optional(),
  summary: z.string().min(1),
  dryRun: z.boolean(),
  error: z.string().optional(),
  replanCount: z.number().int().min(0).default(0),
  durationMs: z.number().int().min(0),
  tokensUsed: z.number().int().min(0),
});

export type AgentExecutionOutcome = z.infer<typeof AgentExecutionOutcomeSchema>;
