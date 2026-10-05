/**
 * @fileOverview Canonical Revenue Swarm Contracts, Zod v4 Schemas & Error Taxonomy (Phase 10 Milestone 5)
 *
 * Implements:
 * - Rule 4: Zero `any`/`any[]` strict typing.
 * - Rule 8: Multi-tenant tenant boundaries (`organizationId`, `workspaceId`).
 * - Rule 9 & 23: Concurrency and query ceilings (targetLeadCount clamped to <= 50).
 * - Rule 10: Canonical Zod v4 schema contracts.
 * - Rule 12: Canonical risk classifications for multi-agent swarm operations.
 * - Rule 21 & 22: Two-phase human approval model with cryptographic SHA-256 payloadHash.
 * - Rule 41: Explainability invariant (WHAT / WHY / EXPECTED STATE CHANGE).
 * - Rule 42: Shadow Mode Blast Radius reporting.
 * - Rule 48: Structured error taxonomy and HTTP status code mappings.
 * - Rule 60: Emergency dead-man switch fail-closed error codes.
 */

import { z } from 'zod/v4';
import { OutreachChannelSchema } from '@/platform/agents/sales/outbound/sdr-outbound-types';
import { SALES_PERSONA_IDS } from '@/platform/agents/sales/personas/sales-persona-types';

// ============================================================================
// 1. SWARM STAGE & STATUS ENUMS
// ============================================================================

export const REVENUE_SWARM_STAGE_NAMES = [
  'discovery',
  'enrichment',
  'research',
  'qualification',
  'personalization',
  'staging',
] as const;

export const RevenueSwarmStageNameSchema = z.enum(REVENUE_SWARM_STAGE_NAMES);
export type RevenueSwarmStageName = z.infer<typeof RevenueSwarmStageNameSchema>;

export const REVENUE_SWARM_STAGE_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped',
] as const;

export const RevenueSwarmStageStatusSchema = z.enum(REVENUE_SWARM_STAGE_STATUSES);
export type RevenueSwarmStageStatus = z.infer<typeof RevenueSwarmStageStatusSchema>;

export const REVENUE_SWARM_STATUSES = [
  'completed',
  'waiting_for_approval',
  'failed',
  'cancelled',
] as const;

export const RevenueSwarmStatusSchema = z.enum(REVENUE_SWARM_STATUSES);
export type RevenueSwarmStatus = z.infer<typeof RevenueSwarmStatusSchema>;

// ============================================================================
// 2. STAGE RESULTS & CRITERIA SCHEMAS
// ============================================================================

export const RevenueSwarmCriteriaSchema = z.object({
  query: z.string().min(1, 'Query must not be empty'),
  targetIndustry: z.string().default('edtech'),
  geography: z.string().optional(),
  targetLeadCount: z.number().int().min(1).max(50).default(20),
  minQualificationScore: z.number().int().min(0).max(100).default(60),
  channels: z.array(OutreachChannelSchema).min(1).default(['whatsapp', 'email']),
  sdrPersonaId: z.enum(SALES_PERSONA_IDS).default('lead_sdr'),
  dryRun: z.boolean().default(true),
});
export type RevenueSwarmCriteria = z.infer<typeof RevenueSwarmCriteriaSchema>;

export const RevenueSwarmStageResultSchema = z.object({
  stage: RevenueSwarmStageNameSchema,
  status: RevenueSwarmStageStatusSchema,
  countIn: z.number().int().min(0),
  countOut: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  details: z.string().optional(),
  errors: z.array(z.string()).default([]),
});
export type RevenueSwarmStageResult = z.infer<typeof RevenueSwarmStageResultSchema>;

export const RevenueSwarmMissionInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  criteria: RevenueSwarmCriteriaSchema,
  authorizingUserId: z.string().optional(),
  now: z.string().datetime().optional(),
});
export type RevenueSwarmMissionInput = z.infer<typeof RevenueSwarmMissionInputSchema>;

