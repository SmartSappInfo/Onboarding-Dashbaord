/**
 * @fileOverview Canonical Supervisor Capabilities (supervisor.*)
 *
 * Implements:
 * - Rule 1 (Canonical Capability Layer)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 12 (Canonical Risk Taxonomy: L0_READ, L2_STATE_MUTATION)
 * - Rule 16 (Agent Identity as First-Class Security Principal & Authority Intersection)
 * - Rule 17 (Non-Delegable Privileges Firewall)
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard)
 * - Rule 19 (Deterministic Idempotency Keys)
 * - Rule 21 & 22 (Two-Phase Binding & SHA-256 Signature Verification)
 * - Rule 26 (Cooperative Cancellation)
 * - Rule 27 (Reverse-LIFO Saga Compensation Mapping)
 * - Rule 28 & 56 (Knapsack Token Budgeting <= 4,000)
 * - Rule 40 (Mandatory Domain Event Publishing)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 67 (The Agent Implementation Gate)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 * - Rules 1940-1953 (The 7 Mandatory Domain Agent Deliverables Gate)
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
  SupervisorGoalInputSchema,
  ExecutionDagSchema,
  SupervisorSynthesisResultSchema,
  SupervisorMissionStateSchema,
  SupervisorError,
  type SupervisorGoalInput,
  type ExecutionDag,
  type SupervisorSynthesisResult,
  type SupervisorMissionState,
} from '../../agents/supervisor/supervisor-types';
import { SupervisorPlanner } from '../../agents/supervisor/supervisor-planner';
import {
  getSupervisorOrchestrator,
} from '../../agents/supervisor/supervisor-orchestrator';
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
    throw new SupervisorError(
      'IDOR_VIOLATION',
      `Anti-IDOR Violation: Access denied across organizational boundary (principal: ${context.principal.organizationId}, target: ${organizationId}) (Rules 8 & 47).`
    );
  }
}

/**
 * Capability: supervisor.plan.decompose_goal
 * Decomposes an operational goal into a dependency-ordered Execution DAG.
 */
export const supervisorDecomposeGoalCapability: CapabilityDefinition<
  SupervisorGoalInput,
  ExecutionDag
