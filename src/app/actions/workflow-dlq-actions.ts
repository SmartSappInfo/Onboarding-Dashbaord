'use server';

/**
 * @fileOverview Workflow Dead-Letter Queue (DLQ) Remediation Server Actions (Phase 7 Milestone 4)
 *
 * Implements:
 * - Rule 4: Zero any & strict typing policy with Zod v4.
 * - Rule 8 & 47: Anti-IDOR multi-tenant perimeter validation.
 * - Rule 13 & 30: Prompt injection isolation scanner on reparameterized payloads.
 * - Rule 25: Operator-supervised DLQ recovery and remediation.
 * - Rule 51: Next.js 15 Server Actions authentication via requireAuth().
 * - Rule 60: Emergency governance dead-man switch evaluation.
 */

import { randomUUID } from 'node:crypto';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import { evaluateMemoryContentRisk } from '@/platform/memory/governance/anti-poisoning';
import {
  type WorkflowDlqService,
  getWorkflowDlqService,
} from '@/platform/workflows/resilience/workflow-dlq-service';
import {
  type WorkflowStore,
  getWorkflowStore,
} from '@/platform/workflows/workflow-store';
import {
  type WorkflowDispatcher,
  getWorkflowDispatcher,
} from '@/platform/workflows/dispatcher/workflow-dispatcher';
import {
  type WorkflowDlqEntry,
  type DlqFilter,
} from '@/platform/workflows/resilience/workflow-resilience-types';

export interface WorkflowActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface ListDlqEntriesParams {
  tenant: {
    organizationId: string;
    workspaceId: string;
  };
  filter?: DlqFilter;
}

export interface GetDlqEntryDetailsParams {
  dlqId: string;
  tenant: {
    organizationId: string;
    workspaceId: string;
  };
}

export interface RetryDlqStepParams {
  dlqId: string;
  tenant: {
    organizationId: string;
    workspaceId: string;
  };
  notes?: string;
}

export interface SkipDlqStepParams {
  dlqId: string;
  tenant: {
    organizationId: string;
    workspaceId: string;
  };
  notes?: string;
}

export interface ReparameterizeDlqStepParams {
  dlqId: string;
  tenant: {
    organizationId: string;
    workspaceId: string;
  };
  newStepInput: Record<string, unknown>;
  notes?: string;
}

export interface DiscardDlqEntryParams {
  dlqId: string;
  tenant: {
    organizationId: string;
    workspaceId: string;
  };
  notes?: string;
}

/**
 * Validates session authentication and asserts strict Anti-IDOR perimeter (Rules 8, 47, 51).
 */
async function authenticateAndValidateTenant(targetOrgId: string) {
  const auth = await requireAuth();
  const callerOrgId = auth.profile?.organizationId;

  if (!auth.isSystemAdmin && callerOrgId !== targetOrgId) {
    throw new Error('IDOR_VIOLATION: Cross-tenant access forbidden');
  }

  return auth;
}

/**
 * Lists dead-letter queue entries for an authorized tenant (Rule 8, 25 & 47).
 */
export async function listWorkflowDlqEntriesAction(
  params: ListDlqEntriesParams,
  options?: { dlqService?: WorkflowDlqService }
): Promise<WorkflowActionResult<{ items: WorkflowDlqEntry[]; total: number }>> {
  try {
    await authenticateAndValidateTenant(params.tenant.organizationId);

    const dlqService = options?.dlqService ?? getWorkflowDlqService();
    const result = await dlqService.listEntries(params.tenant, params.filter);

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const code = message.includes('IDOR_VIOLATION')
      ? 'IDOR_VIOLATION'
      : 'LIST_DLQ_FAILED';
    return {
      success: false,
      error: message,
      code,
    };
  }
}

/**
 * Retrieves full details for a specific DLQ quarantine entry (Rules 8 & 25).
 */
