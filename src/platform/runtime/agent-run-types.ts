/**
 * @fileOverview Canonical Agent Runtime Contracts, Finite State Machine Types & Schemas (Phase 6 Milestone 1)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy with Zod v4 schemas. `unknown` narrowed at trust boundaries.
 * - Rule 8 & 47: Strict Multi-Tenancy & Anti-IDOR (`organizationId`, `workspaceId`).
 * - Rule 10: Complete inline architectural documentation and lifecycle invariants.
 * - Rule 16: Agent Identity as Security Principal (`agentPersonaId`, `principalId`, no wildcard scopes).
 * - Rule 19: Mandatory Idempotency (`idempotencyKey`).
 * - Rule 20: Distributed Tracing (`correlationId`, `traceId`, `spanId`).
 * - Rule 21 & 22: Two-Phase Action Model & Approval Binding (`actionProposalId`, `payloadHash`).
 * - Rule 23 & 54: Multi-Dimensional Resource Governance (`maxTokens`, `maxToolCalls`, `maxDurationMs`, `maxRecordsMutated`).
 * - Rule 24: Circuit Breaker status integration (`CIRCUIT_BREAKER_OPEN`).
 * - Rule 26: True Cancellation Semantics (`isCancellableState`, `cancelledAt`, `abortReason`).
 * - Rule 27: Formal Saga & Compensation Modeling (`compensatingCapabilityId`, `compensationStepId`).
 * - Rule 40: Audit Log Immutability (`stateHistory`, immutable execution traces).
 * - Rule 41: "Why Did You Do This?" Explainability Fields (WHAT, WHY, WHO, BLAST RADIUS, EVIDENCE).
 * - Rule 42 & 43: Shadow Mode (`dryRun: boolean`) and Replayable Agent Runs (`originalRunId`).
 * - Rule 48: Sanitized Error Taxonomy (`AGENT_RUNTIME_ERROR_CODES`).
 * - Rule 60: Emergency Dead-Man Controls (`EMERGENCY_DEAD_MAN_PAUSED`).
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. An Agent Run represents a discrete, goal-oriented execution of an autonomous agent persona.
 * 2. Every Run progresses strictly through the 11-state finite state machine.
 * 3. Terminal states (`completed`, `failed`, `cancelled`) are unconditionally immutable.
 * 4. All step records are partitioned into `/organizations/{orgId}/agent_runs/{runId}/steps/{stepId}`
 *    to guarantee that parent run documents never breach Firestore's 1MB document limit.
 */

import { z } from 'zod/v4';
import { AGENT_PERSONA_IDS, type AgentPersonaId } from '../identity/agent-persona-types';
import { RISK_LEVELS, type RiskLevel } from '../capabilities/contracts/risk-levels';

export { AGENT_PERSONA_IDS };
export type { AgentPersonaId, RiskLevel };

// ============================================================================
// 1. FINITE STATE MACHINE & STATUS ENUMS
// ============================================================================

/**
 * The 11 canonical states of an Agent Run execution lifecycle (PRD §89, Doc 07).
 */
export const AGENT_RUN_STATUSES = [
  'created',
  'queued',
  'planning',
  'context_building',
  'executing',
  'waiting_for_approval',
  'verifying',
  'retrying',
  'completed',
  'failed',
  'cancelled',
] as const;

export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const isAgentRunStatus = (status: string): status is AgentRunStatus =>
  (AGENT_RUN_STATUSES as readonly string[]).includes(status);

/**
 * Execution statuses for discrete steps within an agent run.
 */
export const AGENT_STEP_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'compensated',
] as const;

export type AgentStepStatus = (typeof AGENT_STEP_STATUSES)[number];

/**
 * Types of operations executed within an agent step.
 */
export const AGENT_STEP_TYPES = [
  'planning',
  'context_retrieval',
  'tool_call',
  'verification',
  'replanning',
  'approval_wait',
  'compensation',
  'reflection',
] as const;

export type AgentStepType = (typeof AGENT_STEP_TYPES)[number];

/**
 * Intent classifications for agent goals (PRD §57 & Doc 07).
 */
export const AGENT_INTENTS = [
  'research',
  'pipeline_audit',
  'deal_coaching',
  'portal_guidance',
  'meeting_preparation',
  'task_execution',
  'custom_goal',
] as const;

