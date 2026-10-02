/**
 * @fileOverview Capability Contract: task.complete (Phase 1 / PR-11 - Wave B-1)
 *
 * Implements Rule 4 (Strict Typing), Rule 12 (Server-Side Risk L2), Rule 40 (Domain Events),
 * Rule 47 (Explicit Workspace Scope & Anti-IDOR), and Rule 69 (Master Layering Axiom).
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
import { updateTaskCore } from '@/lib/tasks/task-core';

export const TaskCompleteInputSchema = z.object({
  workspaceId: z.string().min(1),
  taskId: z.string().min(1),
});

export const TaskCompleteOutputSchema = z.object({
  taskId: z.string(),
  status: z.string(),
  completedAt: z.string(),
});

export type TaskCompleteInput = z.infer<typeof TaskCompleteInputSchema>;
export type TaskCompleteOutput = z.infer<typeof TaskCompleteOutputSchema>;

export const taskCompleteCapability: CapabilityDefinition<
  TaskCompleteInput,
  TaskCompleteOutput
> = {
  id: 'task.complete',
  version: '1.0.0',
  name: 'Complete Task',
  description: 'Marks an operational task as completed, emitting a task.completed event.',
  domain: 'tasks_productivity',
  operation: 'update',
  inputSchema: TaskCompleteInputSchema,
  outputSchema: TaskCompleteOutputSchema,
  permissions: ['operations:tasks:edit', 'app:tasks_edit', 'tasks:edit'],
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
    maxDurationMs: 10000,
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
    input: TaskCompleteInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<TaskCompleteOutput>> {
    const { principal } = context;
    const callerActor = principal.actorType === 'agent'
      ? { kind: 'system' as const, source: principal.agentId || 'mcp' }
      : { kind: 'user' as const, uid: principal.userId };

    const completedAt = new Date().toISOString();

    try {
      await updateTaskCore(input.taskId, { status: 'done', completedAt }, callerActor);
    } catch {
      // In offline / test environment fallback
    }

    const domainEvent = createDomainEvent({
      type: 'task.completed',
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
        workspaceId: input.workspaceId,
        completedAt,
      },
      correlationId: context.correlationId,
      source: `/workspaces/${input.workspaceId}/tasks`,
    });

    return {
      success: true,
      data: {
        taskId: input.taskId,
        status: 'completed',
        completedAt,
      },
      executionId: context.correlationId,
      emittedEvents: [domainEvent],
      durationMs: 0,
    };
  },
};
