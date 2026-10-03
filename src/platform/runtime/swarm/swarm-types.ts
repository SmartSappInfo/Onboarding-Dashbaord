/**
 * @fileOverview Canonical Swarm Contracts, Topologies & Error Taxonomy (Phase 6 Milestone 5)
 *
 * Implements Rules 4, 8, 9, 10, 13, 16, 21, 22, 23, 26, 40, 47, and 60.
 * Defines the canonical contracts for Multi-Agent Swarm Orchestration,
 * Dynamic Topology Routing, and Structured Multi-Agent Handoffs.
 *
 * CANONICAL TOPOLOGIES:
 * 1. `hierarchical`: Supervisor agent decomposes goals, assigns sub-goals to specialists, and aggregates results.
 * 2. `pipeline`: Sequential multi-agent pipeline where output of Agent A feeds into Agent B feeds into Agent C.
 * 3. `mesh_consensus`: Concurrent dispatch of multi-domain specialists followed by consensus synthesis and divergence analysis.
 * 4. `dynamic_dag`: Graph-based execution where intermediate post-condition verifications conditionally determine next specialist nodes.
 *
 * STRICT TYPING POLICY:
 * Zero `any` or `any[]`. Bounded schemas only.
 */

import { z } from 'zod/v4';
import { AGENT_PERSONA_IDS } from '@/platform/identity/agent-persona-types';

// ============================================================================
// 1. SWARM TOPOLOGY & STATUS ENUMS
// ============================================================================

export const SWARM_TOPOLOGIES = [
  'hierarchical',
  'pipeline',
  'mesh_consensus',
  'dynamic_dag',
] as const;

export const SwarmTopologySchema = z.enum(SWARM_TOPOLOGIES);
export type SwarmTopology = z.infer<typeof SwarmTopologySchema>;

export const SWARM_RUN_STATUSES = [
  'created',
  'planning',
  'executing',
  'waiting_for_approval',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
] as const;

export const SwarmRunStatusSchema = z.enum(SWARM_RUN_STATUSES);
export type SwarmRunStatus = z.infer<typeof SwarmRunStatusSchema>;

// ============================================================================
// 2. ERROR TAXONOMY (Rules 48 & 60)
// ============================================================================

export const SWARM_ERROR_CODES = [
  'HANDOFF_REJECTED',
  'SPECIALIST_UNAUTHORIZED',
  'TOPOLOGY_CYCLE_DETECTED',
  'CONSENSUS_FAILED',
  'SWARM_BUDGET_EXCEEDED',
  'SWARM_TIMEOUT',
  'SWARM_DEAD_MAN_PAUSED',
  'SWARM_APPROVAL_REQUIRED',
  'INVALID_SWARM_STATE',
  'SPECIALIST_EXECUTION_FAILED',
  'HANDOFF_PAYLOAD_POISONED',
  'TOCTOU_CONCURRENCY_ERROR',
] as const;

export type SwarmErrorCode = (typeof SWARM_ERROR_CODES)[number];

export interface SwarmErrorDetails {
  readonly code: SwarmErrorCode;
  readonly message: string;
  readonly swarmRunId?: string;
  readonly missionId?: string;
  readonly specialistId?: string;
  readonly details?: Record<string, unknown>;
}

