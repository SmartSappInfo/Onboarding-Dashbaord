/**
 * @fileOverview Follow-up tasks from meeting items, and their undo (Phase 11 M2 · T4.1; plan §4.6, §4.11).
 *
 * Create: every task goes through `convertItemToTask`, the same per-item claim as the "Convert to
 * task" button (`meeting_item_conversions/{workspaceId}__{itemHash}`). So a double click, a retry
 * after a lost response, a re-analysis or a mix of bulk and single conversions never creates a
 * second task for one item. The call is bound to the intelligence version the person reviewed: if
 * the analysis was re-run in between, it is refused (`VERSION_CONFLICT`).
 *
 * Undo (compensation): the task is deleted only while it is unchanged since creation
 * (`updatedAt === createdAt`, checked inside the transaction that deletes it). An edited task is
 * kept and the person is told to remove it from Tasks. Undo frees the item for a new conversion.
 * A second undo is a no-op.
 *
 * Tests: src/lib/meetings/__tests__/followup-tasks.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import type { NewTaskInput } from '@/lib/tasks/task-core';
import { ACTIONABLE_ITEM_TYPES, type MeetingItem } from './intelligence-schemas';
import { readIntelligenceV2 } from './intelligence-store';
import { CONVERSIONS, ItemConversionError, conversionDocId, convertItemToTask, listConversions } from './item-conversion';

export const MAX_FOLLOWUP_TASKS_PER_CALL = 50;

export type FollowupTaskErrorCode = 'NOT_FOUND' | 'VERSION_CONFLICT' | 'TOO_MANY' | 'EDITED' | 'FORBIDDEN';

export class FollowupTaskError extends Error {
  constructor(readonly code: FollowupTaskErrorCode, message: string) {
    super(message);
    this.name = 'FollowupTaskError';
  }
}

export type SkipReason = 'needs_review' | 'not_actionable' | 'not_found' | 'in_progress' | 'failed';

export interface FollowupTasksResult {
  intelligenceVersion: number;
  created: Array<{ itemHash: string; taskId: string }>;
  existing: Array<{ itemHash: string; taskId: string }>;
  skipped: Array<{ itemHash: string; reason: SkipReason; message?: string }>;
}

export interface FollowupTaskDeps {
  createTask: (item: MeetingItem) => Promise<{ success: boolean; id?: string; error?: string }>;
  nowMs: () => number;
}

/**
 * The task created from a meeting item: one mapping for the "Convert to task" button and the
 * `meeting.create_followup_tasks` capability. Owner shown, never guessed (plan §4.6): a matched
 * workspace user, else the person (or the person an agent acts for) creating it.
 */
export function taskFromItem(
  item: MeetingItem,
  ctx: { workspaceId: string; organizationId: string | undefined; meetingId: string; meetingTitle: string | undefined; fallbackAssignee: string }
): NewTaskInput {
  return {
    workspaceId: ctx.workspaceId,
    ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}),
    title: item.text,
    description: `From meeting ${ctx.meetingTitle ?? ctx.meetingId}. Owner: ${item.owner?.matched ? item.owner.name : 'Unassigned'}.`,
    priority: 'medium',
    status: 'todo',
    category: 'follow_up',
    assignedTo: item.owner?.matched && item.owner.userId ? item.owner.userId : ctx.fallbackAssignee,
    dueDate: item.dueIso ?? new Date().toISOString(),
    reminders: [],
    reminderSent: false,
    source: 'system',
    relatedEntityType: 'Meeting',
    relatedEntityId: ctx.meetingId,
    relatedParentId: item.itemHash,
  };
}

function skipReasonFor(item: MeetingItem | undefined): SkipReason | null {
  if (!item) return 'not_found';
  if (!ACTIONABLE_ITEM_TYPES.includes(item.type)) return 'not_actionable';
  if (item.needsReview) return 'needs_review';
  return null;
}

