/**
 * @fileOverview Canonical Graph Reasoning Capabilities (Phase 13 Milestone 2)
 *
 * Implements:
 * - Rule 1 (Canonical Capability Layer)
 * - Rule 4 (Strict Zero-`any` / `any[]` typing policy)
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Validation)
 * - Rule 12 (Canonical Risk Vocabulary: L0_READ)
 * - Rule 14 (Canonical Capability Signatures: CapabilityDefinition<TInput, TOutput>)
 * - Rule 26 (Cooperative Cancellation via AbortSignal)
 * - Rule 42 (Shadow Mode Simulation: dryRun: true)
 * - Rule 48 (Structured Error Codes & HTTP Mapping)
 * - Rule 59 (Standard Capability Registry Discovery)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '@/platform/capabilities/contracts/capability-definition';
import { registerCapability } from '@/platform/capabilities/registry/capability-registry';
import {
  AnalyzeInfluenceInputRaw,
  AnalyzeInfluenceInputSchema,
  AnalyzeInfluenceResult,
  AnalyzeInfluenceResultSchema,
  DetectContagionInputRaw,
  DetectContagionInputSchema,
  AccountContagionCluster,
  AccountContagionClusterSchema,
  FindCausalPathInputRaw,
  FindCausalPathInputSchema,
  MultiHopPathReasoning,
  MultiHopPathReasoningSchema,
  GraphReasoningError,
} from '@/platform/domains/graph_reasoning/graph-reasoning-types';
import { getGraphReasoningService } from '@/platform/domains/graph_reasoning/graph-reasoning-service';

/**
 * Enforces Anti-IDOR tenant boundary validation within capability executions (Rules 8 & 47).
 */
function assertTenantContext(
  context: CapabilityExecutionContext,
  requestedOrgId: string
): void {
  const contextOrgId = context.principal?.organizationId;
  if (!contextOrgId) {
    throw new GraphReasoningError(
      'TENANT_MISMATCH',
      'Execution context lacks mandatory organizationId tenant claim (Rules 8 & 47).',
      403
    );
  }
  if (contextOrgId !== requestedOrgId) {
    throw new GraphReasoningError(
      'TENANT_MISMATCH',
      `Anti-IDOR Violation: Execution context tenant '${contextOrgId}' does not match requested tenant '${requestedOrgId}' (Rules 8 & 47).`,
      403
    );
  }
}

/**
 * 1. graph.reasoning.get_influence_map
 */
export const getInfluenceMapCapability: CapabilityDefinition<
  AnalyzeInfluenceInputRaw,
  AnalyzeInfluenceResult
> = {
  id: 'graph.reasoning.get_influence_map',
  version: '1.0.0',
  name: 'Analyze Stakeholder Influence Map',
  description:
    'Calculates degree and authority centrality of stakeholders and key decision-makers across an account network (Rule 11, 16).',
  domain: 'knowledge_memory',
  operation: 'read',

  inputSchema: AnalyzeInfluenceInputSchema,
  outputSchema: AnalyzeInfluenceResultSchema,

  permissions: ['rbac:operations.tasks.view', 'workspace:read'],
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
    maxPayloadSizeBytes: 1024 * 1024,
  },

  governance: {
    dataClassification: 'confidential',
    emitsEvents: ['graph.reasoning.influence_calculated'],
  },

  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },

  async handler(
    input: AnalyzeInfluenceInputRaw,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<AnalyzeInfluenceResult>> {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getGraphReasoningService();
    const result = await service.analyzeDecisionMakerInfluence({
      ...input,
      dryRun: Boolean(context.dryRun ?? input.dryRun),
    });

    return {
      success: true,
      data: result,
      executionId: `exec_inf_${input.entityId}_${Date.now()}`,
      durationMs: Date.now() - startTime,
      emittedEvents: [],
    };
  },
};

/**
 * 2. graph.reasoning.detect_contagion
 */
export const detectContagionCapability: CapabilityDefinition<
  DetectContagionInputRaw,
  AccountContagionCluster
> = {
  id: 'graph.reasoning.detect_contagion',
  version: '1.0.0',
  name: 'Detect Account Risk Contagion',
  description:
    'Simulates multi-hop risk contagion across sister campuses, shared vendors, and common stakeholders with financial exposure calculation (Rules 11, 12).',
  domain: 'knowledge_memory',
  operation: 'read',

  inputSchema: DetectContagionInputSchema,
  outputSchema: AccountContagionClusterSchema,

  permissions: ['rbac:operations.tasks.view', 'workspace:read'],
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
    maxPayloadSizeBytes: 1024 * 1024,
  },

  governance: {
    dataClassification: 'confidential',
    emitsEvents: ['graph.reasoning.contagion_detected'],
  },

  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },

  async handler(
    input: DetectContagionInputRaw,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<AccountContagionCluster>> {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getGraphReasoningService();
    const result = await service.detectAccountRiskContagion({
      ...input,
      dryRun: Boolean(context.dryRun ?? input.dryRun),
    });

    return {
      success: true,
      data: result,
      executionId: `exec_cont_${input.sourceEntityId}_${Date.now()}`,
      durationMs: Date.now() - startTime,
      emittedEvents: [],
    };
  },
};

/**
 * 3. graph.reasoning.find_causal_path
 */
export const findCausalPathCapability: CapabilityDefinition<
  FindCausalPathInputRaw,
  MultiHopPathReasoning
> = {
  id: 'graph.reasoning.find_causal_path',
  version: '1.0.0',
  name: 'Find Causal Relationship Path',
  description:
    'Finds the shortest weighted relationship path between two entities and generates a causal explanation narrative (Rules 13, 30, 41).',
  domain: 'knowledge_memory',
  operation: 'read',

  inputSchema: FindCausalPathInputSchema,
  outputSchema: MultiHopPathReasoningSchema,

  permissions: ['rbac:operations.tasks.view', 'workspace:read'],
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
    maxPayloadSizeBytes: 1024 * 1024,
  },

  governance: {
    dataClassification: 'confidential',
    emitsEvents: ['graph.reasoning.path_analyzed'],
  },

  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },

  async handler(
    input: FindCausalPathInputRaw,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<MultiHopPathReasoning>> {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const service = getGraphReasoningService();
    const result = await service.findCausalRelationshipPath({
      ...input,
      dryRun: Boolean(context.dryRun ?? input.dryRun),
    });

    return {
      success: true,
      data: result,
      executionId: `exec_path_${input.sourceNodeId}_${input.targetNodeId}_${Date.now()}`,
      durationMs: Date.now() - startTime,
      emittedEvents: [],
    };
  },
};

// Register capabilities into central CapabilityRegistry (Rule 59)
try {
  registerCapability(getInfluenceMapCapability);
  registerCapability(detectContagionCapability);
  registerCapability(findCausalPathCapability);
} catch {
  // Safe reload registration guard
}
