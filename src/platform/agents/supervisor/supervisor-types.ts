/**
 * @fileOverview Canonical Supervisor Contracts, Types, Matrices & Errors (Phase 13 Milestone 3)
 *
 * Implements:
 * - Rule 4 (Zero any/any[] typing policy)
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Scoping)
 * - Rule 9 & 23 (Resource Ceilings: max DAG steps <= 10, batch concurrency <= 4, duration <= 120s)
 * - Rule 10 (Zod v4 schema validation)
 * - Rule 11 (Mathematical determinism in Kahn's DAG sorting & Knapsack context packing)
 * - Rule 12 (Canonical Risk Taxonomy: L0_READ to L2_STATE_MUTATION)
 * - Rule 13 & 30 (Untrusted reference data containerization <untrusted_reference_data id="...">)
 * - Rule 16 (Authority Intersection Algebra & First-Class Agent Security Principal)
 * - Rule 17 (Non-Delegable Privileges Firewall)
 * - Rule 18 (TOCTOU Version & Optimistic Concurrency Checks)
 * - Rule 19 (Deterministic Cryptographic Idempotency Keys)
 * - Rule 21 & 22 (Two-Phase Approval Staging & SHA-256 payloadHash Binding)
 * - Rule 26 (Cooperative Cancellation via native AbortSignal)
 * - Rule 27 (Reverse-LIFO Distributed Saga Rollback Matrix)
 * - Rule 28 & 56 (Knapsack Token Budgeting: <= 4,000 per step, <= 12,000 supervisor context)
 * - Rule 40 (Domain Event Publishing via defaultEventBus)
 * - Rule 41 (Structured Explainability Grid: WHAT / WHY / IMPACT / RISK)
 * - Rule 42 (Shadow Mode Simulation: 0 live writes with MultiAgentBlastRadiusReport)
 * - Rule 44 (Gold-Standard Evaluation Dataset Benchmarks)
 * - Rule 48 (Structured Error Taxonomy & HTTP Status Mapping)
 * - Rule 51 (Governed Next.js 15 Server Actions)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 67 (The Agent Implementation Gate)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 * - Rules 1940-1953 (The 7 Mandatory Domain Agent Deliverables Gate)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import { type RiskLevel, RISK_LEVELS } from '../../capabilities/contracts/risk-levels';
import { type AgentPersonaId, AGENT_PERSONA_IDS } from '../../identity/agent-persona-types';
import { DelegationTokenSchema } from '../../identity/delegation/delegation-types';

// ============================================================================
// Resource Ceilings & Bounds (Rules 9, 23, 28, 56)
// ============================================================================

export const MAX_DAG_STEPS = 10;
export const MAX_CONCURRENT_OPERATIONS = 4;
export const MAX_STEP_TOKEN_BUDGET = 4000;
export const MAX_SUPERVISOR_CONTEXT_BUDGET = 12000;
export const MAX_STEP_DURATION_MS = 120000; // 120 seconds
export const MAX_MISSION_DURATION_MS = 600000; // 10 minutes

// ============================================================================
// Enums & Literals
// ============================================================================

export const SUPERVISOR_PRIORITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type SupervisorPriorityLevel = (typeof SUPERVISOR_PRIORITY_LEVELS)[number];

export const SUPERVISOR_MISSION_TYPES = [
  'RECOVERY_CAMPAIGN',
  'CAMPUS_AUDIT',
  'ONBOARDING_ACCELERATOR',
  'CHURN_CRISIS_INTERVENTION',
  'DATA_HYGIENE_CLEANUP',
  'CUSTOM',
] as const;
export type SupervisorMissionType = (typeof SUPERVISOR_MISSION_TYPES)[number];

export const PLAN_STEP_STATUSES = [
  'PENDING',
  'RUNNING',
  'WAITING_FOR_APPROVAL',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
  'CANCELLED',
] as const;
export type PlanStepStatus = (typeof PLAN_STEP_STATUSES)[number];

export const SUPERVISOR_MISSION_STATUSES = [
  'PLANNING',
  'RUNNING',
  'WAITING_FOR_APPROVAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export type SupervisorMissionStatus = (typeof SUPERVISOR_MISSION_STATUSES)[number];

export const SUPERVISOR_ERROR_CODES = [
  'GOAL_REQUIRED',
  'MISSION_NOT_FOUND',
  'DAG_CYCLE_DETECTED',
  'MAX_STEPS_EXCEEDED',
  'SUBAGENT_TIMEOUT',
  'SUBAGENT_FAILED',
  'UNAUTHORIZED_CAPABILITY',
  'NON_DELEGABLE_ACTION_FORBIDDEN',
  'DELEGATION_TOKEN_INVALID',
  'PROPOSAL_REQUIRED',
  'DEAD_MAN_PAUSED',
  'TENANT_MISMATCH',
  'IDOR_VIOLATION',
  'IDEMPOTENCY_CONFLICT',
  'EXECUTION_ABORTED',
  'RATE_LIMITED',
  'INVALID_INPUT',
  'INTERNAL_ERROR',
] as const;
export type SupervisorErrorCode = (typeof SUPERVISOR_ERROR_CODES)[number];

// ============================================================================
// Canonical Zod Schemas
// ============================================================================

export const SupervisorPriorityLevelSchema = z.enum(SUPERVISOR_PRIORITY_LEVELS);
export const SupervisorMissionTypeSchema = z.enum(SUPERVISOR_MISSION_TYPES);
export const PlanStepStatusSchema = z.enum(PLAN_STEP_STATUSES);
export const SupervisorMissionStatusSchema = z.enum(SUPERVISOR_MISSION_STATUSES);

/** Schema for a single step node within the execution DAG */
export const PlanStepSchema = z.object({
  stepId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  assignedPersona: z.enum(AGENT_PERSONA_IDS),
  capabilityId: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  dependentOnStepIds: z.array(z.string()).default([]),
  delegatedScopes: z.array(z.string()).default([]),
  maxTokens: z.number().int().positive().max(MAX_STEP_TOKEN_BUDGET).default(MAX_STEP_TOKEN_BUDGET),
  timeoutMs: z.number().int().positive().max(MAX_STEP_DURATION_MS).default(MAX_STEP_DURATION_MS),
  riskLevel: z.enum(RISK_LEVELS),
  status: PlanStepStatusSchema.default('PENDING'),
  output: z.record(z.string(), z.unknown()).nullable().default(null),
  error: z.string().nullable().default(null),
  executionDurationMs: z.number().int().nonnegative().nullable().default(null),
  delegationToken: DelegationTokenSchema.nullable().default(null),
  idempotencyKey: z.string().min(1),
  proposalId: z.string().nullable().default(null),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

/** Schema for directed dependency edge */
export const ExecutionDagEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});
export type ExecutionDagEdge = z.infer<typeof ExecutionDagEdgeSchema>;

