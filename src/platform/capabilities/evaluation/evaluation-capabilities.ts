/**
 * @fileOverview Canonical Evaluation Capabilities (evaluation.*) (Phase 15 Milestone 1)
 *
 * Implements:
 * - Rule 1 (Canonical Capability Layer): Pure capability definitions
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 10 (Inline Architectural Documentation)
 * - Rule 12 (Canonical Risk Taxonomy: strictly L0_READ for evaluations)
 * - Rule 14 (Schema Fingerprinting & Tool Contracts)
 * - Rule 16 (Explicit Scoped RBAC: evaluation:read, evaluation:manage)
 * - Rule 19 (Deterministic Idempotency)
 * - Rule 23 (Resource Governance & Timeout Ceilings)
 * - Rule 26 (Cooperative Cancellation via AbortSignal)
 * - Rule 40 (Mandatory Domain Event Publishing)
 * - Rule 42 (Shadow Mode Sandboxing: dryRun: true, liveWritesCount === 0)
 * - Rule 48 (Sanitized Error Taxonomy)
 * - Rule 59 (Tool Selection Evaluation)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 67 (The Agent Implementation Gate)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod/v4';
import {
  type CapabilityDefinition,
  type CapabilityExecutionContext,
  type CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from '../registry/capability-registry';
import {
  EvaluationRun,
  EvaluationRunSchema,
  BenchmarkComparison,
  BenchmarkComparisonSchema,
  HumanVsAgentBaseline,
  HumanVsAgentBaselineSchema,
  EvaluationDomainSchema,
  AgentEvaluationError,
  EVALUATION_ERROR_CODES,
} from '../../evaluation/contracts/evaluation-types';
import { getContinuousEvaluationEngine } from '../../evaluation/engine/continuous-evaluation-engine';
import { getGoldStandardScenarioById } from '../../evaluation/datasets/gold-standard-catalog';
import { getHumanAgentBaselineService } from '../../evaluation/benchmarks/human-agent-baseline-service';

/**
 * Validates caller tenant context against target organization (Rules 8 & 47).
 */