export const RevenueSwarmBlastRadiusSchema = z.object({
  simulated: z.boolean(),
  targetedLeads: z.number().int().min(0),
  draftsGenerated: z.number().int().min(0),
  proposalsStaged: z.number().int().min(0),
  liveMutations: z.literal(0).or(z.number().int().min(0)),
  summary: z.string(),
});
export type RevenueSwarmBlastRadius = z.infer<typeof RevenueSwarmBlastRadiusSchema>;

export const StagedProposalSummarySchema = z.object({
  proposalId: z.string().min(1),
  payloadHash: z.string().min(1),
  status: z.string().min(1),
  recipientCount: z.number().int().min(0),
});
export type StagedProposalSummary = z.infer<typeof StagedProposalSummarySchema>;

export const RevenueSwarmOutcomeSchema = z.object({
  swarmRunId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  status: RevenueSwarmStatusSchema,
  stages: z.array(RevenueSwarmStageResultSchema),
  totalDiscovered: z.number().int().min(0),
  totalEnriched: z.number().int().min(0),
  totalQualified: z.number().int().min(0),
  totalDraftsGenerated: z.number().int().min(0),
  totalProposalsStaged: z.number().int().min(0),
  proposals: z.array(StagedProposalSummarySchema).default([]),
  payloadHash: z.string().min(1),
  isDryRun: z.boolean().default(true),
  blastRadius: RevenueSwarmBlastRadiusSchema,
  durationMs: z.number().int().min(0),
  createdAt: z.string().datetime(),
});
export type RevenueSwarmOutcome = z.infer<typeof RevenueSwarmOutcomeSchema>;

export const RevenueSwarmMetricsSchema = z.object({
  totalMissions: z.number().int().min(0),
  completedMissions: z.number().int().min(0),
  totalQualifiedLeads: z.number().int().min(0),
  totalDraftsGenerated: z.number().int().min(0),
  totalStagedProposals: z.number().int().min(0),
  lastRunTimestamp: z.string().datetime().nullable(),
});
export type RevenueSwarmMetrics = z.infer<typeof RevenueSwarmMetricsSchema>;

// ============================================================================
// 3. ERROR TAXONOMY & TYPED ERROR CLASS (Rule 48)
// ============================================================================

export const REVENUE_SWARM_ERROR_CODES = [
  'INVALID_CRITERIA',
  'DISCOVERY_FAILED',
  'ENRICHMENT_FAILED',
  'QUALIFICATION_FAILED',
  'PERSONALIZATION_FAILED',
  'STAGING_FAILED',
  'SWARM_DEAD_MAN_PAUSED',
  'SWARM_BUDGET_EXCEEDED',
  'SWARM_CANCELLED',
  'INTERNAL_SWARM_ERROR',
] as const;

export type RevenueSwarmErrorCode = (typeof REVENUE_SWARM_ERROR_CODES)[number];

export class RevenueSwarmError extends Error {
  public readonly code: RevenueSwarmErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: RevenueSwarmErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'RevenueSwarmError';
    this.code = code;
    this.statusCode = mapRevenueSwarmErrorToHttpStatus(code);
    this.details = details;
    Object.setPrototypeOf(this, RevenueSwarmError.prototype);
  }
}

export function mapRevenueSwarmErrorToHttpStatus(code: RevenueSwarmErrorCode): number {
  switch (code) {
    case 'INVALID_CRITERIA':
      return 400;
    case 'SWARM_DEAD_MAN_PAUSED':
      return 503;
    case 'SWARM_CANCELLED':
      return 499;
    case 'SWARM_BUDGET_EXCEEDED':
      return 429;
    case 'DISCOVERY_FAILED':
    case 'ENRICHMENT_FAILED':
    case 'QUALIFICATION_FAILED':
    case 'PERSONALIZATION_FAILED':
    case 'STAGING_FAILED':
    case 'INTERNAL_SWARM_ERROR':
    default:
      return 500;
  }
}
