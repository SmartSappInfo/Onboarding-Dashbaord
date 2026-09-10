'use server';

/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Strongly-Typed Workflow Server Actions
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Strict Typing Standards:
 *    - Absolutely NO `any`, `any[]`, or `unknown`. Returns typed `ActionResult<T>`.
 * 2. Multi-Tenant Authorization:
 *    - Validates session & workspace membership via `checkWorkspaceAccess` on all mutations and reads.
 * 3. Actionable Error Navigation:
 *    - Errors provide `actionConfig` with relative paths (`/admin/companybrain/workflows`, `/login`).
 * 4. Grounded Execution:
 *    - Delegates execution, simulation, and resumption to `WorkflowEngine`.
 *    - Persists workflows to `/brain_workflows` and runs to `/workflow_runs`.
 *
 * @testability Tested in `src/lib/workflows/__tests__/workflow-engine.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { WorkflowEngine } from '../services/workflow-engine';
import { TURNKEY_WORKFLOW_BLUEPRINTS } from '../blueprints';
import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowSimulationResult,
  WorkflowNodeConfig,
} from '../types';
import type { McpPayloadValue } from '@/lib/mcp/types';
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
 * Validates that a node list forms a Directed Acyclic Graph (DAG) with no cycles.
 */
function validateAcyclic(nodes: WorkflowNodeConfig[]): boolean {
  const nodeMap = new Map<string, WorkflowNodeConfig>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      for (const nextId of node.nextNodeIds) {
        if (!visited.has(nextId)) {
          if (hasCycle(nextId)) return true;
        } else if (recursionStack.has(nextId)) {
          return true; // Cycle detected
        }
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (hasCycle(node.id)) return false;
    }
  }

  return true;
}

/**
 * Lists all workflows defined in a workspace.
 */
export async function listWorkflowsAction(params: {
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<WorkflowDefinition[]>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId } = params;

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

  try {
    const snapshot = await adminDb
      .collection('brain_workflows')
      .where('workspaceId', '==', workspaceId)
      .get();

    const workflows: WorkflowDefinition[] = [];
    snapshot.forEach((doc) => {
      workflows.push(doc.data() as WorkflowDefinition);
    });

    // Sort descending by updatedAt
    workflows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return { success: true, data: workflows };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('workflows.actions.workflow-actions', err, undefined, 'Failed to retrieve workflows.'),
      code: 'server_error',
    };
  }
}

/**
 * Retrieves a single workflow by ID.
 */
export async function getWorkflowAction(params: {
  workflowId: string;
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<WorkflowDefinition>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workflowId, workspaceId, userId } = params;

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
    const doc = await adminDb.collection('brain_workflows').doc(workflowId).get();
    if (!doc.exists) {
      return {
        success: false,
        error: 'Workflow not found.',
        code: 'not_found',
      };
    }

    const workflow = doc.data() as WorkflowDefinition;
    if (workflow.workspaceId !== workspaceId && workspaceId !== 'platform_backoffice') {
      return {
        success: false,
        error: 'Workflow does not belong to this workspace.',
        code: 'unauthorized',
      };
    }

    return { success: true, data: workflow };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('workflows.actions.workflow-actions', err, undefined, 'Failed to retrieve workflow.'),
      code: 'server_error',
    };
  }
}

/**
 * Saves (creates or updates) a workflow definition with DAG cycle validation.
 */
export async function saveWorkflowAction(params: {
  workflow: WorkflowDefinition;
  userId: string;
}): Promise<ActionResult<WorkflowDefinition>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workflow, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workflow.workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied to target workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  if (!workflow.title || workflow.title.trim().length === 0) {
    return {
      success: false,
      error: 'Workflow title cannot be empty.',
      code: 'invalid_input',
    };
  }

  if (!workflow.nodes || workflow.nodes.length === 0) {
    return {
      success: false,
      error: 'Workflow must have at least one node.',
      code: 'invalid_input',
    };
  }

  if (workflow.nodes.length > 12) {
    return {
      success: false,
      error: 'Workflows cannot exceed the maximum 12-node ceiling.',
      code: 'invalid_input',
    };
  }

  // Validate DAG acyclicity
  if (!validateAcyclic(workflow.nodes)) {
    return {
      success: false,
      error: 'Workflow graph contains a cycle. Cycles are prohibited to prevent infinite execution loops.',
      code: 'cycle_detected',
    };
  }

  try {
    const now = new Date().toISOString();
    const cleanWorkflow: WorkflowDefinition = {
      ...workflow,
      updatedAt: now,
      createdBy: workflow.createdBy || userId,
      version: (workflow.version || 1) + 1,
    };

    if (!cleanWorkflow.id) {
      cleanWorkflow.id = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      cleanWorkflow.createdAt = now;
    }

    await adminDb.collection('brain_workflows').doc(cleanWorkflow.id).set(cleanWorkflow);

    return { success: true, data: cleanWorkflow };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('workflows.actions.workflow-actions', err, undefined, 'Failed to save workflow.'),
      code: 'server_error',
    };
  }
}

/**
 * Toggles a workflow active/paused state.
 */
export async function toggleWorkflowAction(params: {
  workflowId: string;
  workspaceId: string;
  status: 'active' | 'paused';
  userId: string;
}): Promise<ActionResult<{ status: 'active' | 'paused' }>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workflowId, workspaceId, status, userId } = params;

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
    const docRef = adminDb.collection('brain_workflows').doc(workflowId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        success: false,
        error: 'Workflow not found.',
        code: 'not_found',
      };
    }

    const current = doc.data() as WorkflowDefinition;
    if (current.workspaceId !== workspaceId && workspaceId !== 'platform_backoffice') {
      return {
        success: false,
        error: 'Workflow does not belong to this workspace.',
        code: 'unauthorized',
      };
    }

    await docRef.update({
      status,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, data: { status } };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('workflows.actions.workflow-actions', err, undefined, 'Failed to toggle workflow status.'),
      code: 'server_error',
    };
  }
}

/**
 * Manually starts a workflow execution run.
 */
export async function startWorkflowRunAction(params: {
  workflowId: string;
  workspaceId: string;
  userId: string;
  initialPayload?: Record<string, McpPayloadValue>;
}): Promise<ActionResult<WorkflowRun>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workflowId, workspaceId, userId, initialPayload } = params;

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
    const doc = await adminDb.collection('brain_workflows').doc(workflowId).get();
    if (!doc.exists) {
      return {
        success: false,
        error: 'Workflow not found.',
        code: 'not_found',
      };
    }

    const workflow = doc.data() as WorkflowDefinition;
    if (workflow.workspaceId !== workspaceId && workspaceId !== 'platform_backoffice') {
      return {
        success: false,
        error: 'Workflow does not belong to this workspace.',
        code: 'unauthorized',
      };
    }

    const run = await WorkflowEngine.startWorkflow(workflow.id, initialPayload || {}, userId);
    return { success: true, data: run };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('workflows.actions.workflow-actions', err, undefined, 'Failed to start workflow run.'),
      code: 'server_error',
      actionConfig: { path: '/admin/companybrain/workflows', label: 'Workflows Hub' },
    };
  }
}

/**
 * Retrieves a workflow run by ID.
 */
export async function getWorkflowRunAction(params: {
  runId: string;
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<WorkflowRun>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { runId, workspaceId, userId } = params;

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
    const run = await WorkflowEngine.getWorkflowRun(runId);
    if (!run) {
      return {
        success: false,
        error: 'Workflow run not found.',
        code: 'not_found',
      };
    }

    if (run.workspaceId !== workspaceId && workspaceId !== 'platform_backoffice') {
      return {
        success: false,
        error: 'Workflow run does not belong to this workspace.',
        code: 'unauthorized',
      };
    }

    return { success: true, data: run };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('workflows.actions.workflow-actions', err, undefined, 'Failed to retrieve workflow run.'),
      code: 'server_error',
    };
  }
}

/**
 * Lists historical runs for a workspace, optionally filtered by workflowId.
 */
export async function listWorkflowRunsAction(params: {
  workspaceId: string;
  userId: string;
  workflowId?: string;
  limit?: number;
}): Promise<ActionResult<WorkflowRun[]>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, workflowId, limit = 20 } = params;

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
    let query = adminDb
      .collection('workflow_runs')
      .where('workspaceId', '==', workspaceId);

    if (workflowId) {
      query = query.where('workflowId', '==', workflowId);
    }

    const snapshot = await query.get();
    const runs: WorkflowRun[] = [];

    snapshot.forEach((doc) => {
      runs.push(doc.data() as WorkflowRun);
    });

    // In-memory sort by startedAt descending to avoid indexing issues before indexes propagate
    runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return { success: true, data: runs.slice(0, limit) };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('workflows.actions.workflow-actions', err, undefined, 'Failed to retrieve workflow runs.'),
      code: 'server_error',
    };
  }
}

/**
 * Resumes a workflow run that was paused at an approval gate.
 */
export async function resumeWorkflowRunAction(params: {
  runId: string;
  workspaceId: string;
  approvalId: string;
  adjudication: 'approved' | 'rejected';
  userId: string;
}): Promise<ActionResult<WorkflowRun>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { runId, workspaceId, approvalId, adjudication, userId } = params;

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
    const run = await WorkflowEngine.resumeWorkflow(runId, approvalId, adjudication, userId);
    return { success: true, data: run };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('workflows.actions.workflow-actions', err, undefined, 'Failed to resume workflow run.'),
      code: 'server_error',
      actionConfig: { path: '/admin/companybrain/workflows', label: 'Workflows Hub' },
    };
  }
}

/**
 * Runs a dry-run simulation of a workflow without mutating persistent business entities.
 */
export async function simulateWorkflowAction(params: {
  workflow: WorkflowDefinition;
  workspaceId: string;
  userId: string;
  simulatedPayload: Record<string, McpPayloadValue>;
}): Promise<ActionResult<WorkflowSimulationResult>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workflow, workspaceId, userId, simulatedPayload } = params;

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
    const result = await WorkflowEngine.simulateWorkflow({
      workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customNodes: workflow.nodes,
      mockPayload: simulatedPayload,
    });
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('workflows.actions.workflow-actions', err, undefined, 'Workflow simulation failed.'),
      code: 'simulation_error',
    };
  }
}

/**
 * Installs one of the turnkey blueprints into the user's workspace.
 */
export async function installBlueprintAction(params: {
  blueprintId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
}): Promise<ActionResult<WorkflowDefinition>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { blueprintId, workspaceId, organizationId, userId } = params;

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

  const template = TURNKEY_WORKFLOW_BLUEPRINTS.find((b) => b.id === blueprintId);
  if (!template) {
    return {
      success: false,
      error: `Blueprint '${blueprintId}' not found. Available blueprints: ${TURNKEY_WORKFLOW_BLUEPRINTS.map((b) => b.id).join(', ')}`,
      code: 'not_found',
    };
  }

  try {
    const now = new Date().toISOString();
    const newWorkflowId = `wf_${template.id.replace('bp_', '')}_${Date.now()}`;

    const newWorkflow: WorkflowDefinition = {
      id: newWorkflowId,
      workspaceId,
      organizationId,
      title: template.title,
      description: template.description,
      blueprintId: template.id,
      trigger: template.trigger,
      nodes: template.nodes,
      status: 'active',
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await adminDb.collection('brain_workflows').doc(newWorkflowId).set(newWorkflow);

    return { success: true, data: newWorkflow };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('workflows.actions.workflow-actions', err, undefined, 'Failed to install blueprint.'),
      code: 'server_error',
    };
  }
}