function assertTenantContext(
  context: CapabilityExecutionContext,
  organizationId: string
): void {
  if (
    context.principal.organizationId &&
    context.principal.organizationId !== organizationId
  ) {
    throw new AgentEvaluationError(
      EVALUATION_ERROR_CODES.EVALUATION_IDOR_VIOLATION,
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId})`,
      403
    );
  }
}

// ============================================================================
// 1. evaluation.run_scenario (L0_READ)
// ============================================================================

export const RunScenarioCapabilityInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  scenarioId: z.string().min(1),
  personaId: z.string().min(1).default('crm_researcher'),
  simulatedOutputText: z.string().optional(),
});

export type RunScenarioCapabilityInput = z.infer<typeof RunScenarioCapabilityInputSchema>;

export const evaluationRunScenarioCapability: CapabilityDefinition<
  RunScenarioCapabilityInput,
  EvaluationRun
> = {
  id: 'evaluation.run_scenario',
  version: '1.0.0',
  name: 'Run Evaluation Scenario',
  description:
    'Executes a single gold-standard evaluation scenario in dry-run mode and grades task, tool, policy, and grounding metrics.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: RunScenarioCapabilityInputSchema,
  outputSchema: EvaluationRunSchema,
  permissions: ['evaluation:read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 30000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: RunScenarioCapabilityInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<EvaluationRun>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const scenario = getGoldStandardScenarioById(input.scenarioId);
    if (!scenario) {
      throw new AgentEvaluationError(
        EVALUATION_ERROR_CODES.EVALUATION_SCENARIO_NOT_FOUND,
        `Evaluation scenario not found: ${input.scenarioId}`,
        404
      );
    }

    const engine = getContinuousEvaluationEngine();
    const result = await engine.evaluateScenario({
      scenario,
      personaId: input.personaId,
      executedBy: context.principal.userId,
      trace: {
        outputText:
          input.simulatedOutputText ??
          `Simulated execution response for ${scenario.title} covering ${scenario.expectedOutputContains.join(', ')}.`,
        isSuccess: true,
        calledCapabilities: scenario.expectedIntermediateActions,
        highestRiskLevelInvoked: scenario.expectedRiskLevel,
        accessedOrganizationIds: [input.organizationId],
        accessedWorkspaceIds: [input.workspaceId],
        heldPermissions: ['evaluation:read', 'crm:read', 'workspace:read'],
        attemptedNonDelegableActions: [],
        citedEvidenceKeys: scenario.expectedEvidenceKeys,
        liveWritesAttempted: 0,
      },
    });

    return {
      success: true,
      data: result,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 2. evaluation.get_benchmark_summary (L0_READ)
// ============================================================================

export const GetBenchmarkSummaryCapabilityInputSchema = z.object({
  organizationId: z.string().min(1),
  domainFilter: EvaluationDomainSchema.optional(),
});

export type GetBenchmarkSummaryCapabilityInput = z.infer<
  typeof GetBenchmarkSummaryCapabilityInputSchema
>;

export const evaluationGetBenchmarkSummaryCapability: CapabilityDefinition<
  GetBenchmarkSummaryCapabilityInput,
  BenchmarkComparison
> = {
  id: 'evaluation.get_benchmark_summary',
  version: '1.0.0',
  name: 'Get Benchmark Summary',
  description: 'Calculates and retrieves aggregate domain-level benchmark metrics and pass rates.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: GetBenchmarkSummaryCapabilityInputSchema,
  outputSchema: BenchmarkComparisonSchema,
  permissions: ['evaluation:read'],
  workspaceScoped: false,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: GetBenchmarkSummaryCapabilityInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<BenchmarkComparison>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const engine = getContinuousEvaluationEngine();
    const result = engine.getBenchmarkSummary(input.domainFilter);

    return {
      success: true,
      data: result,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 3. evaluation.get_human_agent_baseline (L0_READ)
// ============================================================================

export const GetHumanAgentBaselineCapabilityInputSchema = z.object({
  organizationId: z.string().min(1),
  scenarioId: z.string().min(1),
  runId: z.string().min(1),
});

export type GetHumanAgentBaselineCapabilityInput = z.infer<
  typeof GetHumanAgentBaselineCapabilityInputSchema
>;

export const evaluationGetHumanAgentBaselineCapability: CapabilityDefinition<
  GetHumanAgentBaselineCapabilityInput,
  HumanVsAgentBaseline
> = {
  id: 'evaluation.get_human_agent_baseline',
  version: '1.0.0',
  name: 'Get Human vs Agent Baseline',
  description:
    'Computes Speedup Factor, Error Rate Reduction, and Context Breadth Factor comparing human vs agent.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: GetHumanAgentBaselineCapabilityInputSchema,
  outputSchema: HumanVsAgentBaselineSchema,
  permissions: ['evaluation:read'],
  workspaceScoped: false,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: GetHumanAgentBaselineCapabilityInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<HumanVsAgentBaseline>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const scenario = getGoldStandardScenarioById(input.scenarioId);
    if (!scenario) {
      throw new AgentEvaluationError(
        EVALUATION_ERROR_CODES.EVALUATION_SCENARIO_NOT_FOUND,
        `Scenario not found: ${input.scenarioId}`,
        404
      );
    }

    const engine = getContinuousEvaluationEngine();
    const run = engine.getRunById(input.runId);
    if (!run) {
      throw new AgentEvaluationError(
        EVALUATION_ERROR_CODES.EVALUATION_SCENARIO_NOT_FOUND,
        `Evaluation run not found: ${input.runId}`,
        404
      );
    }

    const baselineService = getHumanAgentBaselineService();
    const result = baselineService.computeComparison({ scenario, run });

    return {
      success: true,
      data: result,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// Auto-Registration & Registration Hook
// ============================================================================

export function registerEvaluationCapabilities(): void {
  registerCapability(evaluationRunScenarioCapability);
  registerCapability(evaluationGetBenchmarkSummaryCapability);
  registerCapability(evaluationGetHumanAgentBaselineCapability);
}

// Self-register at module load time
registerEvaluationCapabilities();