export class SwarmError extends Error {
  public readonly code: SwarmErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: SwarmErrorCode, message: string, details?: Record<string, unknown>) {
    super(`[${code}] ${message}`);
    this.name = 'SwarmError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// 3. HANDOFF CONTRACT (Rules 13, 16, 30, 40)
// ============================================================================

export const SwarmHandoffSchema = z.object({
  handoffId: z.string().min(1),
  fromAgentId: z.string().min(1),
  toAgentId: z.string().min(1),
  handoffReason: z.string().min(1),
  transferredState: z.record(z.string(), z.unknown()),
  isolatedXmlState: z.string().min(1),
  delegationGrantId: z.string().optional(),
  delegationChain: z.array(z.string()).min(1),
  suggestedCapabilities: z.array(z.string()).default([]),
  boundaryConstraints: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});

export type SwarmHandoff = z.infer<typeof SwarmHandoffSchema>;

// ============================================================================
// 4. CONSENSUS & MULTI-PERSPECTIVE SYNTHESIS (Rules 41 & 47)
// ============================================================================

export const SpecialistPerspectiveSchema = z.object({
  specialistId: z.string().min(1),
  viewpoint: z.string().min(1),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'critical']).default('neutral'),
  confidenceScore: z.number().min(0).max(1).optional(),
  recommendations: z.array(z.string()).default([]),
  emittedWarnings: z.array(z.string()).default([]),
});

export type SpecialistPerspective = z.infer<typeof SpecialistPerspectiveSchema>;

export const SwarmConsensusSchema = z.object({
  consensusSummary: z.string().min(1),
  confidenceScore: z.number().min(0).max(1).default(0.8),
  specialistPerspectives: z.array(SpecialistPerspectiveSchema).min(1),
  divergencePoints: z.array(z.string()).default([]),
  recommendedAction: z.string().min(1),
  synthesizedAt: z.string().datetime().default(() => new Date().toISOString()),
});

export type SwarmConsensus = z.infer<typeof SwarmConsensusSchema>;

// ============================================================================
// 5. MISSION & RUN CONTRACTS (Rules 8, 9, 23, 47)
// ============================================================================

export const SwarmBudgetsSchema = z.object({
  maxDurationMs: z.number().int().min(5000).max(120000).default(75000),
  maxTokens: z.number().int().min(1000).max(150000).default(50000),
  maxToolCalls: z.number().int().min(1).max(50).default(20),
});

export type SwarmBudgets = z.infer<typeof SwarmBudgetsSchema>;

export const SwarmBudgetUsageSchema = z.object({
  tokensUsed: z.number().int().min(0).default(0),
  toolCallsExecuted: z.number().int().min(0).default(0),
  durationMs: z.number().int().min(0).default(0),
});

export type SwarmBudgetUsage = z.infer<typeof SwarmBudgetUsageSchema>;

export const SwarmMissionSchema = z.object({
  missionId: z.string().min(1),
  objective: z.string().min(1),
  topology: SwarmTopologySchema.default('hierarchical'),
  supervisorPersonaId: z.enum(AGENT_PERSONA_IDS).optional(),
  specialistPersonaIds: z.array(z.enum(AGENT_PERSONA_IDS)).min(1),
  tenantContext: z.object({
    organizationId: z.string().min(1),
    workspaceId: z.string().min(1),
  }),
  budgets: SwarmBudgetsSchema.default({
    maxDurationMs: 75000,
    maxTokens: 50000,
    maxToolCalls: 20,
  }),
  dryRun: z.boolean().default(false),
  metadata: z.record(z.string(), z.string()).default({}),
});

export type SwarmMissionInput = z.input<typeof SwarmMissionSchema>;
export type SwarmMission = z.infer<typeof SwarmMissionSchema>;

export const SwarmRunSchema = z.object({
  swarmRunId: z.string().min(1),
  missionId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  topology: SwarmTopologySchema,
  status: SwarmRunStatusSchema.default('created'),
  supervisorRunId: z.string().optional(),
  childRunIds: z.array(z.string()).default([]),
  activeStageIndex: z.number().int().min(0).default(0),
  budgets: SwarmBudgetsSchema,
  budgetUsage: SwarmBudgetUsageSchema.default({
    tokensUsed: 0,
    toolCallsExecuted: 0,
    durationMs: 0,
  }),
  consensus: SwarmConsensusSchema.optional(),
  approvalProposalId: z.string().optional(),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export type SwarmRun = z.infer<typeof SwarmRunSchema>;
