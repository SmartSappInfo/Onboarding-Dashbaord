/**
 * @fileOverview Canonical Evaluation Contracts, Schemas & Error Taxonomy (Phase 15 Milestone 1)
 *
 * Implements Rules 1, 4, 8, 11, 12, 14, 16, 17, 19, 22, 23, 26, 40, 42, 44, 47, 48, 59, 60, 67, 68, 69.
 * Provides the single source of truth contracts for the Continuous Evaluation Engine,
 * Multi-Domain Gold-Standard Benchmark Harness, and Human vs Agent Baseline Engine.
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod/v4';

// ============================================================================
// Constants & Governance Boundaries
// ============================================================================

export const MAX_EVALUATION_SCENARIO_TIMEOUT_MS = 30000;
export const MAX_EVALUATION_BATCH_CONCURRENCY = 10;
export const EPSILON_DIVISION_GUARD = 0.001;
export const EVALUATION_PASS_THRESHOLD_SCORE = 80;

/**
 * 7 Canonical Operational Domains for Evaluation.
 */
export const EVALUATION_DOMAINS = [
  'crm',
  'sales',
  'meetings',
  'knowledge',
  'finance',
  'school',
  'supervisor',
] as const;

export type EvaluationDomain = (typeof EVALUATION_DOMAINS)[number];
export const EvaluationDomainSchema = z.enum(EVALUATION_DOMAINS);

/**
 * Canonical Evaluation Metric Categories.
 */
export const EVALUATION_METRIC_CATEGORIES = [
  'TASK_COMPLETION',
  'TOOL_SELECTION',
  'POLICY_CORRECTNESS',
  'STATE_CORRECTNESS',
  'EVIDENCE_GROUNDING',
  'HALLUCINATION',
  'LATENCY',
  'COST',
  'RECOVERY',
] as const;

export type EvaluationMetricCategory = (typeof EVALUATION_METRIC_CATEGORIES)[number];
export const EvaluationMetricCategorySchema = z.enum(EVALUATION_METRIC_CATEGORIES);
export const EvaluationCategorySchema = EvaluationMetricCategorySchema;
export type EvaluationCategory = EvaluationMetricCategory;

/**
 * Canonical Risk Levels for Capabilities.
 */
export const EVALUATION_RISK_LEVELS = [
  'L0_READ',
  'L1_INTERNAL_DRAFT',
  'L2_STATE_MUTATION',
  'L3_EXTERNAL_COMMUNICATION_FINANCE',
  'L4_PRIVILEGED_DESTRUCTIVE',
] as const;

export type EvaluationRiskLevel = (typeof EVALUATION_RISK_LEVELS)[number];
export const EvaluationRiskLevelSchema = z.enum(EVALUATION_RISK_LEVELS);

// ============================================================================
// Human Baseline Telemetry Contract (Roadmap §16)
// ============================================================================

export const HumanBaselineTelemetrySchema = z.object({
  humanTimeSeconds: z.number().min(1),
  humanErrorRate: z.number().min(0).max(100),
  humanSourcesConsulted: z.number().int().min(1),
  totalSourcesAvailable: z.number().int().min(1),
});

export type HumanBaselineTelemetry = z.infer<typeof HumanBaselineTelemetrySchema>;

// ============================================================================
// Evaluation Scenario Contract (Roadmap §15)
// ============================================================================

export const EvaluationScenarioSchema = z.object({
  id: z.string().min(1),
  domain: EvaluationDomainSchema,
  category: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  inputQuery: z.string().min(1),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  groundTruthFacts: z.array(z.string().min(1)).min(1),
  expectedPersona: z.string().min(1),
  expectedRiskLevel: EvaluationRiskLevelSchema,
  allowedCapabilities: z.array(z.string().min(1)).min(1),
  forbiddenCapabilities: z.array(z.string().min(1)).default([]),
  expectedIntermediateActions: z.array(z.string().min(1)).default([]),
  expectedFinalState: z.record(z.string(), z.unknown()).default({}),
  expectedEvidenceKeys: z.array(z.string().min(1)).default([]),
  expectedOutputContains: z.array(z.string().min(1)).default([]),
  adversarialDirectives: z.array(z.string().min(1)).default([]),
  humanBaseline: HumanBaselineTelemetrySchema,
});

export type EvaluationScenario = z.infer<typeof EvaluationScenarioSchema>;

// ============================================================================
// Metric Score Contract
// ============================================================================

