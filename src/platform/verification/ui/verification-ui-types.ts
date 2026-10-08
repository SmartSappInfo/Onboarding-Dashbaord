/**
 * @fileOverview Canonical Contracts & Types for Verification UI, Execution Inspector & Health Dashboard (Phase 14 Milestone 5)
 *
 * Implements:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first & tactile design, everyday UI English.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 12: Canonical Risk Vocabulary (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`).
 * - Rule 14: Schema Fingerprinting & Contracts (Zod v4 bounded schemas).
 * - Rule 17: Non-Delegable Actions (Human-only circuit reset).
 * - Rule 18: TOCTOU Optimistic Concurrency Guard (VersionValidationResult integration).
 * - Rule 21: Two-Phase Execution (6-Step Loop: Plan, Predict, Execute, Verify, Commit, Learn).
 * - Rule 24: Dynamic Circuit Breakers (`CLOSED`, `DEGRADED`, `OPEN`, `HALF_OPEN`).
 * - Rule 25: Dead-Letter Queue (DLQ) Integration.
 * - Rule 27: Universal Reverse-LIFO Saga Compensation.
 * - Rule 41: Explainability Grid (WHAT / WHY / EXPECTED STATE CHANGE / CONFIDENCE).
 * - Rule 42: Shadow Mode Auto-Degradation (`dryRun: true`, zero live database writes).
 * - Rule 48: Sanitized Error Taxonomy & HTTP Status Mapping.
 * - Rule 61: Three-Zone Enterprise Mission Control Cockpit.
 * - Rule 62: Real-time SSE Streaming Reactivity.
 * - `docs/agents_mcp/agents_mcp_ui.md` (3598–3630).
 * - `theme.md` §8 (Standardized Modal & Dialog System Architecture).
 * - `.agents/AGENTS.md` (Workspace Rules).
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded schemas only.
 */

import { z } from 'zod/v4';
import { RISK_LEVELS, type RiskLevel } from '@/platform/capabilities/contracts/risk-levels';
import {
  VerificationResultSchema,
  type VerificationResult,
} from '@/platform/verification/verification-types';
import {
  type VersionValidationResult,
} from '@/platform/verification/concurrency/state-version-types';
import {
  DiscrepancyReportSchema,
  type DiscrepancyReport,
  type CircuitState,
  type AgentHealthScorecard,
} from '@/platform/verification/health/health-types';

// ============================================================================
// 1. EXECUTION INSPECTOR STEPPER ZONES (agents_mcp_ui.md 3604–3611)
// ============================================================================

export const ExecutionInspectorZoneSchema = z.enum([
  'PLAN',
  'ACTIONS',
  'PREDICT',
  'EXECUTE',
  'VERIFY',
  'COMPENSATE',
]);
export type ExecutionInspectorZone = z.infer<typeof ExecutionInspectorZoneSchema>;

// ============================================================================
// 2. DOMAIN & STATUS FILTER SCHEMAS FOR FLEET DASHBOARD
// ============================================================================

export const AgentHealthDomainFilterSchema = z.enum([
  'ALL',
  'CRM',
  'SALES',
  'MEETINGS',
  'KNOWLEDGE',
  'FINANCE',
  'SCHOOL',
  'SUPERVISOR',
]);
export type AgentHealthDomainFilter = z.infer<typeof AgentHealthDomainFilterSchema>;

export const AgentHealthStatusFilterSchema = z.enum([
  'ALL',
  'HEALTHY',
  'DEGRADED',
  'TRIPPED',
  'SHADOW_MODE',
]);
export type AgentHealthStatusFilter = z.infer<typeof AgentHealthStatusFilterSchema>;

export const AgentHealthFilterStateSchema = z.object({
  status: AgentHealthStatusFilterSchema.default('ALL'),
  domain: AgentHealthDomainFilterSchema.default('ALL'),
  searchQuery: z.string().default(''),
});
export type AgentHealthFilterState = z.infer<typeof AgentHealthFilterStateSchema>;

// ============================================================================
// 3. EXECUTION INSPECTOR SUB-SCHEMAS (Rules 14, 21, 41)
// ============================================================================

export const ExecutionInspectorStepSchema = z.object({
  stepId: z.string().min(1, 'stepId is required'),
  capabilityId: z.string().min(1, 'capabilityId is required'),
  status: z.enum(['SUCCESS', 'FAILED', 'COMPENSATED', 'SKIPPED']),
  inputPayload: z.record(z.string(), z.unknown()),
  outputPayload: z.record(z.string(), z.unknown()).optional(),
  executedAt: z.string(),
  durationMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
});
export type ExecutionInspectorStep = z.infer<typeof ExecutionInspectorStepSchema>;

export const ExecutionInspectorPlanSchema = z.object({
  goal: z.string().min(1, 'Goal is required'),
  rationale: z.string().default(''),
  personaId: z.string().min(1, 'Persona ID is required'),
  riskLevel: z.enum(RISK_LEVELS),
  budgetTokens: z.number().int().positive(),
  targetSubject: z.string().optional(),
});
export type ExecutionInspectorPlan = z.infer<typeof ExecutionInspectorPlanSchema>;

