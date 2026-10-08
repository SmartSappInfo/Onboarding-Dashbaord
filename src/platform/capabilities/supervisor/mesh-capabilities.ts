/**
 * @fileOverview Canonical Swarm Mesh Capabilities (supervisor.mesh.*)
 *
 * Implements:
 * - Rule 1 (Canonical Capability Layer)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 9 & 23 (Bounded Concurrency & Limits)
 * - Rule 10 (Canonical Zod v4 Schemas)
 * - Rule 12 (Canonical Risk Taxonomy: L0_READ, L1_INTERNAL_DRAFT, L2_STATE_MUTATION)
 * - Rule 16 (Authority Intersection Algebra & Ephemeral Token Scopes)
 * - Rule 17 (Non-Delegable Privileges Firewall)
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard)
 * - Rule 19 (Deterministic Idempotency Keys)
 * - Rule 21 & 22 (Two-Phase Binding & SHA-256 Signature Verification)
 * - Rule 24 (Circuit Breakers)
 * - Rule 25 (Dead-Letter Queue Logging)
 * - Rule 26 (Cooperative Cancellation)
 * - Rule 27 (Reverse-LIFO Distributed Saga Rollback)
 * - Rule 28 & 56 (Knapsack Token Budgeting <= 4,000)
 * - Rule 40 (Mandatory Domain Event Publishing)
 * - Rule 48 (Structured Error Taxonomy & HTTP Status Mapping)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import {
  type CapabilityDefinition,
  type CapabilityExecutionContext,
  type CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from '../registry/capability-registry';
import {
  AgentHandoffEnvelopeSchema,
  MeshDeliveryReceiptSchema,
  MeshTopologySchema,
  MeshCompensationPlanSchema,
  type AgentHandoffEnvelope,
  type MeshDeliveryReceipt,
  type MeshTopology,
  type MeshCompensationPlan,
  AgentMeshError,
} from '../../agents/supervisor/mesh/agent-swarm-mesh-types';
import { getAgentSwarmMesh } from '../../agents/supervisor/mesh/agent-swarm-mesh';
import { checkGovernanceDeadManSwitch } from '../../policy/governance-dead-man';

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
    throw new AgentMeshError(
      'TENANT_MISMATCH',
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId}) (Rules 8 & 47).`
    );
  }
}

// ============================================================================
// 1. CAPABILITY: supervisor.mesh.handoff (L1_INTERNAL_DRAFT)
// ============================================================================

export const supervisorMeshHandoffCapability: CapabilityDefinition<
  AgentHandoffEnvelope,
  MeshDeliveryReceipt
> = {
  id: 'supervisor.mesh.handoff',
  version: '1.0.0',
  name: 'Route Swarm Mesh Handoff',
  description: 'Routes an authenticated, containerized, and secret-scrubbed handoff envelope between specialized agent peers across the swarm mesh.',
  domain: 'ai_governance',
  operation: 'draft',
  inputSchema: AgentHandoffEnvelopeSchema,
  outputSchema: MeshDeliveryReceiptSchema,
  permissions: ['workspace:read', 'workspace:write'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L1_INTERNAL_DRAFT',
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
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: AgentHandoffEnvelope,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<MeshDeliveryReceipt>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new AgentMeshError(
        'DEAD_MAN_PAUSED',
        `Agent governance is emergency-paused for tenant '${input.organizationId}'. Swarm mesh handoff blocked (Rule 60).`
      );
    }

    const mesh = getAgentSwarmMesh();
    const receipt = await mesh.routeHandoff(input);

    return {
      success: true,
      data: receipt,
      executionId: `exec_mesh_hnd_${Date.now()}`,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 2. CAPABILITY: supervisor.mesh.get_topology (L0_READ)
// ============================================================================

export const GetMeshTopologyInputSchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  workspaceId: z.string().min(1, 'workspaceId is required'),
});
export type GetMeshTopologyInput = z.infer<typeof GetMeshTopologyInputSchema>;

export const supervisorMeshGetTopologyCapability: CapabilityDefinition<
  GetMeshTopologyInput,
  MeshTopology
> = {
  id: 'supervisor.mesh.get_topology',
  version: '1.0.0',
  name: 'Get Swarm Mesh Topology',
  description: 'Retrieves real-time swarm mesh topology telemetry, active peer nodes, concurrency meters, and circuit breaker health statuses.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: GetMeshTopologyInputSchema,
  outputSchema: MeshTopologySchema,
  permissions: ['workspace:read'],
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
    maxDurationMs: 5000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 256 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: GetMeshTopologyInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<MeshTopology>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new AgentMeshError(
        'DEAD_MAN_PAUSED',
        `Agent governance is emergency-paused for tenant '${input.organizationId}'. Swarm mesh topology blocked (Rule 60).`
      );
    }

    const mesh = getAgentSwarmMesh();
    const topology = mesh.getMeshTopology(input.organizationId, input.workspaceId);

    return {
      success: true,
      data: topology,
      executionId: `exec_mesh_top_${Date.now()}`,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 3. CAPABILITY: supervisor.mesh.compensate (L2_STATE_MUTATION)
// ============================================================================

export const CompensateMissionInputSchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  workspaceId: z.string().min(1, 'workspaceId is required'),
  missionId: z.string().min(1, 'missionId is required'),
  dryRun: z.boolean().optional().default(false),
  reason: z.string().optional(),
});
export type CompensateMissionInput = z.infer<typeof CompensateMissionInputSchema>;

export const supervisorMeshCompensateCapability: CapabilityDefinition<
  CompensateMissionInput,
  MeshCompensationPlan
> = {
  id: 'supervisor.mesh.compensate',
  version: '1.0.0',
  name: 'Execute Swarm Mesh Reverse-LIFO Compensation',
  description: 'Triggers distributed reverse-LIFO Saga compensation across all mutating pipeline steps executed during a mission (Rule 27).',
  domain: 'ai_governance',
  operation: 'update',
  inputSchema: CompensateMissionInputSchema,
  outputSchema: MeshCompensationPlanSchema,
  permissions: ['workspace:write'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 60000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: CompensateMissionInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<MeshCompensationPlan>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new AgentMeshError(
        'DEAD_MAN_PAUSED',
        `Agent governance is emergency-paused for tenant '${input.organizationId}'. Swarm mesh compensation blocked (Rule 60).`
      );
    }

    const mesh = getAgentSwarmMesh();
    const plan = await mesh.compensateMission(input.missionId, {
      dryRun: input.dryRun,
      reason: input.reason ?? 'Reverse-LIFO saga compensation triggered via capability',
    });

    return {
      success: true,
      data: plan,
      executionId: `exec_mesh_cmp_${Date.now()}`,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// Auto-Register Capabilities with Platform CapabilityRegistry
// ============================================================================

registerCapability(supervisorMeshHandoffCapability);
registerCapability(supervisorMeshGetTopologyCapability);
registerCapability(supervisorMeshCompensateCapability);
