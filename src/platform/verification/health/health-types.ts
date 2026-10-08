/**
 * @fileOverview Canonical Contracts & Error Taxonomy for Health & Discrepancy Systems
 *
 * Implements Step 4 (Verify: Side-Effect Discrepancy Detection) and Step 6 (Learn: Self-Healing
 * & Health Telemetry) of the 6-Step Responsible Execution Loop:
 *   PLAN → PREDICT (Snapshot Pre-State) → EXECUTE → VERIFY → COMMIT → LEARN
 *
 * Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md`:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 11: Mathematical Determinism (Integer health scores 0-100, no floating drift).
 * - Rule 12: Canonical Risk Vocabulary.
 * - Rule 14: Schema Fingerprinting & Contracts (Zod v4 bounded schemas).
 * - Rule 18: TOCTOU Optimistic Concurrency Guard.
 * - Rule 24: Dynamic Circuit Breaker Policy.
 * - Rule 25: Dead-Letter Queue (DLQ) Integration.
 * - Rule 41: Explainability Grid.
 * - Rule 42: Shadow Mode Auto-Degradation.
 * - Rule 48: Sanitized Error Taxonomy & HTTP Status Mapping.
 * - Rule 54: State Machine Invariants (CLOSED -> DEGRADED -> OPEN -> HALF_OPEN).
 * - Rule 61: Mandatory Justification for Operator Actions (>= 5 chars).
 * - Rule 1962: Phase 14 Verification Gate (Side-Effect Verification & Health Telemetry).
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded schemas only.
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. SIDE-EFFECT DISCREPANCY CONTRACTS (Rules 14, 41, 1962)
// ============================================================================

export const DiscrepancyVarianceTypeSchema = z.enum([
  'NO_VARIANCE',
  'BENIGN_INDEX_DRIFT',
  'BENIGN_TIMELINE_UNLINK',
  'FIELD_VALUE_MISMATCH',
  'MISSING_RECORD',
  'UNEXPECTED_MUTATION',
  'EXTERNAL_EGRESS_FAILED',
]);
export type DiscrepancyVarianceType = z.infer<typeof DiscrepancyVarianceTypeSchema>;

export const RemediationActionSchema = z.enum([
  'NONE',
  'AUTO_RETRY_INDEX',
  'AUTO_RELINK_TIMELINE',
  'TRIGGER_COMPENSATION',
  'ESCALATE_TO_OPERATOR',
]);
export type RemediationAction = z.infer<typeof RemediationActionSchema>;

export const DiscrepancyReportSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  executionId: z.string().min(1, 'Execution ID is required'),
  capabilityId: z.string().min(1, 'Capability ID is required'),
  targetResource: z.string().min(1, 'Target resource is required'),
  targetId: z.string().min(1, 'Target ID is required'),
  predictedChange: z.record(z.string(), z.unknown()),
  actualChange: z.record(z.string(), z.unknown()),
  varianceType: DiscrepancyVarianceTypeSchema,
  isRemediable: z.boolean(),
  remediationAction: RemediationActionSchema,
  remediationAttempts: z.number().int().nonnegative().default(0),
  remediationError: z.string().optional(),
  detectedAt: z.string().datetime({ message: 'detectedAt must be an ISO 8601 datetime' }),
  explainabilityGrid: z
    .object({
      what: z.string(),
      why: z.string(),
      expectedStateChange: z.string(),
      residualRisk: z.string(),
    })
    .optional(),
  reportHash: z.string().length(64).optional(),
});
export type DiscrepancyReport = z.infer<typeof DiscrepancyReportSchema>;

// ============================================================================
// 2. CIRCUIT BREAKER & HEALTH STATUS CONTRACTS (Rules 24, 42, 54)
// ============================================================================

export const CircuitStateSchema = z.enum([
  'CLOSED',
  'DEGRADED',
  'OPEN',
  'HALF_OPEN',
]);
export type CircuitState = z.infer<typeof CircuitStateSchema>;

export const AgentHealthStatusSchema = z.enum([
  'HEALTHY',
  'DEGRADED',
  'TRIPPED',
  'CRITICAL',
]);
export type AgentHealthStatus = z.infer<typeof AgentHealthStatusSchema>;

// ============================================================================
// 3. AGENT HEALTH SCORECARD CONTRACT (Rules 11, 24, 42)
// ============================================================================

export const AgentHealthScorecardSchema = z.object({
  personaId: z.string().min(1, 'Persona ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  healthScore: z.number().int().min(0).max(100),
  status: AgentHealthStatusSchema,
  circuitState: CircuitStateSchema,
  successRate: z.number().min(0).max(100),
  failureRate: z.number().min(0).max(100),
  recoveryRate: z.number().min(0).max(100),
  totalExecutions: z.number().int().nonnegative(),
  successfulExecutions: z.number().int().nonnegative(),
  failedExecutions: z.number().int().nonnegative(),
  consecutiveFailures: z.number().int().nonnegative(),
  toolErrorsCount: z.number().int().nonnegative(),
  avgDurationMs: z.number().nonnegative(),
  tokenCostUSD: z.number().nonnegative(),
  updatedAt: z.string().datetime({ message: 'updatedAt must be an ISO 8601 datetime' }),
  lastTrippedAt: z.string().datetime({ message: 'lastTrippedAt must be an ISO 8601 datetime' }).nullable(),
  trippedReason: z.string().nullable(),
  degradationMode: z.enum(['NONE', 'SHADOW_MODE']).default('SHADOW_MODE'),
});
export type AgentHealthScorecard = z.infer<typeof AgentHealthScorecardSchema>;

// ============================================================================
// 4. HEALTH THRESHOLD POLICY CONTRACT (Rules 24, 1962)
// ============================================================================

export const HealthThresholdPolicySchema = z.object({
  personaId: z.string().min(1, 'Persona ID is required'),
  minSuccessRate: z.number().min(0).max(100).default(85),
  maxFailureRate: z.number().min(0).max(100).default(15),
  maxToolErrorsPerHour: z.number().int().nonnegative().default(10),
  maxConsecutiveFailures: z.number().int().positive().default(3),
  coolOffPeriodMs: z.number().int().positive().default(300000), // 5 minutes default
  degradationMode: z.enum(['NONE', 'SHADOW_MODE']).default('SHADOW_MODE'),
});
export type HealthThresholdPolicy = z.infer<typeof HealthThresholdPolicySchema>;

// ============================================================================
// 5. INPUT ACTION CONTRACTS (Rules 8, 47, 51, 61)
// ============================================================================

export const RecordExecutionTelemetryInputSchema = z.object({
  personaId: z.string().min(1, 'Persona ID is required'),
  executionId: z.string().min(1, 'Execution ID is required'),
  capabilityId: z.string().min(1, 'Capability ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  success: z.boolean(),
  durationMs: z.number().nonnegative(),
  tokenUsage: z.number().int().nonnegative().optional().default(0),
  tokenCostUSD: z.number().nonnegative().optional().default(0),
  toolError: z.boolean().optional().default(false),
  errorCode: z.string().optional(),
  discrepancyReport: DiscrepancyReportSchema.optional(),
});
export type RecordExecutionTelemetryInput = z.input<typeof RecordExecutionTelemetryInputSchema>;

export const ResetCircuitBreakerInputSchema = z.object({
  personaId: z.string().min(1, 'Persona ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  justification: z
    .string()
    .min(5, 'Audit justification must be at least 5 characters (Rule 61)'),
});
export type ResetCircuitBreakerInput = z.input<typeof ResetCircuitBreakerInputSchema>;

export const EvaluateDiscrepancyInputSchema = z.object({
  executionId: z.string().min(1, 'Execution ID is required'),
  capabilityId: z.string().min(1, 'Capability ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  targetResource: z.string().min(1, 'Target resource is required'),
  targetId: z.string().min(1, 'Target ID is required'),
  predictedChange: z.record(z.string(), z.unknown()),
  actualChange: z.record(z.string(), z.unknown()),
  autoHeal: z.boolean().optional().default(true),
});
export type EvaluateDiscrepancyInput = z.input<typeof EvaluateDiscrepancyInputSchema>;

// ============================================================================
// 6. ERROR TAXONOMY (Rules 2, 48)
// ============================================================================

export const HEALTH_ERROR_CODES = {
  HEALTH_CIRCUIT_TRIPPED: 'HEALTH_CIRCUIT_TRIPPED',
  HEALTH_INVALID_JUSTIFICATION: 'HEALTH_INVALID_JUSTIFICATION',
  HEALTH_UNAUTHORIZED_RESET: 'HEALTH_UNAUTHORIZED_RESET',
  HEALTH_DEAD_MAN_PAUSED: 'HEALTH_DEAD_MAN_PAUSED',
  DISCREPANCY_REMEDIATION_FAILED: 'DISCREPANCY_REMEDIATION_FAILED',
  DISCREPANCY_NON_REMEDIABLE: 'DISCREPANCY_NON_REMEDIABLE',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  HEALTH_PERSONA_NOT_FOUND: 'HEALTH_PERSONA_NOT_FOUND',
  HEALTH_TIMEOUT: 'HEALTH_TIMEOUT',
} as const;

export type HealthErrorCode = (typeof HEALTH_ERROR_CODES)[keyof typeof HEALTH_ERROR_CODES];

const HEALTH_ERROR_STATUS_MAP: Record<HealthErrorCode, number> = {
  HEALTH_CIRCUIT_TRIPPED: 503,
  HEALTH_INVALID_JUSTIFICATION: 400,
  HEALTH_UNAUTHORIZED_RESET: 403,
  HEALTH_DEAD_MAN_PAUSED: 503,
  DISCREPANCY_REMEDIATION_FAILED: 500,
  DISCREPANCY_NON_REMEDIABLE: 409,
  IDOR_VIOLATION: 403,
  HEALTH_PERSONA_NOT_FOUND: 404,
  HEALTH_TIMEOUT: 504,
};

export class AgentHealthError extends Error {
  public readonly code: HealthErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: HealthErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AgentHealthError';
    this.code = code;
    this.statusCode = HEALTH_ERROR_STATUS_MAP[code] ?? 500;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentHealthError);
    }
  }
}