export const ExecutionInspectorPredictSchema = z.object({
  predictedStateChange: z.record(z.string(), z.unknown()),
  expectedVersion: z.union([z.number(), z.string()]).optional(),
  stateHash: z.string().length(64).optional(),
  blastRadius: z.record(z.string(), z.unknown()).optional(),
});
export type ExecutionInspectorPredict = z.infer<typeof ExecutionInspectorPredictSchema>;

export const ExecutionInspectorExecuteSchema = z.object({
  output: z.record(z.string(), z.unknown()),
  durationMs: z.number().nonnegative(),
  tokensUsed: z.number().int().nonnegative(),
  liveWritesCount: z.number().int().nonnegative(),
  error: z.string().optional(),
});
export type ExecutionInspectorExecute = z.infer<typeof ExecutionInspectorExecuteSchema>;

export const ExecutionInspectorVerifySchema = z.object({
  result: VerificationResultSchema,
  versionResult: z.custom<VersionValidationResult>().optional(),
  discrepancyReport: DiscrepancyReportSchema.optional(),
});

export interface ExecutionInspectorVerify {
  result: VerificationResult;
  versionResult?: VersionValidationResult;
  discrepancyReport?: DiscrepancyReport;
}

export const ExecutionInspectorCompensatingStepSchema = z.object({
  stepId: z.string().min(1),
  capabilityId: z.string().min(1),
  status: z.string().min(1),
  error: z.string().optional(),
});
export type ExecutionInspectorCompensatingStep = z.infer<
  typeof ExecutionInspectorCompensatingStepSchema
>;

export const ExecutionInspectorCompensateSchema = z.object({
  required: z.boolean(),
  executed: z.boolean(),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'SKIPPED']).optional(),
  compensatingSteps: z.array(ExecutionInspectorCompensatingStepSchema).optional(),
  dlqEnqueued: z.boolean().optional(),
  error: z.string().optional(),
});
export type ExecutionInspectorCompensate = z.infer<typeof ExecutionInspectorCompensateSchema>;

// ============================================================================
// 4. CANONICAL EXECUTION INSPECTOR DATA CONTRACT
// ============================================================================

export const ExecutionInspectorOverallStatusSchema = z.enum([
  'PASS',
  'FAIL',
  'DEGRADED',
  'SHADOW_MODE',
]);
export type ExecutionInspectorOverallStatus = z.infer<
  typeof ExecutionInspectorOverallStatusSchema
>;

export const ExecutionInspectorDataSchema = z.object({
  executionId: z.string().min(1, 'executionId is required'),
  runId: z.string().optional(),
  personaId: z.string().min(1, 'personaId is required'),
  capabilityId: z.string().min(1, 'capabilityId is required'),
  status: ExecutionInspectorOverallStatusSchema,
  plan: ExecutionInspectorPlanSchema,
  actions: z.array(ExecutionInspectorStepSchema),
  predict: ExecutionInspectorPredictSchema,
  execute: ExecutionInspectorExecuteSchema,
  verify: ExecutionInspectorVerifySchema,
  compensate: ExecutionInspectorCompensateSchema,
  executedAt: z.string().optional(),
});

export interface ExecutionInspectorData {
  executionId: string;
  runId?: string;
  personaId: string;
  capabilityId: string;
  status: ExecutionInspectorOverallStatus;
  plan: ExecutionInspectorPlan;
  actions: ExecutionInspectorStep[];
  predict: ExecutionInspectorPredict;
  execute: ExecutionInspectorExecute;
  verify: ExecutionInspectorVerify;
  compensate: ExecutionInspectorCompensate;
  executedAt?: string;
}

// ============================================================================
// 5. ERROR TAXONOMY FOR VERIFICATION UI (Rule 48)
// ============================================================================

export const VERIFICATION_UI_ERROR_CODES = {
  VERIFICATION_UI_NOT_FOUND: 'VERIFICATION_UI_NOT_FOUND',
  VERIFICATION_UI_INVALID_INPUT: 'VERIFICATION_UI_INVALID_INPUT',
  VERIFICATION_UI_RENDER_FAILED: 'VERIFICATION_UI_RENDER_FAILED',
  HEALTH_UNAUTHORIZED_RESET: 'HEALTH_UNAUTHORIZED_RESET',
  HEALTH_INVALID_JUSTIFICATION: 'HEALTH_INVALID_JUSTIFICATION',
  HEALTH_DEAD_MAN_PAUSED: 'HEALTH_DEAD_MAN_PAUSED',
  SSE_STREAM_DISCONNECTED: 'SSE_STREAM_DISCONNECTED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
} as const;

export type VerificationUiErrorCode =
  (typeof VERIFICATION_UI_ERROR_CODES)[keyof typeof VERIFICATION_UI_ERROR_CODES];

export class VerificationUiError extends Error {
  public readonly code: VerificationUiErrorCode;
  public readonly statusCode: number;

  constructor(code: VerificationUiErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = 'VerificationUiError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, VerificationUiError.prototype);
  }
}

// Re-export core types for direct convenience
export type {
  RiskLevel,
  VerificationResult,
  VersionValidationResult,
  DiscrepancyReport,
  CircuitState,
  AgentHealthScorecard,
};
