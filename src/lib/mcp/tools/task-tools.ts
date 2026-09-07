/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Governed Task MCP Tools
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Tasks:
 *    - Uses `createTaskAction` in `src/lib/task-server-actions.ts` for task creation.
 * 2. Risk Tier:
 *    - `task.list`: read_only (Zero mutation).
 *    - `task.create`: low_risk (Reversible operational task creation).
 * 3. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - Uses Zod schemas and recursive `McpPayloadValue`.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import { z } from 'zod';
import { McpToolDefinition } from '../types';
import { adminDb } from '@/lib/firebase-admin';
import { createTaskAction } from '@/lib/task-server-actions';
import type { TaskPriority, TaskStatus } from '@/lib/types';

// ==========================================
// 1. task.list (Read-Only)
// ==========================================

const listTasksInputSchema = z.object({
  entityId: z.string().optional().describe('Filter tasks linked to a specific CRM entity.'),
  status: z.enum(['todo', 'in_progress', 'completed', 'blocked']).optional().describe('Filter tasks by status.'),
  limit: z.number().int().min(1).max(50).optional().describe('Maximum tasks to return (default 10).'),
});

const listTasksOutputSchema = z.object({
  totalFound: z.number(),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      status: z.string(),
      priority: z.string(),
      dueDate: z.string().nullable(),
      entityId: z.string().nullable(),
    })
  ),
});

export const taskListTool: McpToolDefinition<
  z.infer<typeof listTasksInputSchema>,
  z.infer<typeof listTasksOutputSchema>
> = {
  name: 'task.list',
  version: '1.0.0',
  category: 'task',
  description: 'Lists operational tasks within the current workspace, optionally filtered by status or entity.',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: listTasksInputSchema,
  responseSchema: listTasksOutputSchema,
  handler: async (params, context) => {
    let queryRef: FirebaseFirestore.Query = adminDb
      .collection('tasks')
      .where('workspaceId', '==', context.workspaceId);

    if (params.entityId) {
      queryRef = queryRef.where('entityId', '==', params.entityId);
    }
    if (params.status) {
      queryRef = queryRef.where('status', '==', params.status);
    }

    const snapshot = await queryRef.limit(params.limit ?? 10).get();

    const tasks = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data?.title || 'Untitled Task',
        description: data?.description || '',
        status: data?.status || 'todo',
        priority: data?.priority || 'medium',
        dueDate: data?.dueDate || null,
        entityId: data?.entityId || null,
      };
    });

    return {
      totalFound: tasks.length,
      tasks,
    };
  },
};

// ==========================================
// 2. task.create (Low-Risk Mutation)
// ==========================================

const createTaskInputSchema = z.object({
  title: z.string().min(2).describe('Title of the task.'),
  description: z.string().optional().describe('Detailed description or instructions for the task.'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Task priority (default medium).'),
  dueDate: z.string().optional().describe('Due date in ISO format.'),
  entityId: z.string().optional().describe('CRM entity ID to link this task to.'),
});

const createTaskOutputSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

export const taskCreateTool: McpToolDefinition<
  z.infer<typeof createTaskInputSchema>,
  z.infer<typeof createTaskOutputSchema>
> = {
  name: 'task.create',
  version: '1.0.0',
  category: 'task',
  description: 'Creates a new operational task or action item linked to the workspace and optional entity.',
  riskLevel: 'low_risk',
  requiresApproval: false,
  parameters: createTaskInputSchema,
  responseSchema: createTaskOutputSchema,
  handler: async (params, context) => {
    const callerUserId = context.callerType === 'agent' ? `system-${context.callerId}` : context.callerId;

    const result = await createTaskAction(
      {
        workspaceId: context.workspaceId,
        organizationId: context.organizationId,
        title: params.title,
        description: params.description || '',
        priority: (params.priority as TaskPriority) || 'medium',
        dueDate: params.dueDate || new Date().toISOString(),
        entityId: params.entityId,
        status: 'todo' as TaskStatus,
        category: 'follow_up',
        assignedTo: callerUserId,
        reminders: [],
        reminderSent: false,
      },
      callerUserId
    );

    if (!result.success || !result.id) {
      throw new Error(result.error || 'Failed to create task via MCP.');
    }

    return {
      taskId: result.id,
      title: params.title,
      status: 'todo',
      createdAt: new Date().toISOString(),
    };
  },
};
