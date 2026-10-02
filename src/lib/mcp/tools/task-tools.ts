/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Governed Task MCP Tools
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Tasks:
 *    - Uses `createTaskCore` in `src/lib/tasks/task-core.ts` for task creation.
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
import { registerCapability } from '@/platform/capabilities/registry/capability-registry';
import {
  taskCreateCapability,
} from '@/platform/domains/tasks_productivity/contracts/task-create.contract';
import {
  taskSearchCapability,
} from '@/platform/domains/tasks_productivity/contracts/task-search.contract';

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
    const callerUserId = context.callerType === 'agent' ? `system-${context.callerId}` : context.callerId;
    const result = await taskSearchCapability.handler(
      {
        workspaceId: context.workspaceId,
        entityId: params.entityId,
        status: params.status,
        limit: params.limit,
      },
      {
        principal: {
          actorType: context.callerType === 'agent' ? 'agent' : 'user',
          userId: callerUserId,
          agentId: context.callerType === 'agent' ? context.callerId : undefined,
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          grantedScopes: ['operations:tasks:view', 'app:tasks_view', 'tasks:read'],
          effectiveRole: 'mcp_caller',
        },
        correlationId: context.requestId,
        timestamp: context.timestamp,
      }
    );

    if (!result.success) {
      throw new Error(result.error.message || 'Failed to list tasks via MCP.');
    }

    return result.data;
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
    const result = await taskCreateCapability.handler(
      {
        workspaceId: context.workspaceId,
        title: params.title,
        description: params.description,
        priority: params.priority,
        dueDate: params.dueDate,
        entityId: params.entityId,
      },
      {
        principal: {
          actorType: context.callerType === 'agent' ? 'agent' : 'user',
          userId: callerUserId,
          agentId: context.callerType === 'agent' ? context.callerId : undefined,
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          grantedScopes: ['operations:tasks:create', 'app:tasks_create', 'tasks:create'],
          effectiveRole: 'mcp_caller',
        },
        correlationId: context.requestId,
        timestamp: context.timestamp,
      }
    );

    if (!result.success) {
      throw new Error(result.error.message || 'Failed to create task via MCP.');
    }

    return result.data;
  },
};

// In-place upgrade of canonical capability definitions into unified registry (Decision D1 / Rule 69)
registerCapability(taskCreateCapability, { allowOverride: true });
registerCapability(taskSearchCapability, { allowOverride: true });
