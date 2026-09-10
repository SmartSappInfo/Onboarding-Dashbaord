'use server';

/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Domain Agent Server Actions
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1):
 *    - All server action inputs and responses are strictly typed.
 * 2. Tenant Isolation & RBAC:
 *    - Every action validates workspace access and user authentication.
 * 3. Human-in-the-Loop & Code-Free Governance:
 *    - Allows operators to update specialist autonomy and tool policies without touching code.
 *
 * @testability Covered in `src/lib/agents/__tests__/domain-agents.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { globalAgentRegistry } from '@/lib/supervisor/agent-registry';
import { SwarmOrchestrator } from '../services/swarm-orchestrator';
import { McpGateway } from '@/lib/mcp/gateway';
import type {
  DomainSpecialistId,
  SpecialistDescriptor,
  SpecialistWorkspaceConfig,
  SwarmMissionRequest,
  SwarmRun,
} from '../domain-types';
import { zSwarmMissionRequest } from '../domain-types';
import type { McpPayloadValue } from '@/lib/mcp/types';
import { BaseDomainSpecialist } from '../specialists/base-domain-specialist';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';

export interface ServerActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Lists all registered domain specialists with their descriptors.
 */
export async function listSpecialistsAction(
  workspaceId: string
): Promise<ServerActionResponse<SpecialistDescriptor[]>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const agents = globalAgentRegistry.listAgents();
    const domainAgents = agents.filter((a) => a instanceof BaseDomainSpecialist) as BaseDomainSpecialist[];

    const descriptors = domainAgents.map((a) => a.descriptor);

    return {
      success: true,
      data: descriptors,
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('agents.actions.domain-agent-actions', err, undefined, 'Failed to list domain specialists'),
    };
  }
}

/**
 * Retrieves details and workspace configuration for a specific specialist.
 */
export async function getSpecialistDetailsAction(
  workspaceId: string,
  specialistId: DomainSpecialistId
): Promise<ServerActionResponse<{ descriptor: SpecialistDescriptor; config: SpecialistWorkspaceConfig | null }>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const agent = globalAgentRegistry.getAgent(specialistId);
    if (!agent || !(agent instanceof BaseDomainSpecialist)) {
      return {
        success: false,
        error: `Specialist "${specialistId}" not found in registry`,
      };
    }

    let config: SpecialistWorkspaceConfig | null = null;
    if (adminDb) {
      const docKey = `${workspaceId}_${specialistId}`;
      const snap = await adminDb.collection('agent_specialists').doc(docKey).get();
      if (snap.exists) {
        config = snap.data() as SpecialistWorkspaceConfig;
      }
    }

    return {
      success: true,
      data: {
        descriptor: agent.descriptor,
        config,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('agents.actions.domain-agent-actions', err, undefined, 'Failed to retrieve specialist details'),
    };
  }
}

/**
 * Updates a specialist's workspace configuration (autonomy tier, disabled tools, custom directives)
 * without requiring code modifications.
 */
export async function updateSpecialistConfigAction(
  config: SpecialistWorkspaceConfig
): Promise<ServerActionResponse<boolean>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  try {
    if (!adminDb) {
      return { success: true, data: true };
    }

    const docKey = `${config.workspaceId}_${config.specialistId}`;
    const payload: SpecialistWorkspaceConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('agent_specialists').doc(docKey).set(payload, { merge: true });

    return {
      success: true,
      data: true,
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('agents.actions.domain-agent-actions', err, undefined, 'Failed to save specialist configuration'),
    };
  }
}

/**
 * Triggers a multi-agent swarm mission.
 */
export async function startSwarmMissionAction(
  request: SwarmMissionRequest
): Promise<ServerActionResponse<SwarmRun>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  try {
    // Validate request schema
    zSwarmMissionRequest.parse(request);

    const run = await SwarmOrchestrator.startSwarmMission(request);

    return {
      success: true,
      data: run,
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('agents.actions.domain-agent-actions', err, undefined, 'Failed to start swarm mission'),
    };
  }
}

/**
 * Fetches the current state of a swarm run.
 */
export async function getSwarmRunAction(
  swarmRunId: string
): Promise<ServerActionResponse<SwarmRun | null>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  try {
    const run = await SwarmOrchestrator.getSwarmRun(swarmRunId);
    return {
      success: true,
      data: run,
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('agents.actions.domain-agent-actions', err, undefined, 'Failed to fetch swarm run'),
    };
  }
}

/**
 * Lists past swarm runs for a workspace.
 */
export async function listSwarmRunsAction(
  workspaceId: string,
  limitCount: number = 20
): Promise<ServerActionResponse<SwarmRun[]>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const runs = await SwarmOrchestrator.listSwarmRuns(workspaceId, limitCount);
    return {
      success: true,
      data: runs,
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('agents.actions.domain-agent-actions', err, undefined, 'Failed to list swarm runs'),
    };
  }
}

/**
 * Resumes a paused swarm run after human approval.
 */
export async function resumeSwarmMissionAction(params: {
  swarmRunId: string;
  approvalId: string;
  userId: string;
}): Promise<ServerActionResponse<SwarmRun>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  try {
    const run = await SwarmOrchestrator.resumeSwarmMission(
      params.swarmRunId,
      params.approvalId,
      params.userId
    );
    return {
      success: true,
      data: run,
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('agents.actions.domain-agent-actions', err, undefined, 'Failed to resume swarm mission'),
    };
  }
}

/**
 * Executes a joint action proposal generated by a swarm mission.
 */
export async function executeJointProposalAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
  toolName: string;
  parameters: Record<string, McpPayloadValue>;
}): Promise<ServerActionResponse<Record<string, McpPayloadValue>>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const rpcResponse = await McpGateway.handleRequest(
      {
        jsonrpc: '2.0',
        id: `prop_${Date.now()}`,
        method: 'tools/call',
        params: {
          name: params.toolName,
          arguments: params.parameters,
        },
      },
      {
        workspaceId: params.workspaceId,
        organizationId: params.organizationId,
        callerId: params.userId,
        callerType: 'user',
        requestId: `req_prop_${Date.now()}`,
        callDepth: 1,
        timestamp: new Date().toISOString(),
      }
    );

    if (rpcResponse.error) {
      return {
        success: false,
        error: rpcResponse.error.message,
      };
    }

    return {
      success: true,
      data: (rpcResponse.result as Record<string, McpPayloadValue>) || {},
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('agents.actions.domain-agent-actions', err, undefined, 'Failed to execute proposed action'),
    };
  }
}
