/**
 * @fileOverview Task domain core (auth hotfix, agents_mcp Phase 1 §1.1a).
 *
 * WHY THIS FILE IS NOT `'use server'`: every export of a `'use server'` module is a public HTTP
 * endpoint. The core below trusts its `actor` argument, so it must only be reachable from server
 * code that has ALREADY authenticated the caller (session wrapper in `task-server-actions.ts`,
 * `/api/tasks` token guard, MCP gateway, call-centre engine, form pipeline, automation engine).
 * Never re-export these functions from a `'use server'` module (audit Phase 4 lesson).
 *
 * Permission model:
 * - `{ kind: 'user' }`   — a verified uid; checked with `canUser` against the TASK's own workspace.
 * - `{ kind: 'system' }` — trusted server code acting on its own authority; no user permission gate.
 */

import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import type { Task, EntityType, TaskReminder } from '@/lib/types';
import { logActivity } from '@/lib/activity-logger';
import { resolveContact } from '@/lib/contact-adapter';
import { canUser } from '@/lib/workspace-permissions';
import { getErrorMessage } from '@/lib/errors/report-error';

export type TaskActor =
  | { kind: 'user'; uid: string }
  | { kind: 'system'; source: string };

export type NewTaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

export type TaskResult =
  | { success: true; id?: string; error?: never }
  | { success: false; id?: never; error: string };

/** Fields that identify a task or its tenant; updates may never change them. */
const IMMUTABLE_TASK_FIELDS = ['id', 'workspaceId', 'organizationId', 'createdAt'] as const;

async function checkPermission(
  actor: TaskActor,
  action: 'create' | 'edit' | 'delete',
  workspaceId: string
): Promise<{ granted: true } | { granted: false; reason: string }> {
  if (actor.kind === 'system') return { granted: true };
  const permission = await canUser(actor.uid, 'operations', 'tasks', action, workspaceId);
  return permission.granted ? { granted: true } : { granted: false, reason: permission.reason ?? 'Permission denied.' };
}

/**
 * Audit/linking fields are read leniently: a legacy or unexpected shape (null, '' or an old enum value)
 * becomes `undefined` instead of failing the whole parse. Only the tenant field fails closed.
 */
const lenient = <T extends z.ZodTypeAny>(schema: T) => schema.nullish().catch(undefined);

/**
 * The tenant and identity fields of a stored task that authorization and audit rely on.
 *
 * CAUTION (PR-0 review): ONLY `workspaceId` may fail closed — it is what authorization checks. Every
 * other field is best-effort. The Tasks UI stores `relatedParentId: null` / `relatedEntityId: null`,
 * and legacy tasks carry `organizationId: null`, `entityType: 'school'` or `title: null`; a strict
 * schema here made update/complete/delete answer "Task not found." for all of them.
 * Regression tests: src/lib/tasks/__tests__/task-core-stored-shapes.test.ts.
 */
const StoredTaskRefSchema = z.object({
  workspaceId: z.string().min(1),
  organizationId: lenient(z.string()),
  entityId: lenient(z.string()),
  entityType: lenient(z.enum(['institution', 'family', 'person'])),
  title: lenient(z.string()),
  relatedParentId: lenient(z.string()),
  relatedEntityId: lenient(z.string()),
  source: lenient(z.string()),
});
type StoredTaskRef = z.infer<typeof StoredTaskRefSchema>;

async function loadStoredTaskRef(taskId: string): Promise<StoredTaskRef | null> {
  if (!taskId) return null;
  const snap = await adminDb.collection('tasks').doc(taskId).get();
  if (!snap.exists) return null;
  const parsed = StoredTaskRefSchema.safeParse(snap.data());
  return parsed.success ? parsed.data : null;
}

/** The workspace a stored task belongs to, or null when the task does not exist. */
export async function getTaskWorkspaceId(taskId: string): Promise<string | null> {
  return (await loadStoredTaskRef(taskId))?.workspaceId ?? null;
}

const WorkspaceOrgSchema = z.object({ organizationId: lenient(z.string()) });

/**
 * SECURITY (Round 4 item 5): a task's organization is its workspace's organization — never the
 * caller's value, which could otherwise write tasks and activity into another tenant's feed.
 * Returns null when the workspace document does not exist.
 */