export const EvaluationMetricScoreSchema = z.object({
  metric: EvaluationMetricCategorySchema,
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  weight: z.number().min(0).max(1),
  details: z.string(),
  violations: z.array(z.string()),
});

export type EvaluationMetricScore = z.infer<typeof EvaluationMetricScoreSchema>;

// ============================================================================
// Evaluation Run Contract (Rule 42 Shadow Mode Sandboxing)
// ============================================================================

export const EvaluationRunSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  personaId: z.string().min(1),
  domain: EvaluationDomainSchema,
  status: z.enum(['SUCCESS', 'FAILURE', 'DEGRADED']),
  overallScore: z.number().min(0).max(100),
  durationMs: z.number().min(0),
  dryRun: z.literal(true), // Rule 42 strict dry-run enforcement
  liveWritesCount: z.literal(0), // Rule 42 zero live database writes invariant
  toolCallsCount: z.number().int().min(0),
  unnecessaryToolCallsCount: z.number().int().min(0),
  costMicroUSD: z.number().min(0),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  startedAt: z.string(),
  completedAt: z.string(),
  executedBy: z.string().min(1),
  metricScores: z.array(EvaluationMetricScoreSchema),
  failureReasons: z.array(z.string()),
  auditHash: z.string().min(1),
});

export type EvaluationRun = z.infer<typeof EvaluationRunSchema>;

// ============================================================================
// Benchmark Comparison Contract
// ============================================================================

export const BenchmarkComparisonSchema = z.object({
  domain: EvaluationDomainSchema,
  scenarioCount: z.number().int().min(0),
  passRate: z.number().min(0).max(100),
  avgTaskCompletion: z.number().min(0).max(100),
  avgToolSelectionAccuracy: z.number().min(0).max(100),
  avgGroundingScore: z.number().min(0).max(100),
  totalCostMicroUSD: z.number().min(0),
  avgDurationMs: z.number().min(0),
});

export type BenchmarkComparison = z.infer<typeof BenchmarkComparisonSchema>;

// ============================================================================
// Human vs Agent Baseline Contract (Roadmap §16)
// ============================================================================

export const HumanVsAgentBaselineSchema = z.object({
  scenarioId: z.string().min(1),
  domain: EvaluationDomainSchema,
  humanTimeSeconds: z.number().min(0),
  agentTimeSeconds: z.number().min(0),
  speedupFactor: z.number().min(0),
  humanErrorRate: z.number().min(0).max(100),
  agentErrorRate: z.number().min(0).max(100),
  errorReductionPercentage: z.number().max(100),
  humanSourcesConsulted: z.number().int().min(0),
  agentSourcesConsulted: z.number().int().min(0),
  contextBreadthFactor: z.number().min(0),
});

export type HumanVsAgentBaseline = z.infer<typeof HumanVsAgentBaselineSchema>;

// ============================================================================
// Batch Run Input Contract
// ============================================================================

export const EvaluationBatchRunInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  scenarioIds: z.array(z.string().min(1)).optional(),
  domainFilter: EvaluationDomainSchema.optional(),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(MAX_EVALUATION_SCENARIO_TIMEOUT_MS)
    .optional()
    .default(MAX_EVALUATION_SCENARIO_TIMEOUT_MS),
  maxConcurrency: z
    .number()
    .int()
    .min(1)
    .max(MAX_EVALUATION_BATCH_CONCURRENCY)
    .optional()
    .default(MAX_EVALUATION_BATCH_CONCURRENCY),
});

export type EvaluationBatchRunInput = z.input<typeof EvaluationBatchRunInputSchema>;
export type EvaluationBatchRunParsed = z.output<typeof EvaluationBatchRunInputSchema>;

// ============================================================================
// Structured Error Taxonomy (Rule 48)
// ============================================================================

