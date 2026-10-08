/**
 * @fileOverview Canonical Evaluation Center UI Contracts, Schemas & Governance Matrices (Phase 15 Milestone 5)
 *
 * Implements Rules 1, 2, 4, 7, 8, 11, 12, 13, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 30,
 * 31, 32, 33, 40, 41, 42, 44, 46, 47, 48, 50, 51, 54, 55, 58, 59, 60, 61, 62, 63, 67, 68, 69, 1940-1953, 1965-1976.
 *
 * Strictly adheres to:
 * - `agents_mcp_ui.md` lines 3633–3670 (Agent Evaluation Center 7-View Cockpit & 5-Part Quality Header)
 * - `theme.md` §8 (Standardized Modal Architecture)
 * - Strict Zero `any` / `any[]` typing policy
 */

import { z } from 'zod/v4';
import {
  EvaluationDomainSchema,
  HumanVsAgentBaselineSchema,
  type HumanVsAgentBaseline,
} from '../contracts/evaluation-types';

// ============================================================================
// 1. 7 Canonical Evaluation Views (agents_mcp_ui.md 3645–3653)
// ============================================================================

export const EVALUATION_VIEW_TABS = [
  'benchmarks',
  'regression',
  'production_quality',
  'failures',
  'human_corrections',
  'cost_tokens',
  'latency_performance',
] as const;

export type EvaluationViewTab = (typeof EVALUATION_VIEW_TABS)[number];
export const EvaluationViewTabSchema = z.enum(EVALUATION_VIEW_TABS);

// ============================================================================
// 2. 5-Part Quality Cockpit Header Metrics (agents_mcp_ui.md 3658–3665)
// ============================================================================

export const AgentQualityKPIsSchema = z.object({
  taskSuccessRate: z.number().min(0).max(100), // Target: 96.2%
  toolCorrectnessRate: z.number().min(0).max(100), // Target: 98.7%
  policyViolationsCount: z.number().int().min(0), // Target: 0 (Zero Tolerance)
  humanCorrectionRate: z.number().min(0).max(100), // Target: <= 4.8%
  medianRuntimeSeconds: z.number().min(0), // Target: 18s
  totalRunsEvaluated: z.number().int().min(0),
  activePersonasCount: z.number().int().min(0),
});

export type AgentQualityKPIs = z.infer<typeof AgentQualityKPIsSchema>;

// ============================================================================
// 3. Filter State Schema
// ============================================================================

export const EvaluationFilterStateSchema = z.object({
  domain: z.string().optional(),
  personaId: z.string().optional(),
  status: z.enum(['ALL', 'PASS', 'FAIL']).optional(),
  view: EvaluationViewTabSchema.optional(),
  searchQuery: z.string().optional(),
  timeRange: z.enum(['24h', '7d', '30d', 'all']).optional(),
});

export type EvaluationFilterState = z.infer<typeof EvaluationFilterStateSchema>;

// ============================================================================
// 4. Incident Management Contracts (Rules 60, 61, 63, 1975)
// ============================================================================

export const INCIDENT_SEVERITIES = [
  'P0_CRITICAL',
  'P1_HIGH',
  'P2_MEDIUM',
  'P3_LOW',
] as const;

export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export const IncidentSeveritySchema = z.enum(INCIDENT_SEVERITIES);

export const INCIDENT_STATUSES = [
  'OPEN',
  'INVESTIGATING',
  'MITIGATED',
  'RESOLVED',
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export const IncidentStatusSchema = z.enum(INCIDENT_STATUSES);

export const EvaluationIncidentTicketSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  title: z.string().min(1),
  severity: IncidentSeveritySchema,
  status: IncidentStatusSchema,
  personaId: z.string().optional(),
  capabilityId: z.string().optional(),
  justification: z.string().min(5),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  resolvedAt: z.string().optional(),
  authorUserId: z.string().min(1),
  resolutionNotes: z.string().optional(),
});

export type EvaluationIncidentTicket = z.infer<typeof EvaluationIncidentTicketSchema>;

export const CreateIncidentInputSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1),
  severity: IncidentSeveritySchema,
  personaId: z.string().optional(),
  capabilityId: z.string().optional(),
  justification: z.string().min(5, 'Justification note must be at least 5 characters (Rule 61)'),
});

export type CreateIncidentInput = z.infer<typeof CreateIncidentInputSchema>;

export const ResolveIncidentInputSchema = z.object({
  incidentId: z.string().min(1),
  organizationId: z.string().min(1),
  resolutionNotes: z.string().min(5, 'Resolution notes must be at least 5 characters (Rule 61)'),
});

export type ResolveIncidentInput = z.infer<typeof ResolveIncidentInputSchema>;

// ============================================================================
// 5. 7-View Data Record Contracts
// ============================================================================

export const BenchmarkRunSummarySchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  domain: EvaluationDomainSchema,
  personaId: z.string().min(1),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  durationMs: z.number().min(0),
  tokensUsed: z.number().int().min(0),
  estimatedCostUsd: z.number().min(0),
  timestamp: z.string().min(1),
});

