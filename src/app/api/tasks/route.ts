import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { createTaskCore, getTasksForContactCore } from '@/lib/tasks/task-core';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';
import { CreateTaskRequestSchema, describeTaskPayloadIssues } from '@/lib/tasks/task-input-schema';
import type { Task } from '@/lib/types';
// SECURITY (audit F9): report the detail server-side, return an opaque message.
import { toClientErrorMessage } from '@/lib/errors/report-error';

/**
 * @fileOverview Tasks API endpoint with entityId support
 * Requirements: 24.1, 24.2, 24.5
 *
 * SECURITY (auth hotfix §1.1a): these handlers were unauthenticated — GET listed any workspace's
 * tasks and POST created tasks as 'system_api'. Callers now need a Firebase ID token (Bearer) for a
 * member of the workspace; writes are permission-checked as that user.
 */

/**
 * GET /api/tasks
 * Query tasks for a contact using either entityId or entityId
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const entityId = searchParams.get('entityId');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId must be provided' },
        { status: 400 }
      );
    }

    const authResult = await authenticateApiRequest(request, { requiredWorkspaceId: workspaceId });
    if (!authResult.success) return authResult.errorResponse;

    const tasks = await getTasksForContactCore(entityId, workspaceId);

    // Apply additional filters if provided
    let filteredTasks = tasks;
    if (status) {
      filteredTasks = filteredTasks.filter(task => task.status === status);
    }
    if (assignedTo) {
      filteredTasks = filteredTasks.filter(task => task.assignedTo === assignedTo);
    }

    const headers: Record<string, string> = {};

    // Return both identifiers in response (Requirement 24.2)
    return NextResponse.json(
      {
        tasks: filteredTasks,
        total: filteredTasks.length
      },
      { headers }
    );
  } catch (error: unknown) {
    console.error('[API:TASKS:GET] Error:', error);
    return NextResponse.json(
      { error: toClientErrorMessage('api.tasks', error, undefined, 'Internal server error') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * Create a new task with entityId support
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    // Required fields keep their original, specific error messages.
    const raw = typeof body === 'object' && body !== null ? body : {};
    if (!('workspaceId' in raw) || !raw.workspaceId || !('title' in raw) || !raw.title) {
      return NextResponse.json(
        { error: 'workspaceId and title are required' },
        { status: 400 }
      );
    }
    if (!('entityId' in raw) || !raw.entityId) {
      return NextResponse.json(
        { error: 'entityId must be provided' },
        { status: 400 }
      );
    }

    // SECURITY (Round 4 item 5): allowlist + type-check the body. Unknown keys are dropped and
    // tenant/identity fields (organizationId, id, createdAt, ...) can never be set from here.
    const parsed = CreateTaskRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: `Invalid task payload: ${describeTaskPayloadIssues(parsed.error)}` }, { status: 400 });
    }
    const { workspaceId, entityId, ...fields } = parsed.data;

    const authResult = await authenticateApiRequest(request, { requiredWorkspaceId: workspaceId });
    if (!authResult.success) return authResult.errorResponse;

    const taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      ...fields,
      title: fields.title ?? '',
      description: fields.description || '',
      priority: fields.priority || 'medium',
      status: fields.status || 'todo',
      category: fields.category || 'general',
      dueDate: fields.dueDate || new Date().toISOString(),
      assignedTo: fields.assignedTo || '',
      // Dual-write: populate both identifiers (Requirement 24.2)
      entityId,
      reminderSent: false,
      reminders: fields.reminders || [],
      workspaceId,
    };

    const result = await createTaskCore(taskData, { kind: 'user', uid: authResult.user.uid });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create task' },
        { status: 500 }
      );
    }

    // Fetch the created task to return full data
    const taskDoc = await adminDb.collection('tasks').doc(result.id!).get();
    const task = { id: taskDoc.id, ...taskDoc.data() } as Task;

    // Add deprecation warning if entityId was used (Requirement 24.3)
    const headers: Record<string, string> = {};
    if (entityId && !entityId) {
      headers['Warning'] = '299 - "entityId parameter is deprecated and will be removed in Q4 2026. Use entityId instead."';
    }

    // Return both identifiers in response (Requirement 24.2)
    return NextResponse.json(task, { status: 201, headers });
  } catch (error: unknown) {
    console.error('[API:TASKS:POST] Error:', error);
    return NextResponse.json(
      { error: toClientErrorMessage('api.tasks', error, undefined, 'Internal server error') },
      { status: 500 }
    );
  }
}