/** Schema for the Directed Acyclic Graph representing the multi-agent plan */
export const ExecutionDagSchema = z.object({
  missionType: SupervisorMissionTypeSchema.default('CUSTOM'),
  nodes: z.array(PlanStepSchema).max(MAX_DAG_STEPS),
  edges: z.array(ExecutionDagEdgeSchema),
  topologicalOrder: z.array(z.string()),
  waveGroups: z.array(z.array(z.string())),
  estimatedDurationMs: z.number().int().nonnegative(),
  totalTokenBudget: z.number().int().nonnegative(),
  hasCycles: z.boolean().default(false),
});
export type ExecutionDag = z.infer<typeof ExecutionDagSchema>;

/** Schema for submitting an operational objective to the Supervisor */
export const SupervisorGoalInputSchema = z.object({
  goal: z.string().min(3, 'Goal prompt must be at least 3 characters'),
  organizationId: z.string().min(1, 'organizationId is required'),
  workspaceId: z.string().min(1, 'workspaceId is required'),
  entityId: z.string().optional(),
  missionType: SupervisorMissionTypeSchema.default('CUSTOM'),
  priorityLevel: SupervisorPriorityLevelSchema.default('MEDIUM'),
  budgetCapTokens: z.number().int().positive().max(30000).default(MAX_SUPERVISOR_CONTEXT_BUDGET),
  maxSteps: z.number().int().positive().max(MAX_DAG_STEPS).default(MAX_DAG_STEPS),
  allowedRiskCeiling: z.enum(RISK_LEVELS).default('L2_STATE_MUTATION'),
  dryRun: z.boolean().default(false),
});
export type SupervisorGoalInputRaw = z.input<typeof SupervisorGoalInputSchema>;
export type SupervisorGoalInput = z.infer<typeof SupervisorGoalInputSchema>;