export type BenchmarkRunSummary = z.infer<typeof BenchmarkRunSummarySchema>;

export const RegressionTrendPointSchema = z.object({
  timestamp: z.string().min(1),
  commitSha: z.string().min(1),
  taskSuccessRate: z.number().min(0).max(100),
  toolCorrectnessRate: z.number().min(0).max(100),
  benchmarkScore: z.number().min(0).max(100),
});

export type RegressionTrendPoint = z.infer<typeof RegressionTrendPointSchema>;

export const FailureSummaryRecordSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  personaId: z.string().min(1),
  domain: EvaluationDomainSchema,
  errorCode: z.string().min(1),
  failureStrategy: z.string().min(1),
  rootCause: z.string().min(1),
  timestamp: z.string().min(1),
  dlqMessageId: z.string().optional(),
});

export type FailureSummaryRecord = z.infer<typeof FailureSummaryRecordSchema>;

export const HumanCorrectionRecordSchema = z.object({
  id: z.string().min(1),
  proposalId: z.string().min(1),
  personaId: z.string().min(1),
  domain: EvaluationDomainSchema,
  actionType: z.string().min(1),
  originalPayloadSummary: z.string().min(1),
  correctedPayloadSummary: z.string().min(1),
  rejectionReason: z.string().min(1),
  timestamp: z.string().min(1),
  reviewedByUserId: z.string().min(1),
});

export type HumanCorrectionRecord = z.infer<typeof HumanCorrectionRecordSchema>;

export const CostTokenMetricRecordSchema = z.object({
  personaId: z.string().min(1),
  modelTier: z.enum(['TIER_1_LOW_COST', 'TIER_2_GENERAL_REASONING', 'TIER_3_HIGH_END']),
  totalCostUsd: z.number().min(0),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  cachedTokens: z.number().int().min(0),
  runCount: z.number().int().min(0),
});

export type CostTokenMetricRecord = z.infer<typeof CostTokenMetricRecordSchema>;

export const LatencyPercentileRecordSchema = z.object({
  capabilityId: z.string().min(1),
  domain: EvaluationDomainSchema,
  p50Ms: z.number().min(0),
  p90Ms: z.number().min(0),
  p99Ms: z.number().min(0),
  sampleCount: z.number().int().min(0),
});

export type LatencyPercentileRecord = z.infer<typeof LatencyPercentileRecordSchema>;

export const BenchmarkRunDetailDataSchema = z.object({
  run: BenchmarkRunSummarySchema,
  scenario: z.record(z.string(), z.unknown()).nullable(),
  explainabilityGrid: z.object({
    what: z.string(),
    why: z.string(),
    expectedVsActual: z.string(),
    risk: z.string(),
  }),
  evaluationScores: z.object({
    taskCompletionScore: z.number(),
    toolSelectionScore: z.number(),
    policyCorrectnessScore: z.number(),
    evidenceGroundingScore: z.number(),
    compositeScore: z.number(),
  }),
  untrustedReferenceData: z.string(),
});

export type BenchmarkRunDetailData = z.infer<typeof BenchmarkRunDetailDataSchema>;

// ============================================================================
// 6. Comprehensive Dashboard Telemetry Contract
// ============================================================================

export const EvaluationDashboardTelemetrySchema = z.object({
  kpis: AgentQualityKPIsSchema,
  humanComparison: HumanVsAgentBaselineSchema,
  recentRuns: z.array(BenchmarkRunSummarySchema),
  openIncidents: z.array(EvaluationIncidentTicketSchema),
  deadManSwitches: z.record(z.string(), z.boolean()),
});

export type EvaluationDashboardTelemetry = z.infer<typeof EvaluationDashboardTelemetrySchema>;

// ============================================================================
// 7. Structured Error Taxonomy (Rule 48)
// ============================================================================

export const EVALUATION_UI_ERROR_CODES = {
  RUN_NOT_FOUND: 'EVALUATION_UI_RUN_NOT_FOUND',
  INCIDENT_NOT_FOUND: 'EVALUATION_UI_INCIDENT_NOT_FOUND',
  UNAUTHORIZED: 'EVALUATION_UI_UNAUTHORIZED',
  IDOR_VIOLATION: 'EVALUATION_UI_IDOR_VIOLATION',
  DEAD_MAN_PAUSED: 'EVALUATION_UI_DEAD_MAN_PAUSED',
  INVALID_INPUT: 'EVALUATION_UI_INVALID_INPUT',
  JUSTIFICATION_TOO_SHORT: 'EVALUATION_UI_JUSTIFICATION_TOO_SHORT',
  EXECUTION_FAILED: 'EVALUATION_UI_EXECUTION_FAILED',
} as const;

export type EvaluationUiErrorCode = (typeof EVALUATION_UI_ERROR_CODES)[keyof typeof EVALUATION_UI_ERROR_CODES];

export class EvaluationUiError extends Error {
  public readonly code: EvaluationUiErrorCode;
  public readonly httpStatus: number;

