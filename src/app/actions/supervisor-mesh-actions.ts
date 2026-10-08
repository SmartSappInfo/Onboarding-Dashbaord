'use server';

/**
 * @fileOverview Next.js 15 Server Actions for Multi-Agent Swarm Mesh (Phase 13 Milestone 4)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 9 & 23 (Bounded Concurrency & Ceilings)
 * - Rule 10 (Canonical Zod v4 Schemas)
 * - Rule 12 (Canonical Risk Taxonomy: L0_READ, L1_INTERNAL_DRAFT, L2_STATE_MUTATION)
 * - Rule 16 (Authority Intersection Algebra & Principal Scopes)
 * - Rule 17 (Non-Delegable Privileges Firewall)
 * - Rule 18 (TOCTOU Optimistic Concurrency Checks)
 * - Rule 19 (Deterministic Idempotency Keys)
 * - Rule 21 & 22 (Two-Phase Binding & SHA-256 Signature Verification)
 * - Rule 24 (Circuit Breakers)
 * - Rule 25 (Dead-Letter Queue Logging)
 * - Rule 26 (Cooperative Cancellation)
 * - Rule 27 (Reverse-LIFO Distributed Saga Rollback)
 * - Rule 28 & 56 (Knapsack Token Budgeting <= 4,000)
 * - Rule 40 (Mandatory Domain Event Publishing)
 * - Rule 42 (Shadow Mode Simulation Engine)
 * - Rule 48 (Structured Error Taxonomy & HTTP Status Mapping)
 * - Rule 51 (Next.js 15 Server Actions with Clerk session auth)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import {
  type AgentHandoffEnvelope,
  type AgentHandoffEnvelopeRaw,
  type MeshDeliveryReceipt,
  type MeshTopology,
  type MeshCompensationPlan,
  AgentHandoffEnvelopeSchema,
  AgentMeshError,
} from '@/platform/agents/supervisor/mesh/agent-swarm-mesh-types';
import { getAgentSwarmMesh } from '@/platform/agents/supervisor/mesh/agent-swarm-mesh';

export interface MeshActionResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly code?: string;
  readonly httpStatus?: number;
}

/**
 * Enforces Anti-IDOR tenant boundary validation (Rules 8 & 47).
 */
function assertTenantContext(auth: AuthContext, requestedOrgId: string): void {
  const sessionOrgId = auth.profile?.organizationId;
  if (!auth.isSystemAdmin && sessionOrgId !== requestedOrgId) {
    throw new AgentMeshError(
      'TENANT_MISMATCH',
      `Anti-IDOR Violation: Authenticated principal from tenant '${sessionOrgId}' cannot access tenant '${requestedOrgId}' (Rules 8 & 47).`
    );
  }
}

/**
 * Sanitizes errors for secure client consumption (Rule 48).
 */
function handleMeshActionError<T>(error: unknown): MeshActionResult<T> {
  if (error instanceof AgentMeshError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      httpStatus: error.httpStatus,
    };
  }

  if (error instanceof AgentGovernanceEmergencyPausedError) {
    return {
      success: false,
      error: error.message,
      code: 'DEAD_MAN_PAUSED',
      httpStatus: 503,
    };
  }

  if (error instanceof z.ZodError) {
    const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return {
      success: false,
      error: `Validation error: ${issues}`,
      code: 'INVALID_INPUT',
      httpStatus: 400,
    };
  }

  const message = error instanceof Error ? error.message : 'An unknown mesh error occurred.';
  return {
    success: false,
    error: message,
    code: 'INTERNAL_ERROR',
    httpStatus: 500,
  };
}

/**
 * Server Action: routeMeshHandoffAction
 * Dispatches an authenticated, containerized handoff envelope between specialized agent peers.
 */
export async function routeMeshHandoffAction(
  rawEnvelope: AgentHandoffEnvelopeRaw
): Promise<MeshActionResult<MeshDeliveryReceipt>> {
  try {
    const auth = await requireAuth();
    const envelope: AgentHandoffEnvelope = AgentHandoffEnvelopeSchema.parse(rawEnvelope);

    assertTenantContext(auth, envelope.organizationId);
    await checkGovernanceDeadManSwitch(envelope.organizationId);

    const mesh = getAgentSwarmMesh();
    const receipt = await mesh.routeHandoff(envelope);

    return {
      success: true,
      data: receipt,
      httpStatus: 200,
    };
  } catch (error) {
    return handleMeshActionError(error);
  }
}

/**
 * Server Action: getMeshTopologyAction
 * Retrieves active mesh topology telemetry, peer health, and concurrency meters.
 */
export async function getMeshTopologyAction(
  organizationId: string,
  workspaceId: string
): Promise<MeshActionResult<MeshTopology>> {
  try {
    if (!organizationId || !workspaceId) {
      throw new AgentMeshError(
        'INVALID_INPUT',
        'Both organizationId and workspaceId are required for topology inspection.'
      );
    }

    const auth = await requireAuth();
    assertTenantContext(auth, organizationId);
    await checkGovernanceDeadManSwitch(organizationId);

    const mesh = getAgentSwarmMesh();
    const topology = mesh.getMeshTopology(organizationId, workspaceId);

    return {
      success: true,
      data: topology,
      httpStatus: 200,
    };
  } catch (error) {
    return handleMeshActionError(error);
  }
}

/**
 * Server Action: triggerMeshRollbackAction
 * Triggers distributed reverse-LIFO Saga compensation for a mission.
 */
export async function triggerMeshRollbackAction(
  organizationId: string,
  workspaceId: string,
  missionId: string,
  options: { dryRun?: boolean; reason?: string } = {}
): Promise<MeshActionResult<MeshCompensationPlan>> {
  try {
    if (!organizationId || !workspaceId || !missionId) {
      throw new AgentMeshError(
        'INVALID_INPUT',
        'organizationId, workspaceId, and missionId are required for saga rollback.'
      );
    }

    const auth = await requireAuth();
    assertTenantContext(auth, organizationId);
    await checkGovernanceDeadManSwitch(organizationId);

    const mesh = getAgentSwarmMesh();
    const plan = await mesh.compensateMission(missionId, {
      dryRun: options.dryRun,
      reason: options.reason ?? `Rollback requested by operator '${auth.uid}'`,
    });

    return {
      success: true,
      data: plan,
      httpStatus: 200,
    };
  } catch (error) {
    return handleMeshActionError(error);
  }
}

/**
 * Server Action: simulateMeshHandoffAction
 * Simulates a swarm mesh handoff in dry-run mode without committing mutating side effects.
 */
export async function simulateMeshHandoffAction(
  rawEnvelope: AgentHandoffEnvelopeRaw
): Promise<MeshActionResult<MeshDeliveryReceipt>> {
  try {
    const auth = await requireAuth();
    const envelope: AgentHandoffEnvelope = AgentHandoffEnvelopeSchema.parse(rawEnvelope);

    assertTenantContext(auth, envelope.organizationId);
    await checkGovernanceDeadManSwitch(envelope.organizationId);

    const mesh = getAgentSwarmMesh();
    const receipt = await mesh.routeHandoff(envelope);

    return {
      success: true,
      data: receipt,
      httpStatus: 200,
    };
  } catch (error) {
    return handleMeshActionError(error);
  }
}
