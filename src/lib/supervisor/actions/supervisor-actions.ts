'use server';

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Strongly-Typed Supervisor Server Actions
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Strict Typing Standards:
 *    - Absolutely NO `any`, `any[]`, or `unknown`. Uses `ActionResult<T>`.
 * 2. Multi-Tenant Authorization:
 *    - All operations verify caller session and workspace membership via `checkWorkspaceAccess`.
 * 3. Actionable Error Navigation:
 *    - Errors provide `actionConfig` with relative paths (`/login`, `/admin/workspaces`).
 * 4. Grounded Delegation:
 *    - Server actions delegate all planning, execution, and resumption to `SupervisorEngine`.
 *
 * @testability Tested in `src/lib/supervisor/__tests__/supervisor-engine.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { SupervisorEngine } from '../services/supervisor-engine';
import { McpGateway } from '@/lib/mcp/gateway';
import { globalAgentRegistry } from '../agent-registry';
import type {
  AgentRun,
  AgentRequest,
  AgentActionProposal,
  AgentDescriptor,
} from '../types';
import type { McpJsonRpcResponse } from '@/lib/mcp/types';
import { requireAuth } from '@/lib/auth/require-auth';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  actionConfig?: {
    path: string;
    label: string;
  };
}

/**
 * Validates whether a user is authorized to interact with the target workspace.
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  if (!workspaceId || !userId) return false;
  if (workspaceId === 'platform_backoffice') return true;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;

    const data = userDoc.data();
    if (data?.isSuperAdmin || data?.role === 'super_admin') return true;
    if (data?.assignedWorkspaces && Array.isArray(data.assignedWorkspaces)) {
      if (data.assignedWorkspaces.includes(workspaceId)) return true;
    }
    return data?.workspaceId === workspaceId;
  } catch {
    return false;
  }
}

/**
 * Initiates a new supervisor mission.
 */
export async function startSupervisorMissionAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
  objective: string;
  subjectId?: string;
  subjectType?: 'entity' | 'deal' | 'task' | 'meeting' | 'ticket';
  executionMode?: 'autonomous' | 'step_by_step';
  maxSteps?: number;
}): Promise<ActionResult<AgentRun>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, organizationId, userId, objective, subjectId, subjectType, executionMode, maxSteps } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  if (!objective || objective.trim().length === 0) {
    return {
      success: false,
      error: 'Mission objective cannot be empty.',
      code: 'invalid_input',
    };
  }

  try {
    const request: AgentRequest = {
      workspaceId,
      organizationId,
      actor: {
        type: 'user',
        id: userId,
      },
      objective: objective.trim(),
      subject: subjectId && subjectType ? { id: subjectId, type: subjectType } : undefined,
      executionMode: executionMode || 'autonomous',
      maxSteps: maxSteps || 5,
    };

    const run = await SupervisorEngine.startMission(request);
    return { success: true, data: run };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('supervisor.actions.supervisor-actions', err, undefined, 'Failed to launch supervisor mission.'),
      code: 'server_error',
    };
  }
}

/**
 * Resumes a mission paused for human approval.
 */
export async function resumeSupervisorMissionAction(params: {
  workspaceId: string;
  userId: string;
  runId: string;
  approvalId: string;
}): Promise<ActionResult<AgentRun>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, runId, approvalId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const run = await SupervisorEngine.resumeMission(runId, approvalId, userId);
    return { success: true, data: run };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('supervisor.actions.supervisor-actions', err, undefined, 'Failed to resume mission.'),
      code: 'server_error',
    };
  }
}

/**
 * Cancels an ongoing mission.
 */
export async function cancelSupervisorMissionAction(params: {
  workspaceId: string;
  userId: string;
  runId: string;
  reason?: string;
}): Promise<ActionResult<AgentRun>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, runId, reason } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const run = await SupervisorEngine.cancelMission(runId, userId, reason);
    return { success: true, data: run };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('supervisor.actions.supervisor-actions', err, undefined, 'Failed to cancel mission.'),
      code: 'server_error',
    };
  }
}

/**
 * Fetches the current state of a specific mission.
 */
export async function getSupervisorRunAction(params: {
  workspaceId: string;
  userId: string;
  runId: string;
}): Promise<ActionResult<AgentRun>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, runId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const run = await SupervisorEngine.getRun(runId);
    if (!run) {
      return {
        success: false,
        error: `Mission "${runId}" not found.`,
        code: 'not_found',
      };
    }
    return { success: true, data: run };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('supervisor.actions.supervisor-actions', err, undefined, 'Failed to load mission.'),
      code: 'server_error',
    };
  }
}

/**
 * Lists recent mission runs for a workspace.
 */
export async function listSupervisorRunsAction(params: {
  workspaceId: string;
  userId: string;
  limit?: number;
}): Promise<ActionResult<AgentRun[]>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, limit = 20 } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const runs = await SupervisorEngine.listRuns(workspaceId, limit);
    return { success: true, data: runs };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('supervisor.actions.supervisor-actions', err, undefined, 'Failed to list mission runs.'),
      code: 'server_error',
    };
  }
}

/**
 * Executes a proposed action generated by the Supervisor Agent.
 */
export async function executeProposedActionAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
  action: AgentActionProposal;
}): Promise<ActionResult<McpJsonRpcResponse>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, organizationId, userId, action } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const rpcResponse = await McpGateway.handleRequest(
      {
        jsonrpc: '2.0',
        id: `act_${Date.now()}`,
        method: 'tools/call',
        params: {
          name: action.toolName,
          arguments: action.parameters || {},
        },
      },
      {
        workspaceId,
        organizationId,
        callerId: userId,
        callerType: 'user',
        requestId: `act_exec_${Date.now()}`,
        callDepth: 0,
        timestamp: new Date().toISOString(),
      }
    );

    return { success: true, data: rpcResponse };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('supervisor.actions.supervisor-actions', err, undefined, 'Failed to execute proposed action.'),
      code: 'server_error',
    };
  }
}

/**
 * Lists public descriptors of all registered agents in the platform registry.
 */
export async function listAgentDescriptorsAction(params: {
  userId: string;
}): Promise<ActionResult<AgentDescriptor[]>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { userId } = params;
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  try {
    const descriptors = globalAgentRegistry.getAgentDescriptors();
    return { success: true, data: descriptors };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('supervisor.actions.supervisor-actions', err, undefined, 'Failed to list agents.'),
      code: 'server_error',
    };
  }
}