export async function createFollowupTasks(
  db: Firestore,
  deps: FollowupTaskDeps,
  params: { workspaceId: string; meetingId: string; actorUid: string; itemHashes?: string[]; expectedVersion?: number }
): Promise<FollowupTasksResult> {
  if (params.itemHashes && params.itemHashes.length > MAX_FOLLOWUP_TASKS_PER_CALL) {
    throw new FollowupTaskError('TOO_MANY', `Create at most ${MAX_FOLLOWUP_TASKS_PER_CALL} tasks at a time.`);
  }
  const stored = await readIntelligenceV2(db, params.meetingId, params.workspaceId);
  if (!stored) throw new FollowupTaskError('NOT_FOUND', 'This meeting has no analysis yet.');
  if (params.expectedVersion !== undefined && stored.header.version !== params.expectedVersion) {
    throw new FollowupTaskError('VERSION_CONFLICT', 'The analysis changed since you reviewed it. Review it again.');
  }

  const byHash = new Map(stored.items.map((i) => [i.itemHash, i]));
  const requested = params.itemHashes
    ? [...new Set(params.itemHashes)]
    : stored.items.filter((i) => skipReasonFor(i) === null).map((i) => i.itemHash).slice(0, MAX_FOLLOWUP_TASKS_PER_CALL);

  const result: FollowupTasksResult = { intelligenceVersion: stored.header.version, created: [], existing: [], skipped: [] };
  for (const itemHash of requested) {
    const reason = skipReasonFor(byHash.get(itemHash));
    if (reason) {
      result.skipped.push({ itemHash, reason });
      continue;
    }
    try {
      const converted = await convertItemToTask(db, deps, { workspaceId: params.workspaceId, meetingId: params.meetingId, itemHash, actorUid: params.actorUid });
      (converted.replayed ? result.existing : result.created).push({ itemHash, taskId: converted.taskId });
    } catch (err) {
      // One item failing never undoes the others; an idempotent retry completes the rest (§4.14).
      const message = err instanceof Error ? err.message : String(err);
      result.skipped.push({ itemHash, reason: message.includes('already being converted') ? 'in_progress' : 'failed', message });
      if (!(err instanceof ItemConversionError)) console.warn('[followup-tasks] task creation failed', { itemHash, message });
    }
  }
  return result;
}

const StoredTaskSchema = z.object({
  workspaceId: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).loose();

export type UndoResult =
  | { status: 'removed'; taskId: string }
  | { status: 'already_removed'; taskId: string }
  | { status: 'nothing_to_undo' };

export async function undoFollowupTask(
  db: Firestore,
  deps: { canDeleteTasks: (workspaceId: string) => Promise<boolean>; nowMs: () => number },
  params: { workspaceId: string; meetingId: string; itemHash: string; actorUid: string }
): Promise<UndoResult> {
  if (!(await deps.canDeleteTasks(params.workspaceId))) {
    throw new FollowupTaskError('FORBIDDEN', 'You do not have permission to remove tasks in this workspace.');
  }
  const taskId = (await listConversions(db, params.workspaceId, params.meetingId)).get(params.itemHash);
  if (!taskId) return { status: 'nothing_to_undo' };

  const conversionRef = db.collection(CONVERSIONS).doc(conversionDocId(params.workspaceId, params.itemHash));
  const taskRef = db.collection('tasks').doc(taskId);
  const freed = {
    workspaceId: params.workspaceId,
    meetingId: params.meetingId,
    itemHash: params.itemHash,
    undoneTaskId: taskId,
    undoneAt: new Date(deps.nowMs()).toISOString(),
    undoneBy: params.actorUid,
  };

  return db.runTransaction(async (tx): Promise<UndoResult> => {
    const snap = await tx.get(taskRef);
    if (!snap.exists) {
      tx.set(conversionRef, freed);
      return { status: 'already_removed', taskId };
    }
    const task = StoredTaskSchema.safeParse(snap.data());
    // A task in another workspace looks the same as a missing one (no cross-tenant probing).
    if (!task.success || task.data.workspaceId !== params.workspaceId) {
      throw new FollowupTaskError('NOT_FOUND', 'Task not found.');
    }
    if (!task.data.createdAt || task.data.updatedAt !== task.data.createdAt) {
      throw new FollowupTaskError('EDITED', "This task was edited, so it wasn't removed. Remove it from Tasks if needed.");
    }
    tx.delete(taskRef);
    tx.set(conversionRef, freed);
    return { status: 'removed', taskId };
  });
}
