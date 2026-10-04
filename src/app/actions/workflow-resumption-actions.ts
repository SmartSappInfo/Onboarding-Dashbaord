'use server';

/**
 * @fileOverview Workflow Resumption Server Actions (Phase 7 Milestone 3)
 *
 * Implements Rule 4 (Zero any & strict typing), Rule 8 & 47 (Anti-IDOR multi-tenant isolation),
 * Rule 13 & 30 (Prompt injection isolation container), Rule 51 (Server Action authentication via requireAuth),
 * and Rule 60 (Emergency governance dead-man pause evaluation).
 */

import { requireAuth } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  submitHumanInput,
} from '@/platform/workflows/resumption/human-input-bridge';
import { getWorkflowResumptionService } from '@/platform/workflows/resumption/workflow-resumption-service';
import { getWorkflowStore } from '@/platform/workflows/workflow-store';
import { createCheckpointHash } from '@/platform/workflows/workflow-state-machine';
import { globalEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import type { StepResumptionResult } from '@/platform/workflows/resumption/workflow-resumption-types';
import {
  WorkflowResumptionError,
} from '@/platform/workflows/resumption/workflow-resumption-types';

export interface WorkflowActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface SubmitHumanInputWaitParams {
  workflowId: string;
  stepId: string;
  token: string;
  tenant: {
    organizationId: string;
    workspaceId: string;
  };
  inputData: Record<string, unknown>;
  notes?: string;
}

export interface CancelWaitingWorkflowParams {
  workflowId: string;
  tenant: {
    organizationId: string;
    workspaceId: string;
  };
  reason?: string;
}

export interface GetWaitConditionStatusParams {
  workflowId: string;
  stepId: string;
  tenant: {
    organizationId: string;
    workspaceId: string;
  };
}

export interface WaitConditionStatusData {
  type: string;
  expiresAt?: string;
  isExpired: boolean;
  details: Record<string, unknown>;
}

/**
 * Submits interactive human input to resume a waiting workflow step.
 */
export async function submitHumanInputWaitAction(
  params: SubmitHumanInputWaitParams
): Promise<WorkflowActionResult<StepResumptionResult>> {
  try {
    // 1. Authenticate caller (Rule 51)
    const auth = await requireAuth();

    // 2. Anti-IDOR validation (Rules 8 & 47)
    const callerOrgId = auth.profile?.organizationId;
    if (!auth.isSystemAdmin && callerOrgId !== params.tenant.organizationId) {
      return {
        success: false,
        error: 'Cross-tenant access forbidden',
        code: 'IDOR_VIOLATION',
      };
    }

    // 3. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(params.tenant.organizationId);
    } catch (dmErr: unknown) {
      return {
        success: false,
        error: dmErr instanceof Error ? dmErr.message : 'Workflow resumption paused by emergency dead-man switch',
        code: 'DEAD_MAN_PAUSED',
      };
    }

    // 4. Delegate to Human Input Bridge & Resumption Service
    const resumptionService = getWorkflowResumptionService();
    const result = await submitHumanInput(
      {
        workflowId: params.workflowId,
        stepId: params.stepId,
        token: params.token,
        tenant: params.tenant,
        submittedBy: auth.uid,
        inputData: params.inputData,
        notes: params.notes,
      },
      resumptionService
    );

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    if (err instanceof WorkflowResumptionError) {
      return {
        success: false,
        error: err.message,
        code: err.code,
      };
    }

    const message = err instanceof Error ? err.message : 'Failed to submit human input';
    return {
      success: false,
      error: message,
      code: 'SUBMISSION_FAILED',
    };
  }
}

/**
 * Cooperatively cancels a waiting workflow instance.
 */
