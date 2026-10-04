'use server';

/**
 * @fileOverview Workflow Admin Server Actions (Phase 7 Milestone 5)
 *
 * Implements:
 * - Rule 4: Zero `any` or `any[]` typing policy
 * - Rule 8 & 47: Anti-IDOR tenant validation matching session organizationId with inputs
 * - Rule 26 & 27: Cooperative cancellation and Saga unwind triggers
 * - Rule 40: Append-only audit logging and domain event emission
 * - Rule 51: Next.js Server Actions session authentication via requireAuth()
 * - Rule 60: Emergency Dead-Man Switch evaluation
 * - Rule 61: Backoffice operator control plane operations
 */

import { randomUUID } from 'node:crypto';
import { requireAuth } from '@/lib/auth/require-auth';
import { getWorkflowStore } from '@/platform/workflows/workflow-store';
import { getWorkflowTemplateRegistry } from '@/platform/workflows/templates/workflow-template-registry';
import {
  checkGovernanceDeadManSwitch,
} from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import type {
  WorkflowInstance,
  WorkflowStep,
  WorkflowCheckpoint,
  WorkflowState,
  TenantBoundary,
} from '@/platform/workflows/workflow-types';
import type { WorkflowTemplateDefinition } from '@/platform/workflows/templates/workflow-template-types';

export interface WorkflowActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface ListWorkflowsInput {
  organizationId?: string;
  workspaceId?: string;
  status?: WorkflowState;
  definitionId?: string;
  limit?: number;
  offset?: number;
}

export interface GetWorkflowDetailsInput {
  workflowId: string;
  workspaceId?: string;
  organizationId?: string;
}

export interface CancelWorkflowInput {
  workflowId: string;
  workspaceId?: string;
  organizationId?: string;
  reason?: string;
}

export interface InstantiateTemplateAdminInput {
  templateId: string;
  inputs?: Record<string, unknown>;
  title?: string;
  workspaceId?: string;
  organizationId?: string;
  dryRun?: boolean;
}

export interface WorkflowPlatformMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  waitingWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  isDeadManPaused: boolean;
}

async function resolveTenant(
  overrideOrgId?: string,
  overrideWsId?: string
): Promise<{ tenant: TenantBoundary; userId: string } | { error: string; code: string }> {
  try {
    const session = await requireAuth();
    const sessionOrgId =
      session.profile?.organizationId ||
      (session as unknown as { orgId?: string }).orgId;

    if (!sessionOrgId) {
      return { error: 'Authentication required', code: 'UNAUTHORIZED' };
    }

    // Anti-IDOR: reject mismatched caller organizationId (Rule 47)
    if (overrideOrgId && overrideOrgId !== sessionOrgId) {
      return {
        error: `Access denied: requested organization '${overrideOrgId}' conflicts with authenticated session.`,
        code: 'IDOR_VIOLATION',
      };
    }

    const sessionWsId =
      overrideWsId ||
      session.profile?.workspaceIds?.[0] ||
      (session as unknown as { workspaceId?: string }).workspaceId ||
      'default_ws';

    return {
      tenant: {
        organizationId: sessionOrgId,
        workspaceId: sessionWsId,
      },
      userId: session.uid,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Authentication failure',
      code: 'UNAUTHORIZED',
    };
  }
}

/**
 * Lists workflow instances scoped to caller's verified tenant.
 */
export async function listWorkflowsAction(
  input: ListWorkflowsInput = {}
): Promise<WorkflowActionResult<{ items: WorkflowInstance[]; total: number }>> {
  const auth = await resolveTenant(input.organizationId, input.workspaceId);
  if ('error' in auth) {
    return { success: false, error: auth.error, code: auth.code };
  }

  try {
    const store = getWorkflowStore();
    const result = await store.listInstances({
      organizationId: auth.tenant.organizationId,
      workspaceId: auth.tenant.workspaceId,
      status: input.status,
      definitionId: input.definitionId,
      limit: input.limit || 50,
      offset: input.offset || 0,
    });

    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list workflows',
      code: 'STORE_ERROR',
    };
  }
}

/**
 * Retrieves comprehensive details of a workflow instance, its steps, and audit checkpoints.
 */
export async function getWorkflowDetailsAction(
  input: GetWorkflowDetailsInput
): Promise<
  WorkflowActionResult<{
    instance: WorkflowInstance;
    steps: WorkflowStep[];
    checkpoints: WorkflowCheckpoint[];
  }>
