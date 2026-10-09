/**
 * @fileOverview Capability Contract: task.obligation.sync (Phase 5 / Roadmap §78)
 *
 * Implements Rule 4 (Strict Typing), Rule 11 (MCP Protocol), Rule 12 (Server-Side Risk L2),
 * Rule 18 (TOCTOU Concurrency Protection), Rule 19 (Idempotency), Rule 40 (Domain Events),
 * and Rule 47 (Workspace Confinement).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import type {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../../../capabilities/contracts/capability-definition';
import { createDomainEvent } from '../../../capabilities/events/domain-event';
import { adminDb } from '@/lib/firebase-admin';
import type { Task } from '@/lib/types';

export const TaskObligationSyncInputSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  taskId: z.string().min(1, 'taskId is required'),
  expectedUpdatedAt: z.string().optional(),
});

export const TaskObligationSyncOutputSchema = z.object({
  taskId: z.string(),
  status: z.enum(['synced', 'failed', 'pending']),
  syncedAt: z.string().optional(),
  contractId: z.string().optional(),
  obligationId: z.string().optional(),
  alreadySynced: z.boolean().optional(),
  error: z.string().nullable().optional(),
});

export type TaskObligationSyncInput = z.infer<typeof TaskObligationSyncInputSchema>;
export type TaskObligationSyncOutput = z.infer<typeof TaskObligationSyncOutputSchema>;

export const taskObligationSyncCapability: CapabilityDefinition<
  TaskObligationSyncInput,
  TaskObligationSyncOutput
> = {
  id: 'task.obligation.sync',
  version: '1.0.0',
  name: 'Sync Task Contract Obligation',
  description: 'Synchronizes task completion with its downstream contractual obligation record idempotently.',
  domain: 'tasks_productivity',
  operation: 'update',
  inputSchema: TaskObligationSyncInputSchema,
  outputSchema: TaskObligationSyncOutputSchema,
  permissions: ['operations:tasks:edit', 'contracts:obligations:edit', 'app:tasks_edit'],
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
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  async handler(
    input: TaskObligationSyncInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<TaskObligationSyncOutput>> {
    const { principal } = context;

    try {
      const taskDoc = await adminDb.collection('tasks').doc(input.taskId).get();
      if (!taskDoc.exists) {
        return {
          success: false,
          error: {
            code: 'TASK_NOT_FOUND',
            message: `Task ${input.taskId} was not found.`,
            retryable: false,
          },
        };
      }

      const task = { id: taskDoc.id, ...taskDoc.data() } as Task;
      if (task.workspaceId !== input.workspaceId) {
        return {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Task does not belong to the authorized workspace.',
            retryable: false,
          },
        };
      }

      // TOCTOU concurrency check (Rule 18)
      if (input.expectedUpdatedAt && task.updatedAt !== input.expectedUpdatedAt) {
        return {
          success: false,
          error: {
            code: 'CONCURRENCY_CONFLICT',
            message: 'Task was modified concurrently by another process. Please reload and retry.',
            retryable: true,
          },
        };
      }

      if (!task.relatedParentId || !task.relatedEntityId) {
        return {
          success: false,
          error: {
            code: 'NO_LINKED_OBLIGATION',
            message: 'Task does not have a linked contract obligation.',
            retryable: false,
          },
        };
      }

      // Idempotency check: already synced
      if (task.obligationSyncStatus === 'synced') {
        return {
          success: true,
          data: {
            taskId: task.id,
            status: 'synced',
            syncedAt: task.obligationSyncAt || new Date().toISOString(),
            contractId: task.relatedParentId,
            obligationId: task.relatedEntityId,
            alreadySynced: true,
          },
        };
      }

      const { syncTaskCompletionToObligation } = await import('@/lib/documents/crm-deal-sync-service');
      const syncResult = await syncTaskCompletionToObligation({
        workspaceId: input.workspaceId,
        taskId: task.id,
        contractId: task.relatedParentId,
        obligationId: task.relatedEntityId,
        actorUserId: principal.userId,
      });

      const now = new Date().toISOString();
      if (syncResult && syncResult.success) {
        await adminDb.collection('tasks').doc(task.id).update({
          obligationSyncStatus: 'synced',
          obligationSyncAt: now,
          obligationSyncError: null,
          updatedAt: now,
        });

        const domainEvent = createDomainEvent({
          type: 'task.obligation_synced',
          organizationId: principal.organizationId,
          workspaceId: input.workspaceId,
          actor: {
            type: principal.actorType,
            id: principal.userId,
          },
          entity: {
            type: 'task',
            id: input.taskId,
          },
          payload: {
            taskId: input.taskId,
            contractId: task.relatedParentId,
            obligationId: task.relatedEntityId,
            syncedAt: now,
          },
        });

        return {
          success: true,
          data: {
            taskId: task.id,
            status: 'synced',
            syncedAt: now,
            contractId: task.relatedParentId,
            obligationId: task.relatedEntityId,
            alreadySynced: false,
          },
          events: [domainEvent],
        };
      } else {
        const errorMsg: string =
          typeof syncResult?.error === 'string' ? syncResult.error : 'Downstream obligation sync failed';
        await adminDb.collection('tasks').doc(task.id).update({
          obligationSyncStatus: 'failed',
          obligationSyncError: errorMsg,
          updatedAt: now,
        });

        return {
          success: false,
          error: {
            code: 'DOWNSTREAM_SYNC_FAILED',
            message: errorMsg,
            retryable: true,
          },
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error syncing obligation';
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message,
          retryable: true,
        },
      };
    }
  },
};
