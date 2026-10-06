/**
 * @fileOverview Capability contracts: follow-up tasks from meeting items (Phase 11 M2 · T4.1; plan §4.2, §4.6).
 *
 * - `meeting.create_followup_tasks` (L1, meetings edit + tasks create): one task per checked
 *   commitment / action item, through the same per-item claim as "Convert to task" (no duplicates
 *   across clicks, retries or re-analysis). Bound to the analysis version the caller reviewed.
 *   Tasks are created as the requesting person (their task permissions are checked again), never as
 *   an anonymous system actor. Agents also need AI use allowed for the transcript (Rule 57).
 * - `meeting.undo_followup_task` (L1, meetings edit + tasks delete): the compensating action. Deletes
 *   the task only while unchanged since creation; an edited task is kept (VERSION_CONFLICT with the
 *   reason). The Meeting Analyst persona has no task-delete permission, so undo stays with people.
 *
 * FLAGS (Rule 64): on for people; agents and MCP need an explicit flag until M2 · T8.
 *
 * Tests: src/platform/__tests__/domains/meetings-followup-tasks.test.ts
 */

import { z } from 'zod/v4';
import { adminDb } from '@/lib/firebase-admin';
import type { CapabilityDefinition, CapabilityExecutionContext } from '../../../capabilities/contracts/capability-definition';
import { isAutomatedPrincipal } from '../../../capabilities/contracts/capability-definition';
import { CapabilityError } from '../../../capabilities/errors/capability-error';
import { assertMeetingInWorkspace, MeetingNotFoundError } from '@/lib/meetings/meeting-access';
import { readIntelligenceV2 } from '@/lib/meetings/intelligence/intelligence-store';
import { IntelligenceRequestError, assertAnalysable } from '@/lib/meetings/intelligence/pipeline';
import {
  FollowupTaskError,
  MAX_FOLLOWUP_TASKS_PER_CALL,
  createFollowupTasks,
  taskFromItem,
  undoFollowupTask,
} from '@/lib/meetings/intelligence/followup-tasks';
import { createTaskCore } from '@/lib/tasks/task-core';
import { canUser } from '@/lib/workspace-permissions';
import { MEETINGS_EDIT_PERMISSION } from './meeting-read.contracts';

const Id = z.string().trim().min(1).max(200).regex(/^[^/]+$/, 'Invalid id.');
export const TASKS_CREATE_PERMISSION = 'rbac:operations.tasks.create';
export const TASKS_DELETE_PERMISSION = 'rbac:operations.tasks.delete';

async function resolveMeetingScope(input: { meetingId: string }, context: CapabilityExecutionContext) {
  try {
    const scope = await assertMeetingInWorkspace(input.meetingId, context.principal.workspaceId, adminDb);
    return { organizationId: context.principal.organizationId, workspaceId: scope.workspaceId, resourceId: scope.meetingId, resourceVersion: scope.resourceVersion };
  } catch (err) {
    if (err instanceof MeetingNotFoundError) return null;
    throw err;
  }
}

function toCapabilityError(err: unknown): unknown {
  if (err instanceof MeetingNotFoundError) {
    return new CapabilityError({ code: 'NOT_FOUND', message: 'Meeting not found.', stateChanged: 'no', httpStatus: 404, retryable: false });
  }
  if (err instanceof IntelligenceRequestError) {
    return new CapabilityError({ code: 'FORBIDDEN', message: err.message, stateChanged: 'no', httpStatus: 403, retryable: false });
  }
  if (!(err instanceof FollowupTaskError)) return err;
  switch (err.code) {
    case 'NOT_FOUND':
      return new CapabilityError({ code: 'NOT_FOUND', message: err.message, stateChanged: 'no', httpStatus: 404, retryable: false });
    case 'VERSION_CONFLICT':
    case 'EDITED':
      return new CapabilityError({ code: 'VERSION_CONFLICT', message: err.message, stateChanged: 'no', httpStatus: 409, retryable: false, details: { reason: err.code.toLowerCase() } });
    case 'FORBIDDEN':
      return new CapabilityError({ code: 'FORBIDDEN', message: err.message, stateChanged: 'no', httpStatus: 403, retryable: false });
    case 'TOO_MANY':
      return new CapabilityError({ code: 'VALIDATION', message: err.message, stateChanged: 'no', httpStatus: 400, retryable: false });
  }
}

const ok = <T>(data: T, context: CapabilityExecutionContext, startMs: number) =>
  ({ success: true as const, data, executionId: context.correlationId, emittedEvents: [], durationMs: Math.max(0, Date.now() - startMs) });

// ── meeting.create_followup_tasks ─────────────────────────────────────────────────

export const MeetingCreateFollowupTasksInputSchema = z.object({
  workspaceId: Id,
  meetingId: Id,
  /** Omit to create tasks for every checked commitment and action item. */
  itemHashes: z.array(Id).min(1).max(MAX_FOLLOWUP_TASKS_PER_CALL).optional(),
  /** The analysis version the caller reviewed; a re-analysis since then refuses the call. */
  expectedVersion: z.number().int().min(0).optional(),
});
const TaskRefSchema = z.object({ itemHash: z.string(), taskId: z.string() });
export const MeetingCreateFollowupTasksOutputSchema = z.object({
  intelligenceVersion: z.number().int(),
  created: z.array(TaskRefSchema),
  existing: z.array(TaskRefSchema),
  skipped: z.array(z.object({
    itemHash: z.string(),
    reason: z.enum(['needs_review', 'not_actionable', 'not_found', 'in_progress', 'failed']),
    message: z.string().optional(),
  })),
});
export type MeetingCreateFollowupTasksInput = z.infer<typeof MeetingCreateFollowupTasksInputSchema>;
export type MeetingCreateFollowupTasksOutput = z.infer<typeof MeetingCreateFollowupTasksOutputSchema>;