async function workspaceOrganizationId(workspaceId: string): Promise<string | null> {
  if (!workspaceId) return null;
  const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (!snap.exists) return null;
  const parsed = WorkspaceOrgSchema.safeParse(snap.data());
  return parsed.success ? parsed.data.organizationId ?? '' : '';
}

/**
 * Organization for a new task. User actors must target a real workspace. Trusted system paths
 * (automations/forms on legacy workspace ids without a workspace document) keep their supplied value.
 */
async function resolveTaskOrganizationId(
  workspaceId: string,
  supplied: string | undefined,
  actor: TaskActor
): Promise<{ ok: true; organizationId: string } | { ok: false; error: string }> {
  const fromWorkspace = await workspaceOrganizationId(workspaceId);
  if (fromWorkspace !== null) return { ok: true, organizationId: fromWorkspace };
  if (actor.kind === 'user') return { ok: false, error: 'Workspace not found.' };
  return { ok: true, organizationId: supplied ?? '' };
}

async function resolveEntity(taskData: NewTaskInput): Promise<{ entityName: string | null; entityType: EntityType | null }> {
  let entityName: string | null = taskData.entityName || null;
  let entityType: EntityType | null = taskData.entityType || null;
  if (taskData.workspaceId && taskData.entityId) {
    const contact = await resolveContact(taskData.entityId, taskData.workspaceId);
    if (contact) {
      entityName = contact.name;
      entityType = contact.entityType || null;
    }
  }
  return { entityName, entityType };
}

async function writeTask(taskData: NewTaskInput): Promise<{ id: string; entityType: EntityType | null }> {
  const timestamp = new Date().toISOString();
  const { entityName, entityType } = await resolveEntity(taskData);
  const docRef = await adminDb.collection('tasks').add({
    ...taskData,
    entityId: taskData.entityId,
    entityName,
    entityType,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: taskData.status || 'todo',
    reminders: taskData.reminders || [],
    reminderSent: false,
  });
  return { id: docRef.id, entityType };
}

/**
 * Creates a task with workspace awareness and entity support
 * (unified entity architecture, Requirements 3.1, 25.3: entityId is the primary identifier).
 */
