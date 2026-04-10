import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { updateTaskAction, deleteTaskAction } from '@/lib/task-server-actions';
import type { Task } from '@/lib/types';

/**
 * @fileOverview Task detail API endpoint
 * Requirements: 24.1, 24.2
 */

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
    const updates = await request.json();

    // Remove identifier fields from updates to preserve them (Requirement 3.2)
    const { entityId, entityType, id, createdAt, ...allowedUpdates } = updates;

    // Update task using server action
    const result = await updateTaskAction(taskId, allowedUpdates);

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
  } catch (error: any) {
    console.error('[API:TASKS:PATCH] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
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

    // Delete task using server action
    const result = await deleteTaskAction(taskId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete task' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API:TASKS:DELETE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
