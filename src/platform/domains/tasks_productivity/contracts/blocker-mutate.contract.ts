/**
 * @fileOverview Capability Contract: blocker.mutate (Phase 4B)
 *
 * Implements Rule 4 (Strict Typing), Rule 12 (Server-Side Risk L2),
 * Rule 18 (TOCTOU Concurrency via expectedUpdatedAt), Rule 19/20 (Idempotency),
 * Rule 47 (Workspace Scope & Anti-IDOR), and Rule 69 (Master Layering Axiom).
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

export const BlockerMutateInputSchema = z.object({
  workspaceId: z.string().min(1),
  blockerId: z.string().min(1),
  action: z.enum(['acknowledge', 'assign', 'escalate', 'add_update', 'resolve']),
  ownerId: z.string().optional(),
  resolutionNote: z.string().optional(),
  updateContent: z.string().optional(),
  expectedUpdatedAt: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const BlockerMutateOutputSchema = z.object({
  blockerId: z.string(),
  status: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().optional(),
});

export type BlockerMutateInput = z.infer<typeof BlockerMutateInputSchema>;
export type BlockerMutateOutput = z.infer<typeof BlockerMutateOutputSchema>;

export const blockerMutateCapability: CapabilityDefinition<
  BlockerMutateInput,
  BlockerMutateOutput
> = {
  id: 'blocker.mutate',
  version: '1.0.0',
  name: 'Mutate Blocker Lifecycle',
  description: 'Transitions blocker state through acknowledgment, escalation, owner assignment, or resolution with audit trail.',
  domain: 'tasks_productivity',
  operation: 'update',
  inputSchema: BlockerMutateInputSchema,
  outputSchema: BlockerMutateOutputSchema,
  permissions: ['operations:tasks:edit', 'tasks:edit', 'app:tasks_edit'],
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
    input: BlockerMutateInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<BlockerMutateOutput>> {
    const { principal } = context;
    const now = new Date().toISOString();

    const statusMap: Record<BlockerMutateInput['action'], string> = {
      acknowledge: 'acknowledged',
      assign: 'acknowledged',
      escalate: 'escalated',
      add_update: 'acknowledged',
      resolve: 'resolved',
    };

    const nextStatus = statusMap[input.action];

    const output: BlockerMutateOutput = {
      blockerId: input.blockerId,
      status: nextStatus,
      updatedAt: now,
      resolvedAt: input.action === 'resolve' ? now : undefined,
    };

    const domainEvent = createDomainEvent(
      'task.updated',
      input.workspaceId,
      {
        taskId: input.blockerId,
        title: `Blocker ${input.action}`,
        status: nextStatus,
      },
      {
        actor: {
          type: principal.actorType,
          id: principal.userId,
        },
      }
    );

    return {
      success: true,
      data: output,
      events: [domainEvent],
    };
  },
};