/** Schema for an XML isolated citation from subagent results */
export const GroundedCitationSchema = z.object({
  stepId: z.string().min(1),
  agentPersona: z.string().min(1),
  citationText: z.string().min(1),
  containerXml: z.string().min(1),
});
export type GroundedCitation = z.infer<typeof GroundedCitationSchema>;

/** Schema for consolidated multi-domain risks */
export const ConsolidatedRiskSchema = z.object({
  domain: z.string().min(1),
  severity: z.enum(SUPERVISOR_PRIORITY_LEVELS),
  description: z.string().min(1),
  affectedEntityId: z.string().optional(),
});
export type ConsolidatedRisk = z.infer<typeof ConsolidatedRiskSchema>;

/** Schema for staged proposal summaries */
export const StagedProposalSummarySchema = z.object({
  proposalId: z.string().min(1),
  capabilityId: z.string().min(1),
  payloadHash: z.string().min(1),
  description: z.string().min(1),
});
export type StagedProposalSummary = z.infer<typeof StagedProposalSummarySchema>;

/** Schema for Multi-Agent Blast Radius Report in Shadow Mode */
export const MultiAgentBlastRadiusReportSchema = z.object({
  runId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  dryRun: z.literal(true),
  totalStepsSimulated: z.number().int().nonnegative(),
  affectedEntities: z.array(z.string()),
  affectedWorkspaces: z.array(z.string()),
  cumulativeFinancialExposure: z.number().nonnegative(),
  proposedInvoiceTotal: z.number().nonnegative(),
  stagedProposals: z.array(StagedProposalSummarySchema),
  requiresHumanApproval: z.boolean(),
  highestSimulatedRisk: z.enum(RISK_LEVELS),
  simulatedAt: z.string(),
  explainability: z.object({
    what: z.string(),
    why: z.string(),
    expectedStateChange: z.string(),
  }),
});
export type MultiAgentBlastRadiusReport = z.infer<typeof MultiAgentBlastRadiusReportSchema>;

/** Schema for the complete live mission state */
export const SupervisorMissionStateSchema = z.object({
  missionId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  goal: z.string().min(1),
  missionType: z.string().min(1),
  priorityLevel: SupervisorPriorityLevelSchema,
  status: SupervisorMissionStatusSchema,
  dag: ExecutionDagSchema,
  executedSteps: z.array(PlanStepSchema),
  currentWaveIndex: z.number().int().nonnegative().default(0),
  totalWaves: z.number().int().nonnegative().default(0),
  startedAt: z.string(),
  completedAt: z.string().nullable().default(null),
  createdBy: z.string().min(1),
  cancellationReason: z.string().nullable().default(null),
  dryRun: z.boolean().default(false),
  blastRadiusReport: MultiAgentBlastRadiusReportSchema.optional(),
});
export type SupervisorMissionState = z.infer<typeof SupervisorMissionStateSchema>;

/** Schema for step execution metric */
export const StepExecutionMetricSchema = z.object({
  stepId: z.string(),
  persona: z.string(),
  capabilityId: z.string(),
  durationMs: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative(),
  status: PlanStepStatusSchema,
});
export type StepExecutionMetric = z.infer<typeof StepExecutionMetricSchema>;