export async function getWorkflowDlqEntryDetailsAction(
  params: GetDlqEntryDetailsParams,
  options?: { dlqService?: WorkflowDlqService }
): Promise<WorkflowActionResult<WorkflowDlqEntry>> {
  try {
    await authenticateAndValidateTenant(params.tenant.organizationId);

    const dlqService = options?.dlqService ?? getWorkflowDlqService();
    const entry = await dlqService.getEntry(params.dlqId, params.tenant);

    if (!entry) {
      return {
        success: false,
        error: `DLQ entry '${params.dlqId}' not found`,
        code: 'DLQ_ENTRY_NOT_FOUND',
      };
    }

    return {
      success: true,
      data: entry,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const code = message.includes('IDOR_VIOLATION')
      ? 'IDOR_VIOLATION'
      : 'GET_DLQ_ENTRY_FAILED';
    return {
      success: false,
      error: message,
      code,
    };
  }
}

/**
 * Operator action to retry a quarantined step after transient failure or downstream recovery.
 */
export async function retryWorkflowDlqStepAction(
  params: RetryDlqStepParams,
  options?: {
    dlqService?: WorkflowDlqService;
    store?: WorkflowStore;
    dispatcher?: WorkflowDispatcher;
  }
): Promise<WorkflowActionResult<WorkflowDlqEntry>> {
  try {
    const auth = await authenticateAndValidateTenant(params.tenant.organizationId);

    // Rule 60: Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(params.tenant.organizationId);

    const dlqService = options?.dlqService ?? getWorkflowDlqService();
    const store = options?.store ?? getWorkflowStore();
    const dispatcher = options?.dispatcher ?? getWorkflowDispatcher();

    const existing = await dlqService.getEntry(params.dlqId, params.tenant);
    if (!existing) {
      return {
        success: false,
        error: `DLQ entry '${params.dlqId}' not found`,
        code: 'DLQ_ENTRY_NOT_FOUND',
      };
    }

    // 1. Remediate DLQ entry status to 'replayed'
    const updatedEntry = await dlqService.remediateDlqEntry({
      dlqId: params.dlqId,
      tenant: params.tenant,
      remediatedBy: auth.uid,
      action: 'retry',
      notes: params.notes,
    });

    // 2. Reset step in store to QUEUED with reset attempt count
    await store.updateStep(
      existing.workflowId,
      existing.stepId,
      {
        status: 'QUEUED',
        attempt: 0,
      },
      params.tenant
    );

    // 3. If workflow was marked FAILED, resume status to RUNNING
    const instance = await store.getInstance(existing.workflowId, params.tenant);
    if (instance && instance.status === 'FAILED') {
      await store.updateInstanceStatus(existing.workflowId, 'RUNNING', params.tenant, {
        allowOperatorRecovery: true,
      });
    }

    // 4. Re-enqueue step task to dispatcher
    await dispatcher.enqueueWorkflowStep({
      workflowId: existing.workflowId,
      stepId: existing.stepId,
      tenant: params.tenant,
      attempt: 0,
      idempotencyKey: `retry_dlq_${existing.stepId}_${randomUUID()}`,
      correlationId: existing.correlationId || existing.workflowId,
    });

    return {
      success: true,
      data: updatedEntry,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isDeadMan =
      err instanceof AgentGovernanceEmergencyPausedError ||
      (err as { code?: string })?.code === 'AGENT_GOVERNANCE_EMERGENCY_PAUSED' ||
      message.toLowerCase().includes('dead-man') ||
      message.toLowerCase().includes('dead_man');
    const code = isDeadMan
      ? 'DEAD_MAN_PAUSED'
      : message.includes('IDOR_VIOLATION')
      ? 'IDOR_VIOLATION'
      : 'RETRY_DLQ_FAILED';
    return {
      success: false,
      error: message,
      code,
    };
  }
}

/**
 * Operator action to reparameterize a quarantined step with corrected input and retry.
 */
export async function reparameterizeWorkflowDlqStepAction(
  params: ReparameterizeDlqStepParams,
  options?: {
    dlqService?: WorkflowDlqService;
    store?: WorkflowStore;
    dispatcher?: WorkflowDispatcher;
  }
): Promise<WorkflowActionResult<WorkflowDlqEntry>> {
  try {
    const auth = await authenticateAndValidateTenant(params.tenant.organizationId);

    // Rule 60: Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(params.tenant.organizationId);

    // Rules 13 & 30: Scan new inputs against prompt injection and poisoning directives
    const serializedInput = JSON.stringify(params.newStepInput);
    const riskCheck = evaluateMemoryContentRisk(serializedInput);
    if (!riskCheck.isSafe) {
      return {
        success: false,
        error: `Input parameter validation failed: Potential prompt injection or poisoning detected (${riskCheck.detectedPatterns.join(', ')})`,
        code: 'INJECTION_DETECTED',
      };
    }

    const dlqService = options?.dlqService ?? getWorkflowDlqService();
    const store = options?.store ?? getWorkflowStore();
    const dispatcher = options?.dispatcher ?? getWorkflowDispatcher();

    const existing = await dlqService.getEntry(params.dlqId, params.tenant);
    if (!existing) {
      return {
        success: false,
        error: `DLQ entry '${params.dlqId}' not found`,
        code: 'DLQ_ENTRY_NOT_FOUND',
      };
    }

    // 1. Remediate DLQ entry status
    const updatedEntry = await dlqService.remediateDlqEntry({
      dlqId: params.dlqId,
      tenant: params.tenant,
      remediatedBy: auth.uid,
      action: 'reparameterize',
      newStepInput: params.newStepInput,
      notes: params.notes,
    });

    // 2. Update step in store with corrected input and reset attempt
    await store.updateStep(
      existing.workflowId,
      existing.stepId,
      {
        input: params.newStepInput,
        status: 'QUEUED',
        attempt: 0,
      },
      params.tenant
    );

    // 3. If workflow was marked FAILED, resume status to RUNNING
    const instance = await store.getInstance(existing.workflowId, params.tenant);
    if (instance && instance.status === 'FAILED') {
      await store.updateInstanceStatus(existing.workflowId, 'RUNNING', params.tenant, {
        allowOperatorRecovery: true,
      });
    }

    // 4. Re-enqueue step task to dispatcher
    await dispatcher.enqueueWorkflowStep({
      workflowId: existing.workflowId,
      stepId: existing.stepId,
      tenant: params.tenant,
      attempt: 0,
      idempotencyKey: `reparam_dlq_${existing.stepId}_${randomUUID()}`,
      correlationId: existing.correlationId || existing.workflowId,
    });

    return {
      success: true,
      data: updatedEntry,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isDeadMan =
      err instanceof AgentGovernanceEmergencyPausedError ||
      (err as { code?: string })?.code === 'AGENT_GOVERNANCE_EMERGENCY_PAUSED' ||
      message.toLowerCase().includes('dead-man') ||
      message.toLowerCase().includes('dead_man');
    const code = isDeadMan
      ? 'DEAD_MAN_PAUSED'
      : message.includes('IDOR_VIOLATION')
      ? 'IDOR_VIOLATION'
      : 'REPARAMETERIZE_DLQ_FAILED';
    return {
      success: false,
      error: message,
      code,
    };
  }
}

/**
 * Operator action to skip a failed step, marking it SKIPPED and unblocking dependent DAG steps.
 */
export async function skipWorkflowDlqStepAction(
  params: SkipDlqStepParams,
  options?: {
    dlqService?: WorkflowDlqService;
    store?: WorkflowStore;
    dispatcher?: WorkflowDispatcher;
  }
): Promise<WorkflowActionResult<WorkflowDlqEntry>> {
  try {
    const auth = await authenticateAndValidateTenant(params.tenant.organizationId);

    // Rule 60: Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(params.tenant.organizationId);

    const dlqService = options?.dlqService ?? getWorkflowDlqService();
    const store = options?.store ?? getWorkflowStore();
    const dispatcher = options?.dispatcher ?? getWorkflowDispatcher();

    const existing = await dlqService.getEntry(params.dlqId, params.tenant);
    if (!existing) {
      return {
        success: false,
        error: `DLQ entry '${params.dlqId}' not found`,
        code: 'DLQ_ENTRY_NOT_FOUND',
      };
    }

    // 1. Remediate DLQ entry status to 'skipped'
    const updatedEntry = await dlqService.remediateDlqEntry({
      dlqId: params.dlqId,
      tenant: params.tenant,
      remediatedBy: auth.uid,
      action: 'skip',
      notes: params.notes,
    });

    // 2. Mark step SKIPPED in store
    await store.updateStep(
      existing.workflowId,
      existing.stepId,
      {
        status: 'SKIPPED',
      },
      params.tenant
    );

    // 3. Unblock downstream dependent steps
    const allSteps = await store.listSteps(existing.workflowId, params.tenant);
    const completedStepIds = new Set(
      allSteps
        .filter((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED' || s.id === existing.stepId)
        .map((s) => s.id)
    );

    const unblockedPendingSteps = allSteps.filter((s) => {
      if (s.status !== 'PENDING') return false;
      const deps = s.dependsOn ?? [];
      return deps.every((depId) => completedStepIds.has(depId));
    });

    for (const unblocked of unblockedPendingSteps) {
      await store.updateStep(
        existing.workflowId,
        unblocked.id,
        { status: 'QUEUED' },
        params.tenant
      );

      await dispatcher.enqueueWorkflowStep({
        workflowId: existing.workflowId,
        stepId: unblocked.id,
        tenant: params.tenant,
        idempotencyKey: `step_${unblocked.id}_${randomUUID()}`,
        correlationId: existing.correlationId || existing.workflowId,
      });
    }

    // 4. If workflow was marked FAILED, resume status to RUNNING if pending steps remain
    const instance = await store.getInstance(existing.workflowId, params.tenant);
    if (instance && instance.status === 'FAILED') {
      const remainingIncomplete = allSteps.filter(
        (s) => s.id !== existing.stepId && s.status !== 'COMPLETED' && s.status !== 'SKIPPED'
      );
      if (remainingIncomplete.length > 0) {
        await store.updateInstanceStatus(existing.workflowId, 'RUNNING', params.tenant, {
          allowOperatorRecovery: true,
        });
      } else {
        await store.updateInstanceStatus(existing.workflowId, 'COMPLETED', params.tenant, {
          allowOperatorRecovery: true,
        });
      }
    }

    return {
      success: true,
      data: updatedEntry,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isDeadMan =
      err instanceof AgentGovernanceEmergencyPausedError ||
      (err as { code?: string })?.code === 'AGENT_GOVERNANCE_EMERGENCY_PAUSED' ||
      message.toLowerCase().includes('dead-man') ||
      message.toLowerCase().includes('dead_man');
    const code = isDeadMan
      ? 'DEAD_MAN_PAUSED'
      : message.includes('IDOR_VIOLATION')
      ? 'IDOR_VIOLATION'
      : 'SKIP_DLQ_FAILED';
    return {
      success: false,
      error: message,
      code,
    };
  }
}

/**
 * Operator action to permanently discard a dead-letter entry without retrying.
 */
export async function discardWorkflowDlqEntryAction(
  params: DiscardDlqEntryParams,
  options?: {
    dlqService?: WorkflowDlqService;
  }
): Promise<WorkflowActionResult<WorkflowDlqEntry>> {
  try {
    const auth = await authenticateAndValidateTenant(params.tenant.organizationId);

    // Rule 60: Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(params.tenant.organizationId);

    const dlqService = options?.dlqService ?? getWorkflowDlqService();
    const updatedEntry = await dlqService.remediateDlqEntry({
      dlqId: params.dlqId,
      tenant: params.tenant,
      remediatedBy: auth.uid,
      action: 'discard',
      notes: params.notes,
    });

    return {
      success: true,
      data: updatedEntry,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isDeadMan =
      err instanceof AgentGovernanceEmergencyPausedError ||
      (err as { code?: string })?.code === 'AGENT_GOVERNANCE_EMERGENCY_PAUSED' ||
      message.toLowerCase().includes('dead-man') ||
      message.toLowerCase().includes('dead_man');
    const code = isDeadMan
      ? 'DEAD_MAN_PAUSED'
      : message.includes('IDOR_VIOLATION')
      ? 'IDOR_VIOLATION'
      : 'DISCARD_DLQ_FAILED';
    return {
      success: false,
      error: message,
      code,
    };
  }
}
