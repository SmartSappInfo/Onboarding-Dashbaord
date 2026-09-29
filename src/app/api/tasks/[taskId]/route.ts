import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { deleteTaskCore, getTaskWorkspaceId, updateTaskCore } from '@/lib/tasks/task-core';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';
import { UpdateTaskRequestSchema, describeTaskPayloadIssues } from '@/lib/tasks/task-input-schema';
import type { Task } from '@/lib/types';
// SECURITY (audit F9): report the detail server-side, return an opaque message.
import { toClientErrorMessage } from '@/lib/errors/report-error';

/**
 * @fileOverview Task detail API endpoint
 * Requirements: 24.1, 24.2
 *
 * SECURITY (auth hotfix §1.1a): previously unauthenticated. Callers now need a Firebase ID token
 * (Bearer) for a member of the task's STORED workspace, and are permission-checked as themselves.
 */

/** 404 when the task is missing, 401/403 from the guard, otherwise the verified uid. */
async function authorizeTask(request: NextRequest, taskId: string): Promise<{ uid: string } | NextResponse> {
  const workspaceId = await getTaskWorkspaceId(taskId);
  if (!workspaceId) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  const authResult = await authenticateApiRequest(request, { requiredWorkspaceId: workspaceId });
  return authResult.success ? { uid: authResult.user.uid } : authResult.errorResponse;
}

/**
 * PATCH /api/tasks/[taskId]
 * Update an existing task (preserves identifier fields)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const caller = await authorizeTask(request, taskId);
    if (caller instanceof NextResponse) return caller;
    // Identifiers and tenant fields are preserved (Requirement 3.2): the schema only admits writable
    // Task fields and drops everything else (was a destructure of `_`-prefixed keys that never exist).
    const parsed = UpdateTaskRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: `Invalid task payload: ${describeTaskPayloadIssues(parsed.error)}` }, { status: 400 });
    }
    const allowedUpdates = parsed.data;

    // Update task using server action
    const result = await updateTaskCore(taskId, allowedUpdates, { kind: 'user', uid: caller.uid });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update task' },
        { status: 500 }
      );
    }

    // Fetch updated task
    const taskDoc = await adminDb.collection('tasks').doc(taskId).get();
    
    if (!taskDoc.exists) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const task = { id: taskDoc.id, ...taskDoc.data() } as Task;

    // Return both identifiers in response (Requirement 24.2)
    return NextResponse.json(task);
  } catch (error: unknown) {
    console.error('[API:TASKS:PATCH] Error:', error);
    return NextResponse.json(
      { error: toClientErrorMessage('api.tasks.[taskId]', error, undefined, 'Internal server error') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[taskId]
 * Delete a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const caller = await authorizeTask(request, taskId);
    if (caller instanceof NextResponse) return caller;

    const result = await deleteTaskCore(taskId, { kind: 'user', uid: caller.uid });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete task' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[API:TASKS:DELETE] Error:', error);
    return NextResponse.json(
      { error: toClientErrorMessage('api.tasks.[taskId]', error, undefined, 'Internal server error') },
      { status: 500 }
    );
  }
}