export async function createTaskCore(taskData: NewTaskInput, actor: TaskActor): Promise<TaskResult> {
  try {
    const permission = await checkPermission(actor, 'create', taskData.workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };
    const tenant = await resolveTaskOrganizationId(taskData.workspaceId, taskData.organizationId, actor);
    if (!tenant.ok) return { success: false, error: tenant.error };

    const { id, entityType } = await writeTask({ ...taskData, organizationId: tenant.organizationId });
    await logActivity({
      organizationId: tenant.organizationId,
      workspaceId: taskData.workspaceId,
      entityId: taskData.entityId || undefined,
      entityType: entityType || undefined,
      userId: actor.kind === 'user' ? actor.uid : null,
      type: 'task_created',
      source: 'system',
      description: `initialized a new task protocol: "${taskData.title}"`,
      metadata: { taskId: id, category: taskData.category },
    });
    return { success: true, id };
  } catch (error: unknown) {
    console.error('[TASK] Failed to create task:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Creates a task from the automation engine (system actor, no user permission gate).
 * Emits `task_created` so TASK_CREATED automations can chain.
 */
export async function createTaskFromAutomation(taskData: NewTaskInput, organizationId: string): Promise<string> {
  const tenant = await resolveTaskOrganizationId(taskData.workspaceId, organizationId, { kind: 'system', source: 'automation' });
  const resolvedOrganizationId = tenant.ok ? tenant.organizationId : organizationId;
  const { id, entityType } = await writeTask({ ...taskData, organizationId: resolvedOrganizationId });
  await logActivity({
    organizationId: resolvedOrganizationId,
    workspaceId: taskData.workspaceId,
    entityId: taskData.entityId || undefined,
    entityType: entityType || undefined,
    userId: null,
    type: 'task_created',
    source: 'system',
    description: `Automation created task: "${taskData.title}"`,
    metadata: { taskId: id, category: taskData.category, automationId: taskData.automationId },
  });
  return id;
}

/** Updates a task. The permission check uses the task's STORED workspace, never the caller's. */
export async function updateTaskCore(
  taskId: string,
  updates: Partial<Task>,
  actor: TaskActor,
  expectedWorkspaceId?: string
): Promise<TaskResult> {
  try {
    const stored = await loadStoredTaskRef(taskId);
    if (!stored) return { success: false, error: 'Task not found.' };
    const { workspaceId } = stored;
    if (expectedWorkspaceId && workspaceId !== expectedWorkspaceId) {
      return { success: false, error: 'Task does not belong to the specified workspace.' };
    }
    const permission = await checkPermission(actor, 'edit', workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };

    const timestamp = new Date().toISOString();
    const data: Record<string, unknown> = { ...updates, updatedAt: timestamp };
    for (const field of IMMUTABLE_TASK_FIELDS) delete data[field];

    const isMarkingDone = updates.status === 'done';
    const isCancelling = updates.status === 'cancelled';
    if (isMarkingDone && !updates.completedAt) {
      data.completedAt = timestamp;
    } else if (updates.status && updates.status !== 'done') {
      data.completedAt = null;
    }

    // Rule 26 & PRD §7.6: Automatic reminder cancellation when task is completed or cancelled
    if (isMarkingDone || isCancelling) {
      const currentReminders = ((updates.reminders || stored.reminders || []) as TaskReminder[]);
      const hasScheduled = currentReminders.some(
        r => r.status === 'scheduled' || (!r.sent && (!r.status || r.status === 'scheduled'))
      );
      if (hasScheduled) {
        data.reminders = currentReminders.map(r => {
          if (r.status === 'scheduled' || (!r.sent && (!r.status || r.status === 'scheduled'))) {
            return { ...r, status: 'cancelled' as const };
          }
          return r;
        });
      }
    }

    await adminDb.collection('tasks').doc(taskId).update(data);

    if (isMarkingDone) {
      // Audit against the STORED task (tenant + entity), never the update payload.
      await logActivity({
        organizationId: stored.organizationId || '',
        workspaceId,
        entityId: stored.entityId || undefined,
        entityType: stored.entityType || undefined,
        userId: actor.kind === 'user' ? actor.uid : null,
        type: 'task_completed',
        source: 'system',
        description: `successfully resolved task: "${updates.title || stored.title || 'Task Record'}"`,
        metadata: { taskId },
      });

      // Bi-directional Reverse Hook: Fulfill contractual obligation if task is linked (P4.1 & P4.2)
      if (stored.relatedParentId && stored.relatedEntityId) {
        try {
          const { syncTaskCompletionToObligation } = await import(
            '@/lib/documents/crm-deal-sync-service'
          );
          await syncTaskCompletionToObligation({
            workspaceId,
            taskId,
            contractId: stored.relatedParentId,
            obligationId: stored.relatedEntityId,
            actorUserId: actor.kind === 'user' ? actor.uid : undefined,
          });
        } catch (syncErr: unknown) {
          console.warn('[TASK] Failed to sync obligation status on task completion:', syncErr);
        }
      }
    }
    return { success: true };
  } catch (error: unknown) {
    console.error('[TASK] Failed to update task:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteTaskCore(taskId: string, actor: TaskActor): Promise<TaskResult> {
  try {
    const workspaceId = await getTaskWorkspaceId(taskId);
    if (!workspaceId) return { success: false, error: 'Task not found.' };
    const permission = await checkPermission(actor, 'delete', workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };

    await adminDb.collection('tasks').doc(taskId).delete();
    return { success: true };
  } catch (error: unknown) {
    console.error('[TASK] Failed to delete task:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/** Tasks linked to an entity inside one workspace. Callers must have authorized the workspace. */
export async function getTasksForContactCore(entityId: string, workspaceId: string): Promise<Task[]> {
  try {
    if (!entityId || !workspaceId) return [];
    const snapshot = await adminDb
      .collection('tasks')
      .where('workspaceId', '==', workspaceId)
      .where('entityId', '==', entityId)
      .orderBy('dueDate', 'asc')
      .get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Task);
  } catch (error: unknown) {
    console.error('[TASK] Failed to query tasks for contact:', error);
    return [];
  }
}

/** Ids from `taskIds` that are NOT stored in `workspaceId` (bulk operations must refuse them). */
export async function tasksOutsideWorkspace(taskIds: string[], workspaceId: string): Promise<string[]> {
  const owners = await Promise.all(taskIds.map(async id => [id, await getTaskWorkspaceId(id)] as const));
  return owners.filter(([, owner]) => owner !== workspaceId).map(([id]) => id);
}
