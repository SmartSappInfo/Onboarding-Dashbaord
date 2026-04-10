import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { createTaskAction, getTasksForContact } from '@/lib/task-server-actions';
import type { Task } from '@/lib/types';

/**
 * @fileOverview Tasks API endpoint with entityId support
 * Requirements: 24.1, 24.2, 24.5
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
    const entityId = searchParams.get('entityId');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    if (!entityId && !entityId) {
      return NextResponse.json(
        { error: 'Either entityId or entityId must be provided' },
        { status: 400 }
      );
    }

    // Prefer entityId when both provided (Requirement 24.1)
    const identifier = entityId ? { entityId } : { entityId: entityId! };

    // Get tasks using server action
    const tasks = await getTasksForContact(identifier, workspaceId);

    // Apply additional filters if provided
    let filteredTasks = tasks;
    if (status) {
      filteredTasks = filteredTasks.filter(task => task.status === status);
    }
    if (assignedTo) {
      filteredTasks = filteredTasks.filter(task => task.assignedTo === assignedTo);
    }

    // Add deprecation warning if entityId was used (Requirement 24.3)
    const headers: Record<string, string> = {};
    if (entityId && !entityId) {
      headers['Warning'] = '299 - "entityId parameter is deprecated and will be removed in Q4 2026. Use entityId instead."';
    }

    // Return both identifiers in response (Requirement 24.2)
    return NextResponse.json(
      {
        tasks: filteredTasks,
        total: filteredTasks.length
      },
      { headers }
    );
  } catch (error: any) {
    console.error('[API:TASKS:GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
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
    const body = await request.json();
    const {
      workspaceId,
      title,
      description,
      priority,
      status,
      category,
      dueDate,
      assignedTo,
      entityId,
      entityType,
      entityId,
      ...rest
    } = body;

    // Validate required fields
    if (!workspaceId || !title) {
      return NextResponse.json(
        { error: 'workspaceId and title are required' },
        { status: 400 }
      );
    }

    if (!entityId && !entityId) {
      return NextResponse.json(
        { error: 'Either entityId or entityId must be provided' },
        { status: 400 }
      );
    }

    // Prefer entityId when both provided (Requirement 24.1)
    const taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      workspaceId,
      title,
      description: description || '',
      priority: priority || 'medium',
      status: status || 'todo',
      category: category || 'general',
      dueDate: dueDate || new Date().toISOString(),
      assignedTo: assignedTo || '',
      // Dual-write: populate both identifiers (Requirement 24.2)
      entityId: entityId || null,
      entityType: entityType || null,
      entityId: entityId || null,
      reminderSent: false,
      reminders: [],
      ...rest
    };

    // Create task using server action
    const result = await createTaskAction(taskData);

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
  } catch (error: any) {
    console.error('[API:TASKS:POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