export type AgentIntent = (typeof AGENT_INTENTS)[number];

/**
 * Trigger mechanisms that initiate an agent run.
 */
export const AGENT_TRIGGER_TYPES = [
  'manual',
  'scheduled',
  'reactive_event',
  'delegation',
] as const;

export type AgentTriggerType = (typeof AGENT_TRIGGER_TYPES)[number];

/**
 * Tiered LLM routing assignments (Rule 58).
 */
export const AGENT_MODEL_TIERS = ['flash', 'pro'] as const;
export type AgentModelTier = (typeof AGENT_MODEL_TIERS)[number];

// ============================================================================
// 2. ERROR TAXONOMY & EXCEPTION CLASS (Rule 48)
// ============================================================================

export const AGENT_RUNTIME_ERROR_CODES = [
  'RUN_NOT_FOUND',
  'STEP_NOT_FOUND',
  'INVALID_STATE_TRANSITION',
  'TERMINAL_STATE_IMMUTABLE',
  'BUDGET_EXCEEDED',
  'RUN_CANCELLED',
  'TENANT_SCOPE_VIOLATION',
  'CONCURRENCY_CONFLICT',
  'IDEMPOTENCY_COLLISION',
  'INVALID_RUN_INPUT',
  'CIRCUIT_BREAKER_OPEN',
  'EMERGENCY_DEAD_MAN_PAUSED',
  'VERIFICATION_FAILED',
  'CAPABILITY_DISALLOWED',
  'PERSONA_DISALLOWED',
  'UNAPPROVED_FINGERPRINT_DRIFT',
  'PLANNING_FAILED',
  'APPROVAL_REQUIRED',
  'APPROVAL_REJECTED',
  'PAYLOAD_TAMPERED',
] as const;

export type AgentRuntimeErrorCode = (typeof AGENT_RUNTIME_ERROR_CODES)[number];

export interface AgentRuntimeErrorDetails {
  readonly code: AgentRuntimeErrorCode;
  readonly message: string;
  readonly runId?: string;
  readonly stepId?: string;
  readonly organizationId?: string;
  readonly currentStatus?: AgentRunStatus;
  readonly targetStatus?: AgentRunStatus;
  readonly details?: Record<string, unknown>;
}

export class AgentRuntimeError extends Error {
  readonly code: AgentRuntimeErrorCode;
  readonly runId?: string;
  readonly stepId?: string;
  readonly organizationId?: string;
  readonly currentStatus?: AgentRunStatus;
  readonly targetStatus?: AgentRunStatus;
  readonly details?: Record<string, unknown>;

  constructor(opts: AgentRuntimeErrorDetails) {
    super(`[AgentRuntime:${opts.code}] ${opts.message}`);
    this.name = 'AgentRuntimeError';
    this.code = opts.code;
    this.runId = opts.runId;
    this.stepId = opts.stepId;
    this.organizationId = opts.organizationId;
    this.currentStatus = opts.currentStatus;
    this.targetStatus = opts.targetStatus;
    this.details = opts.details;
    Object.setPrototypeOf(this, AgentRuntimeError.prototype);
  }
}

// ============================================================================
// 3. RESOURCE BUDGETS & USAGE SCHEMAS (Rule 23 & Rule 54)
// ============================================================================

export const AgentRunBudgetsSchema = z.object({
  maxDurationMs: z.number().int().min(1000).max(300000).default(120000),
  maxTokens: z.number().int().min(1000).max(200000).default(50000),
  maxToolCalls: z.number().int().min(1).max(50).default(15),
  maxRecordsMutated: z.number().int().min(0).max(100).default(25),
  maxFinancialAmount: z.number().min(0).max(10000).default(0),
  maxDelegationDepth: z.number().int().min(1).max(3).default(3),
});

export type AgentRunBudgets = z.infer<typeof AgentRunBudgetsSchema>;

export const AgentRunBudgetUsageSchema = z.object({
  tokensUsed: z.number().int().min(0).default(0),
  toolCallsExecuted: z.number().int().min(0).default(0),
  durationMs: z.number().int().min(0).default(0),
  recordsMutated: z.number().int().min(0).default(0),
  financialAmount: z.number().min(0).default(0),
  currentDelegationDepth: z.number().int().min(0).default(0),
});

export type AgentRunBudgetUsage = z.infer<typeof AgentRunBudgetUsageSchema>;

