/**
 * @fileoverview Canonical Contracts, Zod v4 Schemas & Error Taxonomy for Multi-Agent Finance Swarm
 *
 * Part of Phase 12 Milestone 5: Autonomous Multi-Agent Finance Swarm Orchestrator.
 *
 * Invariants Enforced:
 * 1. Rule 4: Zero `any` or `any[]` typing policy.
 * 2. Rule 10: Strict runtime validation using Zod v4.
 * 3. Rule 23: Clamped execution budgets (tokens <= 4,000, duration <= 30s).
 * 4. Rule 42: Shadow Mode simulation reporting (0 live writes when dryRun: true).
 * 5. Rule 48: Standardized error taxonomy mapping to HTTP status codes.
 */

import { z } from 'zod/v4';

/**
 * Canonical 5-Stage Swarm Pipeline Names.
 */
export const FinanceSwarmStageNameSchema = z.enum([
  'BILLING_VERIFICATION',
  'RECONCILIATION_AUDIT',
  'COLLECTIONS_ESCALATION',
  'SCHOOL_OPERATIONS_CORRELATION',
  'CASH_FLOW_FORECAST',
]);
export type FinanceSwarmStageName = z.infer<typeof FinanceSwarmStageNameSchema>;

/**
 * Swarm Mission Input Schema.
 */
export const FinanceSwarmMissionInputSchema = z.object({
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  operatorUserId: z.string().min(1),
  missionGoal: z.string().min(1),
  dryRun: z.boolean().default(false),
  maxBudgetTokens: z.number().int().min(500).max(4000).default(4000),
});
export type FinanceSwarmMissionInput = z.infer<typeof FinanceSwarmMissionInputSchema>;

/**
 * Stage Execution Result Schema.
 */
export const FinanceSwarmStageResultSchema = z.object({
  stageName: FinanceSwarmStageNameSchema,
  assignedPersona: z.string().min(1),
  status: z.enum(['SUCCESS', 'FAILED', 'SKIPPED']),
  durationMs: z.number().min(0),
  recordsEvaluated: z.number().int().min(0),
  summary: z.string().min(1),
});
export type FinanceSwarmStageResult = z.infer<typeof FinanceSwarmStageResultSchema>;

/**
 * Shadow Mode Blast Radius Report Schema (Rule 42).
 */
export const BlastRadiusReportSchema = z.object({
  liveDatabaseWritesCount: z.number().int().min(0),
  interceptedMutationsCount: z.number().int().min(0),
  targetedDomains: z.array(z.string()),
  financialExposure: z.number().min(0),
  summary: z.string().min(1),
});
export type BlastRadiusReport = z.infer<typeof BlastRadiusReportSchema>;

/**
 * Swarm Aggregated Execution Metrics Schema.
 */
export const FinanceSwarmMetricsSchema = z.object({
  totalDurationMs: z.number().min(0),
  totalTokensUsed: z.number().min(0),
  completedStagesCount: z.number().int().min(0),
  anomaliesFoundCount: z.number().int().min(0),
  proposalsFormulatedCount: z.number().int().min(0),
});
export type FinanceSwarmMetrics = z.infer<typeof FinanceSwarmMetricsSchema>;

/**
 * Complete Swarm Mission Run Result Schema.
 */
export const FinanceSwarmRunResultSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(['COMPLETED', 'FAILED', 'CANCELLED']),
  isSimulation: z.boolean(),
  stages: z.array(FinanceSwarmStageResultSchema),
  metrics: FinanceSwarmMetricsSchema,
  blastRadiusReport: BlastRadiusReportSchema.optional(),
  explainabilitySummary: z.string().min(1),
  executedAt: z.string().datetime(),
});
export type FinanceSwarmRunResult = z.infer<typeof FinanceSwarmRunResultSchema>;

/**
 * Swarm Error Taxonomy (Rule 48).
 */
export const SWARM_ERROR_CODES = {
  SWARM_CANCELLED: 'SWARM_CANCELLED',
  SWARM_DEAD_MAN_PAUSED: 'SWARM_DEAD_MAN_PAUSED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  STAGE_FAILED: 'STAGE_FAILED',
  CROSS_TENANT_ACCESS_DENIED: 'CROSS_TENANT_ACCESS_DENIED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type SwarmErrorCode = (typeof SWARM_ERROR_CODES)[keyof typeof SWARM_ERROR_CODES];

export class FinanceSwarmError extends Error {
  public readonly code: SwarmErrorCode;
  public readonly httpStatus: number;

  constructor(code: SwarmErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = 'FinanceSwarmError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