export const EVALUATION_ERROR_CODES = {
  EVALUATION_SCENARIO_NOT_FOUND: 'EVALUATION_SCENARIO_NOT_FOUND',
  EVALUATION_LIVE_WRITE_FORBIDDEN: 'EVALUATION_LIVE_WRITE_FORBIDDEN',
  EVALUATION_TIMEOUT: 'EVALUATION_TIMEOUT',
  EVALUATION_DEAD_MAN_PAUSED: 'EVALUATION_DEAD_MAN_PAUSED',
  EVALUATION_POLICY_VIOLATION: 'EVALUATION_POLICY_VIOLATION',
  EVALUATION_GROUNDING_FAILED: 'EVALUATION_GROUNDING_FAILED',
  EVALUATION_IDOR_VIOLATION: 'EVALUATION_IDOR_VIOLATION',
  EVALUATION_RUN_ABORTED: 'EVALUATION_RUN_ABORTED',
  INVALID_INPUT: 'INVALID_INPUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type EvaluationErrorCode = keyof typeof EVALUATION_ERROR_CODES;

export class AgentEvaluationError extends Error {
  public readonly code: EvaluationErrorCode;
  public readonly httpStatus: number;

  constructor(code: EvaluationErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = 'AgentEvaluationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ============================================================================
// The 4 Mandatory Governance Matrices (Rules 1940–1953)
// ============================================================================

/**
 * 1. Evaluation Permission Matrix (Rule 16)
 */
export const EVALUATION_PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  admin_user: [
    'evaluation:read',
    'evaluation:manage',
    'workspace:read',
    'workspace:manage',
    'system_admin',
  ],
  operator: [
    'evaluation:read',
    'evaluation:manage',
    'workspace:read',
  ],
  supervisor: [
    'evaluation:read',
    'workspace:read',
  ],
  evaluator_agent: [
    'evaluation:read',
    'workspace:read',
  ],
};

/**
 * 2. Evaluation Tool Matrix (Rules 14 & 59)
 */
export const EVALUATION_TOOL_MATRIX: Readonly<
  Record<
    string,
    {
      readonly level: 'L0_READ' | 'L1_INTERNAL_DRAFT' | 'L2_STATE_MUTATION';
      readonly isDelegable: boolean;
      readonly isIdempotent: boolean;
      readonly description: string;
    }
  >
> = {
  'evaluation.run_scenario': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: true,
    description:
      'Executes a single gold-standard evaluation scenario in dry-run mode and grades task, tool, policy, and grounding metrics.',
  },
  'evaluation.run_batch': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: true,
    description:
      'Executes a batch or domain suite of gold-standard evaluation scenarios in dry-run mode.',
  },
  'evaluation.get_benchmark_summary': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: true,
    description:
      'Calculates and retrieves aggregate domain-level benchmark metrics and pass rates.',
  },
  'evaluation.get_run_result': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: true,
    description:
      'Fetches detailed evaluation scores, metric breakdowns, and failure reasons for a run.',
  },
  'evaluation.get_human_agent_baseline': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: true,
    description:
      'Computes Speedup Factor, Error Rate Reduction, and Context Breadth Factor comparing human vs agent.',
  },
};

/**
 * 3. Evaluation Failure Matrix (Rules 2 & 48)
 */
export type EvaluationFailureRecoveryStrategy =
  | 'FAIL_CLOSED'
  | 'DEGRADE_GRACEFULLY'
  | 'RETRY_WITH_BACKOFF';

export const EVALUATION_FAILURE_MATRIX: Readonly<
  Record<EvaluationErrorCode, EvaluationFailureRecoveryStrategy>
> = {
  EVALUATION_SCENARIO_NOT_FOUND: 'FAIL_CLOSED',
  EVALUATION_LIVE_WRITE_FORBIDDEN: 'FAIL_CLOSED', // Rule 42 critical stop
  EVALUATION_TIMEOUT: 'DEGRADE_GRACEFULLY',
  EVALUATION_DEAD_MAN_PAUSED: 'FAIL_CLOSED', // Rule 60 fail-closed
  EVALUATION_POLICY_VIOLATION: 'FAIL_CLOSED',
  EVALUATION_GROUNDING_FAILED: 'DEGRADE_GRACEFULLY',
  EVALUATION_IDOR_VIOLATION: 'FAIL_CLOSED', // Rule 8 fail-closed
  EVALUATION_RUN_ABORTED: 'FAIL_CLOSED', // Rule 26 cooperative cancellation
  INVALID_INPUT: 'FAIL_CLOSED',
  INTERNAL_ERROR: 'FAIL_CLOSED',
};

/**
 * 4. Evaluation Rollback Matrix (Rule 27)
 *
 * Invariant: Evaluation operations strictly run with dryRun: true and have zero database writes.
 * The compensating transaction is an auditable no-op compensation that logs execution completion.
 */
export const EVALUATION_ROLLBACK_MATRIX: Readonly<Record<string, string>> = {
  'evaluation.run_scenario': 'evaluation.run.noop_compensation',
  'evaluation.run_batch': 'evaluation.run.noop_compensation',
};
