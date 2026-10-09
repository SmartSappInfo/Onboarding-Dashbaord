'use server';

/**
 * @fileOverview Task Server Actions — the browser-facing entry points for tasks.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a / audit F2): every export here is a public HTTP
 * endpoint, so each one derives identity from the session (`requireWorkspace`) and authorizes
 * against the task's STORED workspace. The caller can no longer supply a `userId` (a `system-`
 * prefix used to skip the permission check entirely).
 *
 * Trusted server code (API routes with their own auth, MCP gateway, call-centre engine, form
 * pipeline, automation engine) calls `@/lib/tasks/task-core` directly with an explicit actor.
 */

import { adminDb } from './firebase-admin';
import type { Task } from './types';
import { canUser } from './workspace-permissions';
import { requireWorkspace } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';
import {
  createTaskCore,
  deleteTaskCore,
  getTaskWorkspaceId,
  getTasksForContactCore,
  tasksOutsideWorkspace,
  updateTaskCore,
  type NewTaskInput,
  type TaskResult,
} from '@/lib/tasks/task-core';

/** Creates a task as the signed-in user, in a workspace they belong to. */
export async function createTaskAction(taskData: NewTaskInput): Promise<TaskResult> {
  try {
    const { uid } = await requireWorkspace(taskData.workspaceId);
    return createTaskCore(taskData, { kind: 'user', uid });
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/** Updates a task as the signed-in user; the task's own workspace is authorized. */
/**
 * SECURITY (PR-0 review): fields the session user may not change through the task UI.
 * - Tenant/identity (`id`, `workspaceId`, `organizationId`, `createdAt`, `updatedAt`): owned by the store.
 * - System links (`relatedParentId`, `relatedEntityId`, `relatedEntityType`, `source`, `automationId`):
 *   set only by the flows that create linked tasks (DocSigning obligations, surveys, automations).
 *   Letting a user re-point them would, for example, let completing any task fulfil an arbitrary
 *   contract obligation through the task-completion reverse hook. Stripping them on update also keeps
 *   an ordinary edit (the editor sends `relatedParentId: null`) from silently unlinking a task.
 * The UI spreads whole stored tasks into updates (`{ ...task, status }`), so this strips rather than
 * rejects: unknown or legacy values elsewhere stay as tolerant as before.
 */
const NON_EDITABLE_TASK_FIELDS = [
  'id',
  'workspaceId',
  'organizationId',
  'createdAt',
  'updatedAt',
  'relatedParentId',
  'relatedEntityId',
  'relatedEntityType',
  'source',
  'automationId',
] as const;

function editableTaskFields(updates: Partial<Task>): Partial<Task> {
  const editable: Partial<Task> = { ...updates };
  for (const field of NON_EDITABLE_TASK_FIELDS) delete editable[field];
  return editable;
}

export async function updateTaskAction(taskId: string, updates: Partial<Task>): Promise<TaskResult> {
  try {
    const workspaceId = await getTaskWorkspaceId(taskId);
    if (!workspaceId) return { success: false, error: 'Task not found.' };
    const { uid } = await requireWorkspace(workspaceId);
    return updateTaskCore(taskId, editableTaskFields(updates), { kind: 'user', uid });
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/** Deletes a task as the signed-in user; the task's own workspace is authorized. */
export async function deleteTaskAction(taskId: string): Promise<TaskResult> {
  try {
    const workspaceId = await getTaskWorkspaceId(taskId);
    if (!workspaceId) return { success: false, error: 'Task not found.' };
    const { uid } = await requireWorkspace(workspaceId);
    return deleteTaskCore(taskId, { kind: 'user', uid });
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/** Tasks for an entity, for a signed-in member of the workspace. */
export async function getTasksForContact(entityId: string, workspaceId: string): Promise<Task[]> {
  await requireWorkspace(workspaceId);
  return getTasksForContactCore(entityId, workspaceId);
}

/** Bulk-updates tasks. Every task must belong to the verified workspace. */
export async function bulkUpdateTasksAction(taskIds: string[], updates: Partial<Task>, workspaceId: string): Promise<TaskResult> {
  try {
    const { uid } = await requireWorkspace(workspaceId);
    const permission = await canUser(uid, 'operations', 'tasks', 'edit', workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason ?? 'Permission denied.' };
    if ((await tasksOutsideWorkspace(taskIds, workspaceId)).length > 0) {
      return { success: false, error: 'Some tasks are not in this workspace.' };
    }

    const timestamp = new Date().toISOString();
    // Tenant fields and system links are never bulk-editable (see NON_EDITABLE_TASK_FIELDS).
    const safeUpdates = editableTaskFields(updates);

    // Batch chunking: Firestore limits batches to 500 writes
    const CHUNK_SIZE = 450;
    for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
      const chunk = taskIds.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();
      chunk.forEach(id => {
        const data: Record<string, unknown> = { ...safeUpdates, updatedAt: timestamp };
        if (updates.status === 'done') data.completedAt = timestamp;
        batch.update(adminDb.collection('tasks').doc(id), data);
      });
      await batch.commit();
    }

    // Bi-directional Reverse Hook: Fulfill contractual obligations if bulk-completed tasks are linked (P4.1 & P4.2)
    if (updates.status === 'done') {
      try {
        const snaps = await Promise.all(
          taskIds.map(id => adminDb.collection('tasks').doc(id).get())
        );
        const linkedTasks = snaps
          .filter(s => s.exists)
          .map(s => ({ id: s.id, ...(s.data() as Partial<Task>) }))
          .filter(t => t.relatedParentId && t.relatedEntityId);

        if (linkedTasks.length > 0) {
          const { syncTaskCompletionToObligation } = await import(
            '@/lib/documents/crm-deal-sync-service'
          );
          await Promise.allSettled(
            linkedTasks.map(async t => {
              const now = new Date().toISOString();
              try {
                const res = await syncTaskCompletionToObligation({
                  workspaceId,
                  taskId: t.id,
                  contractId: t.relatedParentId!,
                  obligationId: t.relatedEntityId!,
                  actorUserId: uid,
                });
                if (res && res.success) {
                  await adminDb.collection('tasks').doc(t.id).update({
                    obligationSyncStatus: 'synced',
                    obligationSyncAt: now,
                    obligationSyncError: null,
                    updatedAt: now,
                  });
                } else {
                  await adminDb.collection('tasks').doc(t.id).update({
                    obligationSyncStatus: 'failed',
                    obligationSyncError: res?.error || 'Downstream obligation sync failed',
                    updatedAt: now,
                  });
                }
              } catch (err: unknown) {
                const errMessage = err instanceof Error ? err.message : 'Downstream obligation sync failed';
                await adminDb.collection('tasks').doc(t.id).update({
                  obligationSyncStatus: 'failed',
                  obligationSyncError: errMessage,
                  updatedAt: now,
                });
              }
            })
          );
        }
      } catch (syncErr: unknown) {
        console.warn('[TASK] Failed to sync obligations on bulk task completion:', syncErr);
      }
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('[TASK] Bulk Update Error:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/** Bulk-deletes tasks. Every task must belong to the verified workspace. */
export async function bulkDeleteTasksAction(taskIds: string[], workspaceId: string): Promise<TaskResult> {
  try {
    const { uid } = await requireWorkspace(workspaceId);
    const permission = await canUser(uid, 'operations', 'tasks', 'delete', workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason ?? 'Permission denied.' };
    if ((await tasksOutsideWorkspace(taskIds, workspaceId)).length > 0) {
      return { success: false, error: 'Some tasks are not in this workspace.' };
    }

    // Batch chunking: Firestore limits batches to 500 writes
    const CHUNK_SIZE = 450;
    for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
      const chunk = taskIds.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();
      chunk.forEach(id => batch.delete(adminDb.collection('tasks').doc(id)));
      await batch.commit();
    }
    return { success: true };
  } catch (error: unknown) {
    console.error('[TASK] Bulk Delete Error:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export type RetryObligationSyncResult =
  | { success: true; alreadySynced?: boolean; message?: string; error?: never }
  | { success: false; error: string; alreadySynced?: never; message?: never };

/**
 * Retries synchronization between a completed task and its linked contractual obligation.
 * Strictly verifies workspace membership, anti-IDOR confinement, and TOCTOU concurrency.
 * (Rule 8, Rule 18, Rule 19).
 */
export async function retryTaskObligationSyncAction(
  workspaceId: string,
  taskId: string,
  expectedUpdatedAt?: string
): Promise<RetryObligationSyncResult> {
  try {
    const { uid } = await requireWorkspace(workspaceId);
    const permission = await canUser(uid, 'operations', 'tasks', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason ?? 'Permission denied.' };
    }

    const taskDoc = await adminDb.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      return { success: false, error: 'Task not found.' };
    }

    const task = { id: taskDoc.id, ...taskDoc.data() } as Task;
    if (task.workspaceId !== workspaceId) {
      return { success: false, error: 'Task does not belong to this workspace.' };
    }

    // TOCTOU concurrency check (Rule 18)
    if (expectedUpdatedAt && task.updatedAt !== expectedUpdatedAt) {
      return { success: false, error: 'Task was modified concurrently by another process. Please reload and retry.' };
    }

    if (!task.relatedParentId || !task.relatedEntityId) {
      return { success: false, error: 'Task does not have a linked contract obligation.' };
    }

    // Idempotency: if already synced, return success without duplicate calls (Rule 19)
    if (task.obligationSyncStatus === 'synced') {
      return { success: true, alreadySynced: true };
    }

    const { syncTaskCompletionToObligation } = await import('@/lib/documents/crm-deal-sync-service');
    const syncRes = await syncTaskCompletionToObligation({
      workspaceId,
      taskId: task.id,
      contractId: task.relatedParentId,
      obligationId: task.relatedEntityId,
      actorUserId: uid,
    });

    const now = new Date().toISOString();
    if (syncRes && syncRes.success) {
      await adminDb.collection('tasks').doc(taskId).update({
        obligationSyncStatus: 'synced',
        obligationSyncAt: now,
        obligationSyncError: null,
        updatedAt: now,
      });
      return { success: true, alreadySynced: false };
    } else {
      const errorMsg = syncRes?.error || 'Downstream sync to contract obligation failed';
      await adminDb.collection('tasks').doc(taskId).update({
        obligationSyncStatus: 'failed',
        obligationSyncError: errorMsg,
        updatedAt: now,
      });
      return { success: false, error: errorMsg };
    }
  } catch (error: unknown) {
    console.error('[TASK] Retry Obligation Sync Error:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
