/**
 * @fileOverview Canonical Health & Discrepancy Capabilities (health.*) (Phase 14 Milestone 4)
 *
 * Implements:
 * - Rule 1 (Canonical Capability Layer): Pure capability definitions
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 10 (Inline Architectural Documentation)
 * - Rule 12 (Canonical Risk Taxonomy: L2_STATE_MUTATION for reset, L0_READ for scorecards & discrepancy)
 * - Rule 14 (Schema Fingerprinting & Tool Contracts)
 * - Rule 16 (Explicit Scoped RBAC: health:read, health:manage)
 * - Rule 17 (Non-Delegable Restrictions: health.reset_circuit_breaker is Non-Delegable)
 * - Rule 19 (Deterministic Idempotency)
 * - Rule 23 (Resource Governance & Timeout Ceilings)
 * - Rule 24 (Dynamic Circuit Breakers)
 * - Rule 26 (Cooperative Cancellation via AbortSignal)
 * - Rule 40 (Mandatory Domain Event Publishing)
 * - Rule 48 (Sanitized Error Taxonomy)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 61 (Mandatory Justification for Operator Actions >= 5 chars)
 * - Rule 67 (The Agent Implementation Gate)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod';
import {
  type CapabilityDefinition,
  type CapabilityExecutionContext,
  type CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from '../registry/capability-registry';
import {
  type AgentHealthScorecard,
  type DiscrepancyReport,
  AgentHealthScorecardSchema,
  DiscrepancyReportSchema,
  ResetCircuitBreakerInputSchema,
  EvaluateDiscrepancyInputSchema,
  type ResetCircuitBreakerInput,
  type EvaluateDiscrepancyInput,
  GetHealthScorecardInputSchema,
  type GetHealthScorecardInput,
  ListHealthScorecardsInputSchema,
  type ListHealthScorecardsInput,
  AgentHealthError,
} from '@/platform/verification/health/health-types';
import { getAgentHealthService } from '@/platform/verification/health/agent-health-service';
import { getDiscrepancyService } from '@/platform/verification/health/discrepancy-service';

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
    throw new AgentHealthError(
      'IDOR_VIOLATION',
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId})`
    );
  }
}

// ============================================================================
// 1. health.get_scorecard (L0_READ)
// ============================================================================

export { GetHealthScorecardInputSchema, type GetHealthScorecardInput };

export const healthGetScorecardCapability: CapabilityDefinition<
  GetHealthScorecardInput,
  AgentHealthScorecard
> = {
  id: 'health.get_scorecard',
  version: '1.0.0',
  name: 'Get Agent Health Scorecard',
  description:
    'Retrieves the real-time health scorecard, failure SLA telemetry, and circuit breaker status for an agent persona.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: GetHealthScorecardInputSchema,
  outputSchema: AgentHealthScorecardSchema,
  permissions: ['health:read'],
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
    maxDurationMs: 10000,
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
    input: GetHealthScorecardInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<AgentHealthScorecard>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getAgentHealthService();
    const result = await service.getScorecard(input);

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
// 2. health.list_scorecards (L0_READ)
// ============================================================================

export { ListHealthScorecardsInputSchema, type ListHealthScorecardsInput };

export const healthListScorecardsCapability: CapabilityDefinition<
  ListHealthScorecardsInput,
  AgentHealthScorecard[]
> = {
  id: 'health.list_scorecards',
  version: '1.0.0',
  name: 'List Agent Health Scorecards',
  description:
    'Lists real-time health scorecards and circuit breaker statuses for all agent personas across a workspace.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: ListHealthScorecardsInputSchema,
  outputSchema: z.array(AgentHealthScorecardSchema),
  permissions: ['health:read'],
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
    maxDurationMs: 10000,
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
    input: ListHealthScorecardsInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<AgentHealthScorecard[]>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getAgentHealthService();
    const result = await service.listScorecards(input);

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
// 3. health.reset_circuit_breaker (L2_STATE_MUTATION, Non-Delegable: true)
// ============================================================================

export const healthResetCircuitBreakerCapability: CapabilityDefinition<
  ResetCircuitBreakerInput,
  AgentHealthScorecard
> = {
  id: 'health.reset_circuit_breaker',
  version: '1.0.0',
  name: 'Reset Agent Circuit Breaker',
  description:
    'Manually resets a tripped agent circuit breaker to HALF_OPEN state with mandatory audit justification. Non-delegable: restricted to human operators (Rule 17 & 61).',
  domain: 'ai_governance',
  operation: 'update',
  inputSchema: ResetCircuitBreakerInputSchema,
  outputSchema: AgentHealthScorecardSchema,
  permissions: ['health:manage'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: true,
    nonDelegable: true, // Rule 17: Non-Delegable action
  },
  execution: {
    synchronous: true,
    maxDurationMs: 15000,
    supportsDryRun: false,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1048576,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: ResetCircuitBreakerInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<AgentHealthScorecard>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getAgentHealthService();
    const result = await service.resetCircuitBreaker({
      ...input,
      actor: {
        type: context.principal.type ?? 'user',
        id: context.principal.id,
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
// 4. health.evaluate_discrepancy (L0_READ)
// ============================================================================

export const healthEvaluateDiscrepancyCapability: CapabilityDefinition<
  EvaluateDiscrepancyInput,
  DiscrepancyReport
> = {
  id: 'health.evaluate_discrepancy',
  version: '1.0.0',
  name: 'Evaluate Side-Effect Discrepancy',
  description:
    'Compares predicted state changes against actual mutations, classifies variances, and optionally triggers autonomous self-healing (Step 4 of Responsible Execution Loop).',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: EvaluateDiscrepancyInputSchema,
  outputSchema: DiscrepancyReportSchema,
  permissions: ['health:read'],
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
    maxDurationMs: 15000,
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
    input: EvaluateDiscrepancyInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<DiscrepancyReport>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getDiscrepancyService();
    const result = await service.evaluateDiscrepancy(input);

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
// REGISTRATION AT IMPORT TIME (Rule 69 Strangler Invariant)
// ============================================================================

registerCapability(healthGetScorecardCapability);
registerCapability(healthListScorecardsCapability);
registerCapability(healthResetCircuitBreakerCapability);
registerCapability(healthEvaluateDiscrepancyCapability);