  constructor(code: EvaluationUiErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = 'EvaluationUiError';
    this.code = code;
    this.httpStatus = httpStatus;
    Object.setPrototypeOf(this, EvaluationUiError.prototype);
  }
}

// ============================================================================
// 8. The 4 Mandatory Governance Matrices (Rules 1940–1953)
// ============================================================================

/**
 * 8.1 EVALUATION_UI_PERMISSION_MATRIX (Rules 8, 16, 17)
 */
export const EVALUATION_UI_PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  all_agent_personas: ['intelligence:evaluation:view', 'workspace:read'],
  supervisor: ['intelligence:evaluation:view', 'workspace:read'],
  admin_user: [
    'intelligence:evaluation:view',
    'intelligence:evaluation:manage',
    'system_admin',
    'workspace:read',
  ],
};

/**
 * 8.2 EVALUATION_UI_TOOL_MATRIX (Rules 12, 14, 17)
 */
export const EVALUATION_UI_TOOL_MATRIX: Readonly<
  Record<
    string,
    {
      riskLevel: 'L0_READ' | 'L2_STATE_MUTATION';
      isDelegable: boolean;
      isIdempotent: boolean;
      auditRequired: boolean;
    }
  >
> = {
  'evaluation.ui.get_telemetry': {
    riskLevel: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: false,
  },
  'evaluation.ui.list_runs': {
    riskLevel: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: false,
  },
  'evaluation.ui.get_run_detail': {
    riskLevel: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: false,
  },
  'evaluation.ui.trigger_run': {
    riskLevel: 'L0_READ',
    isDelegable: false,
    isIdempotent: true,
    auditRequired: true,
  },
  'evaluation.ui.create_incident': {
    riskLevel: 'L2_STATE_MUTATION',
    isDelegable: false,
    isIdempotent: true,
    auditRequired: true,
  },
  'evaluation.ui.resolve_incident': {
    riskLevel: 'L2_STATE_MUTATION',
    isDelegable: false,
    isIdempotent: true,
    auditRequired: true,
  },
  'evaluation.ui.toggle_dead_man': {
    riskLevel: 'L2_STATE_MUTATION',
    isDelegable: false,
    isIdempotent: true,
    auditRequired: true,
  },
};

/**
 * 8.3 EVALUATION_UI_FAILURE_MATRIX (Rules 2, 24, 48)
 */
export const EVALUATION_UI_FAILURE_MATRIX: Readonly<
  Record<
    EvaluationUiErrorCode,
    {
      httpStatus: number;
      strategy: 'FAIL_CLOSED' | 'FAIL_GRACEFULLY' | 'TRIGGER_REVERSE_LIFO_SAGA' | 'FALLBACK_TO_DEFAULT';
    }
  >
> = {
  [EVALUATION_UI_ERROR_CODES.RUN_NOT_FOUND]: {
    httpStatus: 404,
    strategy: 'FAIL_GRACEFULLY',
  },
  [EVALUATION_UI_ERROR_CODES.INCIDENT_NOT_FOUND]: {
    httpStatus: 404,
    strategy: 'FAIL_GRACEFULLY',
  },
  [EVALUATION_UI_ERROR_CODES.UNAUTHORIZED]: {
    httpStatus: 403,
    strategy: 'FAIL_CLOSED',
  },
  [EVALUATION_UI_ERROR_CODES.IDOR_VIOLATION]: {
    httpStatus: 403,
    strategy: 'FAIL_CLOSED',
  },
  [EVALUATION_UI_ERROR_CODES.DEAD_MAN_PAUSED]: {
    httpStatus: 503,
    strategy: 'FAIL_CLOSED',
  },
  [EVALUATION_UI_ERROR_CODES.INVALID_INPUT]: {
    httpStatus: 400,
    strategy: 'FAIL_CLOSED',
  },
  [EVALUATION_UI_ERROR_CODES.JUSTIFICATION_TOO_SHORT]: {
    httpStatus: 400,
    strategy: 'FAIL_CLOSED',
  },
  [EVALUATION_UI_ERROR_CODES.EXECUTION_FAILED]: {
    httpStatus: 500,
    strategy: 'FAIL_CLOSED',
  },
};

/**
 * 8.4 EVALUATION_UI_ROLLBACK_MATRIX (Rule 27)
 */
export const EVALUATION_UI_ROLLBACK_MATRIX: Readonly<Record<string, string | null>> = {
  'evaluation.ui.create_incident': 'evaluation.ui.cancel_incident',
  'evaluation.ui.resolve_incident': 'evaluation.ui.reopen_incident',
  'evaluation.ui.toggle_dead_man': 'evaluation.ui.restore_dead_man_state',
  'evaluation.ui.get_telemetry': null, // noop read
  'evaluation.ui.list_runs': null, // noop read
  'evaluation.ui.get_run_detail': null, // noop read
  'evaluation.ui.trigger_run': null, // dryRun: true produces zero database writes
};