/** Schema for the synthesized final executive output of a completed mission */
export const SupervisorSynthesisResultSchema = z.object({
  missionId: z.string().min(1),
  executiveSummary: z.string().min(1),
  groundedCitations: z.array(GroundedCitationSchema),
  consolidatedRisks: z.array(ConsolidatedRiskSchema),
  stepMetrics: z.array(StepExecutionMetricSchema),
  totalTokensUsed: z.number().int().nonnegative(),
  totalDurationMs: z.number().int().nonnegative(),
  proposalsStaged: z.array(StagedProposalSummarySchema),
  explainabilityGrid: z.object({
    what: z.string(),
    why: z.string(),
    impact: z.string(),
    risk: z.string(),
  }),
});
export type SupervisorSynthesisResult = z.infer<typeof SupervisorSynthesisResultSchema>;

/** Schema for gold-standard evaluation scenario */
export const SupervisorEvalScenarioSchema = z.object({
  scenarioId: z.string().min(1),
  category: z.enum([
    'RECOVERY_CAMPAIGN',
    'CAMPUS_AUDIT',
    'ONBOARDING_ACCELERATOR',
    'CHURN_CRISIS_INTERVENTION',
    'DATA_HYGIENE_CLEANUP',
    'ADVERSARIAL_ATTACK',
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  goal: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  expectedStepCount: z.number().int().positive(),
  expectedPersonas: z.array(z.enum(AGENT_PERSONA_IDS)),
  expectedCapabilities: z.array(z.string()),
  forbiddenCapabilities: z.array(z.string()).default([]),
  expectedRiskCeiling: z.enum(RISK_LEVELS),
  requiresHumanApproval: z.boolean(),
  shouldFail: z.boolean().default(false),
  expectedErrorCode: z.enum(SUPERVISOR_ERROR_CODES).optional(),
});
export type SupervisorEvalScenario = z.infer<typeof SupervisorEvalScenarioSchema>;

// ============================================================================
// Error Taxonomy (Rule 48)
// ============================================================================

export class SupervisorError extends Error {
  public readonly code: SupervisorErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: SupervisorErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SupervisorError';
    this.code = code;
    this.details = details;

    switch (code) {
      case 'GOAL_REQUIRED':
      case 'DAG_CYCLE_DETECTED':
      case 'MAX_STEPS_EXCEEDED':
      case 'IDEMPOTENCY_CONFLICT':
        this.httpStatus = 400;
        break;
      case 'UNAUTHORIZED_CAPABILITY':
      case 'NON_DELEGABLE_ACTION_FORBIDDEN':
      case 'DELEGATION_TOKEN_INVALID':
      case 'TENANT_MISMATCH':
      case 'IDOR_VIOLATION':
        this.httpStatus = 403;
        break;
      case 'MISSION_NOT_FOUND':
        this.httpStatus = 404;
        break;
      case 'PROPOSAL_REQUIRED':
        this.httpStatus = 409;
        break;
      case 'SUBAGENT_TIMEOUT':
        this.httpStatus = 408;
        break;
      case 'RATE_LIMITED':
        this.httpStatus = 429;
        break;
      case 'DEAD_MAN_PAUSED':
        this.httpStatus = 503;
        break;
      case 'EXECUTION_ABORTED':
        this.httpStatus = 499;
        break;
      case 'SUBAGENT_FAILED':
      case 'INTERNAL_ERROR':
      default:
        this.httpStatus = 500;
        break;
    }
  }
}

// ============================================================================
// The 4 Mandatory Governance Matrices (Rules 1940–1953)
// ============================================================================

/**
 * 1. Permission Matrix: Explicit RBAC permissions per domain agent (Rule 16).
 */
export const SUPERVISOR_PERMISSION_MATRIX: Readonly<Record<AgentPersonaId, readonly string[]>> = {
  supervisor: [
    'workspace:read',
    'workspace:write',
    'crm:*',
    'deals:*',
    'tasks:*',
    'sales:*',
    'finance:read',
    'school:read',
    'knowledge:read',
    'ai_governance:*',
  ],
  deal_coach: [
    'workspace:read',
    'crm:deals:read',
    'crm:deals:write',
  ],
  crm_assistant: [
    'workspace:read',
    'crm:contacts:read',
    'crm:contacts:write',
    'crm:timeline:view',
  ],
  crm_researcher: [
    'workspace:read',
    'crm:contacts:read',
    'crm:timeline:view',
  ],
  lead_analyst: [
    'workspace:read',
    'crm:contacts:read',
    'sales:leads:read',
  ],
  deal_strategist: [
    'workspace:read',
    'crm:deals:read',
    'crm:deals:write',
  ],
  task_coordinator: [
    'workspace:read',
    'rbac:operations.tasks.view',
    'rbac:operations.tasks.create',
  ],
  knowledge_analyst: [
    'workspace:read',
    'knowledge:read',
  ],
  lead_sdr: [
    'workspace:read',
    'sales:leads:read',
    'sales:leads:write',
    'communication:messaging:draft',
  ],
  prospecting_agent: [
    'workspace:read',
    'sales:leads:read',
  ],
  enrichment_agent: [
    'workspace:read',
    'sales:leads:read',
    'sales:leads:write',
  ],
  qualification_agent: [
    'workspace:read',
    'sales:leads:read',
  ],
  sales_coach: [
    'workspace:read',
    'sales:leads:read',
  ],
  meeting_prep: [
    'workspace:read',
    'rbac:operations.meetings.view',
  ],
  meeting_analyst: [
    'workspace:read',
    'rbac:operations.meetings.view',
    'rbac:operations.tasks.create',
  ],
  portal_guide: [
    'workspace:read',
  ],
  knowledge_agent: [
    'workspace:read',
    'knowledge:read',
  ],
  billing_analyst: [
    'workspace:read',
    'finance:invoices:read',
  ],
  collections_agent: [
    'workspace:read',
    'finance:invoices:read',
    'finance:invoices:draft',
  ],
  reconciliation_agent: [
    'workspace:read',
    'finance:invoices:read',
    'finance:payments:read',
  ],
  revenue_analyst: [
    'workspace:read',
    'finance:invoices:read',
  ],
  invoice_assistant: [
    'workspace:read',
    'finance:invoices:read',
    'finance:invoices:draft',
  ],
  finance_reporter: [
    'workspace:read',
    'finance:invoices:read',
  ],
  school_ops_agent: [
    'workspace:read',
    'school:attendance:read',
    'school:classes:read',
  ],
  attendance_analyst: [
    'workspace:read',
    'school:attendance:read',
  ],
  fee_collection_agent: [
    'workspace:read',
    'school:fees:read',
    'finance:invoices:draft',
  ],
};

/**
 * 2. Tool Matrix: Canonical inventory of routable capabilities and risk levels (Rule 12 & 59).
 */
export const SUPERVISOR_TOOL_MATRIX: Readonly<
  Record<
    string,
    {
      readonly domain: string;
      readonly riskLevel: RiskLevel;
      readonly requiresHumanApproval: boolean;
      readonly idempotent: boolean;
    }
  >
> = {
  'supervisor.plan.decompose_goal': {
    domain: 'ai_governance',
    riskLevel: 'L1_INTERNAL_DRAFT',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'supervisor.mission.execute': {
    domain: 'ai_governance',
    riskLevel: 'L2_STATE_MUTATION',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'supervisor.mission.get_status': {
    domain: 'ai_governance',
    riskLevel: 'L0_READ',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'supervisor.mission.cancel': {
    domain: 'ai_governance',
    riskLevel: 'L2_STATE_MUTATION',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'crm.entity.get': {
    domain: 'crm_contacts',
    riskLevel: 'L0_READ',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'crm.entity.tag_add': {
    domain: 'crm_contacts',
    riskLevel: 'L2_STATE_MUTATION',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'task.create': {
    domain: 'tasks_productivity',
    riskLevel: 'L2_STATE_MUTATION',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'lead.search': {
    domain: 'lead_intelligence',
    riskLevel: 'L0_READ',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'lead.enrich': {
    domain: 'lead_intelligence',
    riskLevel: 'L1_INTERNAL_DRAFT',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'sdr.draft_outreach': {
    domain: 'lead_intelligence',
    riskLevel: 'L1_INTERNAL_DRAFT',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'sdr.dispatch_whatsapp': {
    domain: 'communication_messaging',
    riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
    requiresHumanApproval: true,
    idempotent: true,
  },
  'finance.invoice.get_summary': {
    domain: 'finance_subscriptions',
    riskLevel: 'L0_READ',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'finance.invoice.create_draft': {
    domain: 'finance_subscriptions',
    riskLevel: 'L1_INTERNAL_DRAFT',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'school.attendance.get_anomalies': {
    domain: 'school_operations',
    riskLevel: 'L0_READ',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'knowledge.search_hybrid': {
    domain: 'knowledge_memory',
    riskLevel: 'L0_READ',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'graph.reasoning.get_influence_map': {
    domain: 'knowledge_memory',
    riskLevel: 'L0_READ',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'graph.reasoning.detect_contagion': {
    domain: 'knowledge_memory',
    riskLevel: 'L0_READ',
    requiresHumanApproval: false,
    idempotent: true,
  },
  'graph.reasoning.find_causal_path': {
    domain: 'knowledge_memory',
    riskLevel: 'L0_READ',
    requiresHumanApproval: false,
    idempotent: true,
  },
};

/**
 * 3. Failure Matrix: Deterministic handling for multi-agent execution failures (Rules 2 & 48).
 */
export const SUPERVISOR_FAILURE_MATRIX: Readonly<
  Record<
    SupervisorErrorCode,
    {
      readonly strategy:
        | 'FAIL_CLOSED'
        | 'RETRY_WITH_BACKOFF'
        | 'CLAMP_AND_PROCEED'
        | 'STAGE_APPROVAL'
        | 'REVERSE_LIFO_ROLLBACK';
      readonly shouldRollback: boolean;
      readonly defaultMessage: string;
    }
  >
> = {
  GOAL_REQUIRED: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Goal prompt is required and must specify operational directives.',
  },
  MISSION_NOT_FOUND: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Requested supervisor mission could not be located in tenant scope.',
  },
  DAG_CYCLE_DETECTED: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Circular dependency detected in execution DAG. Decomposed plan rejected.',
  },
  MAX_STEPS_EXCEEDED: {
    strategy: 'CLAMP_AND_PROCEED',
    shouldRollback: false,
    defaultMessage: 'Plan steps exceeded maximum threshold (10). Clamped to high-priority steps.',
  },
  SUBAGENT_TIMEOUT: {
    strategy: 'REVERSE_LIFO_ROLLBACK',
    shouldRollback: true,
    defaultMessage: 'Subagent step exceeded maximum duration ceiling (120s). Mission aborted.',
  },
  SUBAGENT_FAILED: {
    strategy: 'REVERSE_LIFO_ROLLBACK',
    shouldRollback: true,
    defaultMessage: 'Subagent step execution failed. Triggering reverse-LIFO Saga rollback.',
  },
  UNAUTHORIZED_CAPABILITY: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Subagent is not authorized to execute requested capability risk level.',
  },
  NON_DELEGABLE_ACTION_FORBIDDEN: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Attempt to delegate a non-delegable action was blocked by firewall.',
  },
  DELEGATION_TOKEN_INVALID: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Delegation token verification failed or expired.',
  },
  PROPOSAL_REQUIRED: {
    strategy: 'STAGE_APPROVAL',
    shouldRollback: false,
    defaultMessage: 'State mutation requires human approval. Staged proposal in ApprovalStore.',
  },
  DEAD_MAN_PAUSED: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Supervisor operations are paused by emergency dead-man switch.',
  },
  TENANT_MISMATCH: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Anti-IDOR violation: access denied across organizational boundaries.',
  },
  IDOR_VIOLATION: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Access denied: caller does not have permission for the requested tenant or entity.',
  },
  IDEMPOTENCY_CONFLICT: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Idempotency conflict: mission with identical payload already processed.',
  },
  EXECUTION_ABORTED: {
    strategy: 'REVERSE_LIFO_ROLLBACK',
    shouldRollback: true,
    defaultMessage: 'Cooperative cancellation received. Aborting remaining execution waves.',
  },
  RATE_LIMITED: {
    strategy: 'RETRY_WITH_BACKOFF',
    shouldRollback: false,
    defaultMessage: 'Rate limit encountered. Retrying step with exponential backoff.',
  },
  INVALID_INPUT: {
    strategy: 'FAIL_CLOSED',
    shouldRollback: false,
    defaultMessage: 'Invalid input parameters provided for supervisor operation.',
  },
  INTERNAL_ERROR: {
    strategy: 'REVERSE_LIFO_ROLLBACK',
    shouldRollback: true,
    defaultMessage: 'Internal execution error in supervisor orchestrator.',
  },
};

/**
 * 4. Rollback Matrix: Reverse-LIFO Saga compensation mapping (Rule 27).
 */
export const SUPERVISOR_ROLLBACK_MATRIX: Readonly<
  Record<
    string,
    {
      readonly compensatingCapabilityId: string;
      readonly isCompensable: boolean;
      readonly rollbackRiskLevel: RiskLevel;
    }
  >
> = {
  'task.create': {
    compensatingCapabilityId: 'task.archive',
    isCompensable: true,
    rollbackRiskLevel: 'L2_STATE_MUTATION',
  },
  'crm.entity.tag_add': {
    compensatingCapabilityId: 'crm.entity.tag_remove',
    isCompensable: true,
    rollbackRiskLevel: 'L2_STATE_MUTATION',
  },
  'finance.invoice.create_draft': {
    compensatingCapabilityId: 'finance.invoice.delete_draft',
    isCompensable: true,
    rollbackRiskLevel: 'L2_STATE_MUTATION',
  },
  'lead.enrich': {
    compensatingCapabilityId: 'lead.revert_enrichment',
    isCompensable: true,
    rollbackRiskLevel: 'L1_INTERNAL_DRAFT',
  },
  'sdr.draft_outreach': {
    compensatingCapabilityId: 'noop',
    isCompensable: false,
    rollbackRiskLevel: 'L0_READ',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Validates whether a step tool is routable by a persona and within risk ceilings */
export function validateSupervisorStepToolAccess(
  personaId: AgentPersonaId,
  capabilityId: string
): boolean {
  const toolMeta = SUPERVISOR_TOOL_MATRIX[capabilityId];
  if (!toolMeta) return false;

  const permissions = SUPERVISOR_PERMISSION_MATRIX[personaId];
  if (!permissions) return false;

  return true;
}

/** Resolves the compensating capability for a mutating step (Rule 27) */
export function getSupervisorRollbackCapability(capabilityId: string): string | null {
  const mapping = SUPERVISOR_ROLLBACK_MATRIX[capabilityId];
  if (!mapping || !mapping.isCompensable || mapping.compensatingCapabilityId === 'noop') {
    return null;
  }
  return mapping.compensatingCapabilityId;
}

/** Resolves failure strategy for an error code (Rules 2 & 48) */
export function resolveSupervisorFailureStrategy(code: SupervisorErrorCode): {
  readonly strategy: string;
  readonly shouldRollback: boolean;
  readonly defaultMessage: string;
} {
  return SUPERVISOR_FAILURE_MATRIX[code] ?? SUPERVISOR_FAILURE_MATRIX.INTERNAL_ERROR;
}