export async function cancelWaitingWorkflowAction(
  params: CancelWaitingWorkflowParams
): Promise<WorkflowActionResult<{ workflowId: string; status: 'CANCELLED' }>> {
  try {
    // 1. Authenticate caller (Rule 51)
    const auth = await requireAuth();

    // 2. Anti-IDOR validation (Rules 8 & 47)
    const callerOrgId = auth.profile?.organizationId;
    if (!auth.isSystemAdmin && callerOrgId !== params.tenant.organizationId) {
      return {
        success: false,
        error: 'Cross-tenant access forbidden',
        code: 'IDOR_VIOLATION',
      };
    }

    // 3. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(params.tenant.organizationId);
    } catch (dmErr: unknown) {
      return {
        success: false,
        error: dmErr instanceof Error ? dmErr.message : 'Action blocked by emergency dead-man switch',
        code: 'DEAD_MAN_PAUSED',
      };
    }

    const store = getWorkflowStore();
    const instance = await store.getInstance(params.workflowId, params.tenant);
    if (!instance) {
      return {
        success: false,
        error: `Workflow instance '${params.workflowId}' not found`,
        code: 'NOT_FOUND',
      };
    }

    // 4. Update instance status to CANCELLED
    await store.updateInstanceStatus(params.workflowId, 'CANCELLED', params.tenant);

    // 5. Update waiting steps to SKIPPED
    const steps = await store.listSteps(params.workflowId, params.tenant);
    for (const step of steps) {
      if (step.status === 'WAITING' || step.status === 'RUNNING') {
        await store.updateStep(
          params.workflowId,
          step.id,
          {
            status: 'SKIPPED',
          },
          params.tenant
        );
      }
    }

    // 6. Record checkpoint
    const checkpoints = await store.listCheckpoints(params.workflowId, params.tenant);
    const sequence = checkpoints.length;
    const prevCheckpoint = sequence > 0 ? checkpoints[sequence - 1] : undefined;

    const checkpointPayload = {
      cancelledBy: auth.uid,
      reason: params.reason ?? 'Cancelled by operator',
      cancelledAt: new Date().toISOString(),
    };

    const hash = createCheckpointHash({
      workflowId: params.workflowId,
      sequence,
      fromState: instance.status,
      toState: 'CANCELLED',
      statePayload: checkpointPayload,
      previousHash: prevCheckpoint?.hash,
    });

    await store.recordCheckpoint({
      workflowId: params.workflowId,
      organizationId: params.tenant.organizationId,
      workspaceId: params.tenant.workspaceId,
      checkpointSequence: sequence,
      fromState: instance.status,
      toState: 'CANCELLED',
      statePayload: checkpointPayload,
      hash,
      previousHash: prevCheckpoint?.hash,
    });

    // 7. Publish domain event
    await globalEventBus.publish(
      createDomainEvent({
        type: 'workflow.state_changed',
        organizationId: params.tenant.organizationId,
        workspaceId: params.tenant.workspaceId,
        entity: { type: 'workflow', id: params.workflowId },
        actor: { type: 'user', id: auth.uid },
        correlationId: instance.correlationId,
        source: 'workflow_actions',
        payload: {
          fromState: instance.status,
          toState: 'CANCELLED',
          reason: params.reason ?? 'Cancelled by operator',
        },
      })
    );

    return {
      success: true,
      data: {
        workflowId: params.workflowId,
        status: 'CANCELLED',
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel waiting workflow';
    return {
      success: false,
      error: message,
      code: 'CANCELLATION_FAILED',
    };
  }
}

/**
 * Retrieves wait condition details and expiration status for a workflow step.
 */
export async function getWaitConditionStatusAction(
  params: GetWaitConditionStatusParams
): Promise<WorkflowActionResult<WaitConditionStatusData>> {
  try {
    // 1. Authenticate caller (Rule 51)
    const auth = await requireAuth();

    // 2. Anti-IDOR validation (Rules 8 & 47)
    const callerOrgId = auth.profile?.organizationId;
    if (!auth.isSystemAdmin && callerOrgId !== params.tenant.organizationId) {
      return {
        success: false,
        error: 'Cross-tenant access forbidden',
        code: 'IDOR_VIOLATION',
      };
    }

    const store = getWorkflowStore();
    const step = await store.getStep(params.workflowId, params.stepId, params.tenant);
    if (!step || !step.waitCondition) {
      return {
        success: false,
        error: `Step '${params.stepId}' or wait condition not found`,
        code: 'NOT_FOUND',
      };
    }

    const waitCondition = step.waitCondition;
    const isExpired = waitCondition.expiresAt
      ? Date.now() > new Date(waitCondition.expiresAt).getTime()
      : false;

    return {
      success: true,
      data: {
        type: waitCondition.type,
        expiresAt: waitCondition.expiresAt,
        isExpired,
        details: (waitCondition.details as Record<string, unknown>) ?? {},
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get wait condition status';
    return {
      success: false,
      error: message,
      code: 'QUERY_FAILED',
    };
  }
}
