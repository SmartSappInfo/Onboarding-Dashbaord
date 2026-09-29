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
export async function updateTaskAction(taskId: string, updates: Partial<Task>): Promise<TaskResult> {
  try {
    const workspaceId = await getTaskWorkspaceId(taskId);
    if (!workspaceId) return { success: false, error: 'Task not found.' };
    const { uid } = await requireWorkspace(workspaceId);
    return updateTaskCore(taskId, updates, { kind: 'user', uid });
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

    const batch = adminDb.batch();
    const timestamp = new Date().toISOString();
    // Tenant fields are never bulk-editable.
    const { workspaceId: _ws, organizationId: _org, id: _id, ...safeUpdates } = updates;
    taskIds.forEach(id => {
      const data: Record<string, unknown> = { ...safeUpdates, updatedAt: timestamp };
      if (updates.status === 'done') data.completedAt = timestamp;
      batch.update(adminDb.collection('tasks').doc(id), data);
    });
    await batch.commit();
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

    const batch = adminDb.batch();
    taskIds.forEach(id => batch.delete(adminDb.collection('tasks').doc(id)));
    await batch.commit();
    return { success: true };
  } catch (error: unknown) {
    console.error('[TASK] Bulk Delete Error:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