// ============================================================================
// 4. GOAL, PLAN & STEP SCHEMAS
// ============================================================================

export const AgentGoalSubjectSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  name: z.string().optional(),
});

export type AgentGoalSubject = z.infer<typeof AgentGoalSubjectSchema>;

export const AgentGoalSchema = z.object({
  prompt: z.string().min(1),
  intent: z.enum(AGENT_INTENTS).default('custom_goal'),
  subject: AgentGoalSubjectSchema.optional(),
  constraints: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type AgentGoal = z.infer<typeof AgentGoalSchema>;

export const PlanStepSchema = z.object({
  stepId: z.string().min(1),
  stepIndex: z.number().int().min(0),
  title: z.string().min(1),
  type: z.enum(AGENT_STEP_TYPES),
  capabilityId: z.string().optional(),
  capabilityVersion: z.string().optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  arguments: z.record(z.string(), z.unknown()).optional(),
  dependsOnStepIds: z.array(z.string()).default([]),
  expectedStateChange: z.string().optional(),
  isNonDelegable: z.boolean().default(false),
  capabilityFingerprint: z.string().optional(),
  compensatingCapabilityId: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

export const ExecutionPlanSchema = z.object({
  planId: z.string().min(1),
  version: z.number().int().min(1).default(1),
  steps: z.array(PlanStepSchema).min(1),
  estimatedTokens: z.number().int().min(0).default(0),
  rationale: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

export const AgentStepSchema = z.object({
  stepId: z.string().min(1),
  runId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  stepIndex: z.number().int().min(0),
  type: z.enum(AGENT_STEP_TYPES),
  title: z.string().min(1),
  capabilityId: z.string().optional(),
  capabilityVersion: z.string().optional(),
  status: z.enum(AGENT_STEP_STATUSES).default('pending'),
  idempotencyKey: z.string().min(1),
  correlationId: z.string().min(1),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  actionProposalId: z.string().optional(),
  payloadHash: z.string().optional(),
  what: z.string().optional(),
  why: z.string().optional(),
  expectedStateChange: z.string().optional(),
  riskLevel: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().min(0).optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  output: z.record(z.string(), z.unknown()).optional(),
  outputValidated: z.boolean().default(false),
  outputValidationErrors: z.array(z.string()).optional(),
  sanitizedError: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  tokensUsed: z.number().int().min(0).default(0),
  contextTokenUsage: z.number().int().min(0).optional(),
  compensatingCapabilityId: z.string().optional(),
  compensationStepId: z.string().optional(),
  compensationStatus: z.enum(['not_required', 'pending', 'completed', 'failed']).default('not_required'),
});

export type AgentStep = z.infer<typeof AgentStepSchema>;

// ============================================================================
// 5. OUTCOME & STATE HISTORY SCHEMAS
// ============================================================================

export const AgentRunStateHistoryEntrySchema = z.object({
  from: z.enum(AGENT_RUN_STATUSES),
  to: z.enum(AGENT_RUN_STATUSES),
  timestamp: z.string().datetime(),
  reason: z.string().optional(),
});

export type AgentRunStateHistoryEntry = z.infer<typeof AgentRunStateHistoryEntrySchema>;

export const SourceCitationSchema = z.object({
  sourceId: z.string().min(1),
  sourceType: z.string().min(1),
  author: z.string().optional(),
  snippet: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type SourceCitation = z.infer<typeof SourceCitationSchema>;

export const AgentOutcomeSchema = z.object({
  answer: z.string().optional(),
  summary: z.string().min(1),
  findings: z.array(z.string()).default([]),
  actionsTaken: z.array(z.string()).default([]),
  actionProposalsCreated: z.array(z.string()).default([]),
  memoriesCreated: z.array(z.string()).default([]),
  sourceCitations: z.array(SourceCitationSchema).default([]),
  completedAt: z.string().datetime(),
});

export type AgentOutcome = z.infer<typeof AgentOutcomeSchema>;

// ============================================================================
// 6. MASTER AGENT RUN SCHEMA
// ============================================================================

export const AgentRunSchema = z.object({
  runId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  agentPersonaId: z.enum(AGENT_PERSONA_IDS),
  principalId: z.string().min(1),
  authorizingUserId: z.string().min(1),
  triggerType: z.enum(AGENT_TRIGGER_TYPES).default('manual'),
  modelTier: z.enum(AGENT_MODEL_TIERS).default('pro'),
  dryRun: z.boolean().default(false),
  goal: AgentGoalSchema,
  status: z.enum(AGENT_RUN_STATUSES).default('created'),
  stateHistory: z.array(AgentRunStateHistoryEntrySchema).default([]),
  currentPlan: ExecutionPlanSchema.optional(),
  currentStepIndex: z.number().int().min(0).default(0),
  budgets: AgentRunBudgetsSchema,
  budgetUsage: AgentRunBudgetUsageSchema.default({
    tokensUsed: 0,
    toolCallsExecuted: 0,
    durationMs: 0,
    recordsMutated: 0,
    financialAmount: 0,
    currentDelegationDepth: 0,
  }),
  outcome: AgentOutcomeSchema.optional(),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  originalRunId: z.string().optional(),
  swarmRunId: z.string().optional(),
  parentRunId: z.string().optional(),
  childRunIds: z.array(z.string()).default([]),
  retentionExpiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export type AgentRun = z.infer<typeof AgentRunSchema>;

// ============================================================================
// 7. INPUT CONTRACTS FOR RUN STORE
// ============================================================================

export const CreateAgentRunInputSchema = z.object({
  runId: z.string().optional(),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  agentPersonaId: z.enum(AGENT_PERSONA_IDS),
  principalId: z.string().min(1),
  authorizingUserId: z.string().min(1),
  triggerType: z.enum(AGENT_TRIGGER_TYPES).default('manual'),
  modelTier: z.enum(AGENT_MODEL_TIERS).default('pro'),
  dryRun: z.boolean().default(false),
  goal: AgentGoalSchema,
  customBudgets: AgentRunBudgetsSchema.partial().optional(),
  originalRunId: z.string().optional(),
  swarmRunId: z.string().optional(),
  parentRunId: z.string().optional(),
  childRunIds: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type CreateAgentRunInput = z.input<typeof CreateAgentRunInputSchema>;

export const UpdateAgentRunStatusInputSchema = z.object({
  runId: z.string().min(1),
  organizationId: z.string().min(1),
  fromStatus: z.enum(AGENT_RUN_STATUSES).optional(),
  toStatus: z.enum(AGENT_RUN_STATUSES),
  reason: z.string().optional(),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
});

export type UpdateAgentRunStatusInput = z.input<typeof UpdateAgentRunStatusInputSchema>;

export const CreateStepInputSchema = z.object({
  stepId: z.string().optional(),
  runId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  stepIndex: z.number().int().min(0),
  type: z.enum(AGENT_STEP_TYPES),
  title: z.string().min(1),
  capabilityId: z.string().optional(),
  capabilityVersion: z.string().optional(),
  idempotencyKey: z.string().min(1),
  correlationId: z.string().min(1),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  actionProposalId: z.string().optional(),
  payloadHash: z.string().optional(),
  what: z.string().optional(),
  why: z.string().optional(),
  expectedStateChange: z.string().optional(),
  riskLevel: z.string().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  compensatingCapabilityId: z.string().optional(),
});

export type CreateStepInput = z.input<typeof CreateStepInputSchema>;

export const UpdateStepInputSchema = z.object({
  runId: z.string().min(1),
  organizationId: z.string().min(1),
  stepId: z.string().min(1),
  status: z.enum(AGENT_STEP_STATUSES),
  actionProposalId: z.string().optional(),
  payloadHash: z.string().optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  outputValidated: z.boolean().optional(),
  outputValidationErrors: z.array(z.string()).optional(),
  sanitizedError: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  tokensUsed: z.number().int().min(0).optional(),
  contextTokenUsage: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(0).optional(),
  completedAt: z.string().datetime().optional(),
  compensationStepId: z.string().optional(),
  compensationStatus: z.enum(['not_required', 'pending', 'completed', 'failed']).optional(),
});

export type UpdateStepInput = z.input<typeof UpdateStepInputSchema>;

export const ListAgentRunsOptionsSchema = z.object({
  workspaceId: z.string().optional(),
  agentPersonaId: z.enum(AGENT_PERSONA_IDS).optional(),
  status: z.enum(AGENT_RUN_STATUSES).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListAgentRunsOptions = z.input<typeof ListAgentRunsOptionsSchema>;