export const meetingCreateFollowupTasksCapability: CapabilityDefinition<MeetingCreateFollowupTasksInput, MeetingCreateFollowupTasksOutput> = {
  id: 'meeting.create_followup_tasks',
  version: '1.0.0',
  name: 'Create follow-up tasks from a meeting',
  description: 'Creates one task for each checked commitment or action item of a meeting (or the ones named). Items that need review are skipped. Asking again never creates duplicates.',
  domain: 'meetings_conversations',
  operation: 'create',
  inputSchema: MeetingCreateFollowupTasksInputSchema,
  outputSchema: MeetingCreateFollowupTasksOutputSchema,
  permissions: [MEETINGS_EDIT_PERMISSION, TASKS_CREATE_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: true, maxDurationMs: 30_000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: true, maxPayloadSizeBytes: 16 * 1024 },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: true, defaultEnabled: true, automatedRequiresExplicitFlag: true },
  governance: { dataClassification: 'internal', breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/intelligence/followup-tasks.ts#createFollowupTasks' },
  resolveResourceScope: resolveMeetingScope,
  async handler(input, context) {
    const startMs = Date.now();
    const { principal } = context;
    try {
      const meeting = await assertMeetingInWorkspace(input.meetingId, principal.workspaceId, adminDb);
      if (isAutomatedPrincipal(principal)) {
        // Agents act on analysis only when AI use is allowed and consent covers it (Rule 57).
        const stored = await readIntelligenceV2(adminDb, input.meetingId, principal.workspaceId);
        if (stored) {
          await assertAnalysable(adminDb, { workspaceId: principal.workspaceId, organizationId: principal.organizationId, meetingId: input.meetingId, transcriptId: stored.header.transcriptId });
        }
      }
      const result = await createFollowupTasks(adminDb, {
        nowMs: () => Date.now(),
        createTask: (item) => createTaskCore(
          taskFromItem(item, {
            workspaceId: principal.workspaceId,
            organizationId: meeting.organizationId ?? principal.organizationId,
            meetingId: input.meetingId,
            meetingTitle: meeting.title,
            fallbackAssignee: principal.userId,
          }),
          // The requesting person's own task permissions are checked again (never a system actor).
          { kind: 'user', uid: principal.userId }
        ),
      }, {
        workspaceId: principal.workspaceId,
        meetingId: input.meetingId,
        actorUid: principal.userId,
        ...(input.itemHashes ? { itemHashes: input.itemHashes } : {}),
        ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
      });
      return ok(result, context, startMs);
    } catch (err) {
      throw toCapabilityError(err);
    }
  },
};

// ── meeting.undo_followup_task ────────────────────────────────────────────────────

export const MeetingUndoFollowupTaskInputSchema = z.object({ workspaceId: Id, meetingId: Id, itemHash: Id });
export const MeetingUndoFollowupTaskOutputSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('removed'), taskId: z.string() }),
  z.object({ status: z.literal('already_removed'), taskId: z.string() }),
  z.object({ status: z.literal('nothing_to_undo') }),
]);
export type MeetingUndoFollowupTaskInput = z.infer<typeof MeetingUndoFollowupTaskInputSchema>;
export type MeetingUndoFollowupTaskOutput = z.infer<typeof MeetingUndoFollowupTaskOutputSchema>;

export const meetingUndoFollowupTaskCapability: CapabilityDefinition<MeetingUndoFollowupTaskInput, MeetingUndoFollowupTaskOutput> = {
  id: 'meeting.undo_followup_task',
  version: '1.0.0',
  name: 'Undo a follow-up task',
  description: 'Removes a task created from a meeting item, only if nobody has changed it since. An edited task is kept.',
  domain: 'meetings_conversations',
  operation: 'delete',
  inputSchema: MeetingUndoFollowupTaskInputSchema,
  outputSchema: MeetingUndoFollowupTaskOutputSchema,
  permissions: [MEETINGS_EDIT_PERMISSION, TASKS_DELETE_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: true, maxDurationMs: 10_000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 2 * 1024 },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: true, defaultEnabled: true, automatedRequiresExplicitFlag: true },
  governance: { dataClassification: 'internal', breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/intelligence/followup-tasks.ts#undoFollowupTask' },
  resolveResourceScope: resolveMeetingScope,
  async handler(input, context) {
    const startMs = Date.now();
    const { principal } = context;
    try {
      const result = await undoFollowupTask(adminDb, {
        nowMs: () => Date.now(),
        // The person's own right to delete tasks in this workspace (checked by the task domain).
        canDeleteTasks: async (workspaceId) => (await canUser(principal.userId, 'operations', 'tasks', 'delete', workspaceId)).granted,
      }, { workspaceId: principal.workspaceId, meetingId: input.meetingId, itemHash: input.itemHash, actorUid: principal.userId });
      return ok(result, context, startMs);
    } catch (err) {
      throw toCapabilityError(err);
    }
  },
};