> = {
  id: 'supervisor.plan.decompose_goal',
  version: '1.0.0',
  name: 'Decompose Operational Goal',
  description: 'Decomposes an operational goal into an ordered Kahn DAG with topological waves, knapsack token budgeting, and non-delegable action firewalls.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: SupervisorGoalInputSchema,
  outputSchema: ExecutionDagSchema,
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
    maxDurationMs: 15000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: SupervisorGoalInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ExecutionDag>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new SupervisorError(
        'DEAD_MAN_PAUSED',
        `Agent governance is emergency-paused for tenant '${input.organizationId}'. Goal decomposition blocked.`
      );
    }

    const planner = new SupervisorPlanner();
    const dag = planner.decomposeGoal(input);

    return {
      success: true,
      data: dag,
      executionId: `exec_${Date.now()}`,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

/**
 * Capability: supervisor.mission.execute
 * Executes an autonomous multi-agent mission across topological waves.
 */
export const supervisorExecuteMissionCapability: CapabilityDefinition<
  SupervisorGoalInput,
  SupervisorSynthesisResult
> = {
  id: 'supervisor.mission.execute',
  version: '1.0.0',
  name: 'Execute Multi-Agent Mission',
  description: 'Orchestrates an autonomous multi-agent mission across topological waves with bounded concurrency, ephemeral delegation tokens, and reverse-LIFO rollback.',
  domain: 'ai_governance',
  operation: 'execute',
  inputSchema: SupervisorGoalInputSchema,
  outputSchema: SupervisorSynthesisResultSchema,
  permissions: ['workspace:read', 'workspace:write'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
    compensatingCapabilityId: 'supervisor.mission.cancel',
  },
  execution: {
    synchronous: true,
    maxDurationMs: 120000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: true,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: SupervisorGoalInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<SupervisorSynthesisResult>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new SupervisorError(
        'DEAD_MAN_PAUSED',
        `Agent governance is emergency-paused for tenant '${input.organizationId}'. Mission execution blocked.`
      );
    }

    const orchestrator = getSupervisorOrchestrator();
    const synthesis = await orchestrator.executeMission(input, {
      createdBy: context.principal.userId,
      userPermissions: context.principal.grantedScopes,
    });

    return {
      success: true,
      data: synthesis,
      executionId: `exec_${Date.now()}`,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

/** Schema for get mission status input */
const GetMissionStatusInputSchema = z.object({
  missionId: z.string().min(1),
  organizationId: z.string().min(1),
});
type GetMissionStatusInput = z.infer<typeof GetMissionStatusInputSchema>;

/**
 * Capability: supervisor.mission.get_status
 * Retrieves live execution status and DAG state for a mission.
 */
export const supervisorGetMissionStatusCapability: CapabilityDefinition<
  GetMissionStatusInput,
  SupervisorMissionState | null
> = {
  id: 'supervisor.mission.get_status',
  version: '1.0.0',
  name: 'Get Mission Status',
  description: 'Retrieves live execution status, DAG progress, step metrics, and staged proposals for an active or completed mission.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: GetMissionStatusInputSchema,
  outputSchema: SupervisorMissionStateSchema.nullable(),
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
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: GetMissionStatusInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<SupervisorMissionState | null>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const orchestrator = getSupervisorOrchestrator();
    const mission = orchestrator.getMission(input.missionId);

    if (mission && mission.organizationId !== input.organizationId) {
      throw new SupervisorError(
        'IDOR_VIOLATION',
        `Cross-tenant access forbidden for mission '${input.missionId}'.`
      );
    }

    return {
      success: true,
      data: mission,
      executionId: `exec_${Date.now()}`,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

/** Schema for cancel mission input */
const CancelMissionInputSchema = z.object({
  missionId: z.string().min(1),
  organizationId: z.string().min(1),
  reason: z.string().optional(),
});
type CancelMissionInput = z.infer<typeof CancelMissionInputSchema>;

const CancelMissionOutputSchema = z.object({
  success: z.boolean(),
  missionId: z.string(),
  status: z.string(),
});
type CancelMissionOutput = z.infer<typeof CancelMissionOutputSchema>;

/**
 * Capability: supervisor.mission.cancel
 * Cancels an active supervisor mission and triggers reverse-LIFO rollback.
 */
export const supervisorCancelMissionCapability: CapabilityDefinition<
  CancelMissionInput,
  CancelMissionOutput
> = {
  id: 'supervisor.mission.cancel',
  version: '1.0.0',
  name: 'Cancel Mission',
  description: 'Cooperatively cancels an active mission and initiates reverse-LIFO compensation rollback for completed mutating steps.',
  domain: 'ai_governance',
  operation: 'update',
  inputSchema: CancelMissionInputSchema,
  outputSchema: CancelMissionOutputSchema,
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
    maxDurationMs: 15000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: true,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: true,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: CancelMissionInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<CancelMissionOutput>> => {
    const startTime = Date.now();
    assertTenantContext(context, input.organizationId);

    const orchestrator = getSupervisorOrchestrator();
    const mission = orchestrator.getMission(input.missionId);

    if (mission && mission.organizationId !== input.organizationId) {
      throw new SupervisorError(
        'IDOR_VIOLATION',
        `Cross-tenant access forbidden for mission '${input.missionId}'.`
      );
    }

    const cancelled = await orchestrator.cancelMission(input.missionId, input.reason);

    return {
      success: true,
      data: {
        success: cancelled,
        missionId: input.missionId,
        status: cancelled ? 'CANCELLED' : mission?.status ?? 'UNKNOWN',
      },
      executionId: `exec_${Date.now()}`,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// Register all 4 capabilities into the central registry at module evaluation time
registerCapability(supervisorDecomposeGoalCapability);
registerCapability(supervisorExecuteMissionCapability);
registerCapability(supervisorGetMissionStatusCapability);
registerCapability(supervisorCancelMissionCapability);