> {
  const auth = await resolveTenant(input.organizationId, input.workspaceId);
  if ('error' in auth) {
    return { success: false, error: auth.error, code: auth.code };
  }

  try {
    const store = getWorkflowStore();
    const instance = await store.getInstance(input.workflowId, auth.tenant);

    if (!instance) {
      return {
        success: false,
        error: `Workflow '${input.workflowId}' not found`,
        code: 'WORKFLOW_NOT_FOUND',
      };
    }

    const [steps, checkpoints] = await Promise.all([
      store.listSteps(instance.id, auth.tenant),
      store.listCheckpoints(instance.id, auth.tenant),
    ]);

    return {
      success: true,
      data: {
        instance,
        steps,
        checkpoints,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve workflow details',
      code: 'STORE_ERROR',
    };
  }
}

/**
 * Initiates cooperative cancellation of a workflow instance.
 */
export async function cancelWorkflowInstanceAction(
  input: CancelWorkflowInput
): Promise<WorkflowActionResult<WorkflowInstance>> {
  const auth = await resolveTenant(input.organizationId, input.workspaceId);
  if ('error' in auth) {
    return { success: false, error: auth.error, code: auth.code };
  }

  try {
    const store = getWorkflowStore();
    const instance = await store.getInstance(input.workflowId, auth.tenant);

    if (!instance) {
      return {
        success: false,
        error: `Workflow '${input.workflowId}' not found`,
        code: 'WORKFLOW_NOT_FOUND',
      };
    }

    if (instance.status === 'CANCELLED') {
      return { success: true, data: instance };
    }

    const updated = await store.updateInstanceStatus(
      instance.id,
      'CANCELLED',
      auth.tenant
    );

    await defaultEventBus.publish(
      createDomainEvent({
        type: 'workflow.cancelled',
        organizationId: auth.tenant.organizationId,
        workspaceId: auth.tenant.workspaceId,
        actor: { type: 'user', id: auth.userId },
        entity: { type: 'workflow', id: instance.id },
        payload: { reason: input.reason || 'Operator cancellation' },
        correlationId: instance.correlationId || randomUUID(),
        source: 'workflow-admin-actions',
      })
    );

    return { success: true, data: updated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to cancel workflow',
      code: 'CANCELLATION_FAILED',
    };
  }
}

/**
 * Manually instantiates an approved workflow template from the admin mission control.
 */
export async function instantiateWorkflowTemplateAction(
  input: InstantiateTemplateAdminInput
): Promise<
  WorkflowActionResult<{
    workflowId: string;
    definitionId: string;
    status: string;
  }>
> {
  const auth = await resolveTenant(input.organizationId, input.workspaceId);
  if ('error' in auth) {
    return { success: false, error: auth.error, code: auth.code };
  }

  // Rule 60: Emergency Dead-Man Switch Evaluation
  try {
    await checkGovernanceDeadManSwitch(auth.tenant.organizationId);
  } catch {
    return {
      success: false,
      error:
        'Workflow execution is paused under Rule 60 emergency governance.',
      code: 'DEAD_MAN_PAUSED',
    };
  }

  try {
    const registry = getWorkflowTemplateRegistry();
    const { instance } = await registry.instantiateTemplate({
      templateId: input.templateId,
      inputs: input.inputs || {},
      title: input.title,
      initiator: { actorType: 'user', actorId: auth.userId },
      principal: {
        actorType: 'agent',
        userId: auth.userId,
        organizationId: auth.tenant.organizationId,
        workspaceId: auth.tenant.workspaceId,
        grantedScopes: ['app:automations_manage'],
        effectiveRole: 'operator',
      },
      tenant: auth.tenant,
      dryRun: input.dryRun ?? false,
    });

    return {
      success: true,
      data: {
        workflowId: instance.id,
        definitionId: instance.definitionId,
        status: instance.status,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Failed to instantiate template',
      code: 'INSTANTIATION_FAILED',
    };
  }
}

/**
 * Aggregates platform workflow KPI counts for the executive metrics strip.
 */
export async function getWorkflowPlatformMetricsAction(
  input: { organizationId?: string; workspaceId?: string } = {}
): Promise<WorkflowActionResult<WorkflowPlatformMetrics>> {
  const auth = await resolveTenant(input.organizationId, input.workspaceId);
  if ('error' in auth) {
    return { success: false, error: auth.error, code: auth.code };
  }

  try {
    const store = getWorkflowStore();
    const { items: all } = await store.listInstances({
      organizationId: auth.tenant.organizationId,
      workspaceId: auth.tenant.workspaceId,
      limit: 500,
    });

    let isDeadManPaused = false;
    try {
      await checkGovernanceDeadManSwitch(auth.tenant.organizationId);
    } catch {
      isDeadManPaused = true;
    }

    const totalWorkflows = all.length;
    const activeWorkflows = all.filter(
      (w) => w.status === 'RUNNING' || w.status === 'QUEUED' || w.status === 'RESUMED'
    ).length;
    const waitingWorkflows = all.filter((w) => w.status === 'WAITING').length;
    const completedWorkflows = all.filter((w) => w.status === 'COMPLETED').length;
    const failedWorkflows = all.filter(
      (w) => w.status === 'FAILED' || w.status === 'TIMED_OUT'
    ).length;

    return {
      success: true,
      data: {
        totalWorkflows,
        activeWorkflows,
        waitingWorkflows,
        completedWorkflows,
        failedWorkflows,
        isDeadManPaused,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to aggregate metrics',
      code: 'METRICS_ERROR',
    };
  }
}

/**
 * Returns all registered workflow templates for selection in operator modals.
 */
export async function listWorkflowTemplatesAction(): Promise<
  WorkflowActionResult<WorkflowTemplateDefinition[]>
> {
  const auth = await resolveTenant();
  if ('error' in auth) {
    return { success: false, error: auth.error, code: auth.code };
  }

  try {
    const registry = getWorkflowTemplateRegistry();
    const templates = registry.listTemplates();
    return { success: true, data: templates };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list templates',
      code: 'TEMPLATE_ERROR',
    };
  }
}
