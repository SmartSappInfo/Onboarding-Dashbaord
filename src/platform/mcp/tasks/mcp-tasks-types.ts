/**
 * @fileOverview Canonical Contracts & Zod v4 Schemas for MCP Tasks Protocol Extension (Spec 2026-07-28)
 *
 * Implements the official MCP Tasks draft specification over Streamable HTTP:
 *   - tasks/create: instantiate a durable workflow task
 *   - tasks/get: retrieve task state, progress, and wait conditions
 *   - tasks/list: paged multi-tenant query for tasks
 *   - tasks/cancel: initiate cooperative cancellation and Saga rollbacks
 *   - tasks/result: retrieve final outputs or sanitized failure reasons
 *
 * ARCHITECTURAL INVARIANTS:
 * - Rule 4: Zero `any` or `any[]` typing policy across all schemas and types.
 * - Rule 8 & 47: Multi-tenant Anti-IDOR perimeter scoping.
 * - Rule 9: Cloud Run 32MB payload ceiling & resource bounding.
 * - Rule 11 & 38: MCP Spec 2026-07-28 Streamable HTTP statelessness (no legacy sessions).
 * - Rule 26 & 27: Cooperative cancellation and Saga compensation.
 * - Rule 60: Emergency Dead-Man Switch evaluation.
 */

import { z } from 'zod/v4';
import type { WorkflowState } from '@/platform/workflows/workflow-types';

// ── 1. Task Status Definition & State Mapping (Spec 2026-07-28) ───────────────
export const TASK_STATUSES = [
  'working',
  'suspended',
  'completed',
  'failed',
  'cancelled',
] as const;

export const TaskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Maps SmartSapp internal WorkflowState machine states into MCP TaskStatus.
 */
export function mapWorkflowStateToTaskStatus(state: WorkflowState): TaskStatus {
  switch (state) {
    case 'CREATED':
    case 'QUEUED':
    case 'RUNNING':
    case 'RESUMED':
    case 'VERIFYING':
      return 'working';
    case 'WAITING':
      return 'suspended';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
    case 'TIMED_OUT':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'working';
  }
}

// ── 2. Error Taxonomy & Typed McpTasksError ─────────────────────────────────
export const MCP_TASKS_ERROR_CODES = {
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  INVALID_TASK_STATE: 'INVALID_TASK_STATE',
  TASK_ALREADY_CANCELLED: 'TASK_ALREADY_CANCELLED',
  TASK_CREATION_FAILED: 'TASK_CREATION_FAILED',
  DEAD_MAN_PAUSED: 'DEAD_MAN_PAUSED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type McpTasksErrorCode =
  (typeof MCP_TASKS_ERROR_CODES)[keyof typeof MCP_TASKS_ERROR_CODES];

export class McpTasksError extends Error {
  readonly code: McpTasksErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: McpTasksErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'McpTasksError';
    this.code = code;
    this.details = details;
  }
}

// ── 3. tasks/create Schemas ─────────────────────────────────────────────────
export const TaskCreateInputSchema = z.object({
  name: z.string().trim().min(1, 'Task name is required'),
  definitionId: z.string().trim().min(1, 'Workflow definition ID is required'),
  inputs: z.record(z.string(), z.unknown()).default({}),
  parentTaskId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

export type TaskCreateInput = z.input<typeof TaskCreateInputSchema>;
export type TaskCreateOutput = z.output<typeof TaskCreateInputSchema>;

export const TaskCreateResultSchema = z.object({
  taskId: z.string().min(1),
  name: z.string(),
  status: TaskStatusSchema,
  createdAt: z.string(),
  definitionId: z.string(),
});

export type TaskCreateResult = z.infer<typeof TaskCreateResultSchema>;

// ── 4. tasks/get Schemas ────────────────────────────────────────────────────
export const TaskGetInputSchema = z.object({
  taskId: z.string().trim().min(1, 'Task ID is required'),
});

export type TaskGetInput = z.input<typeof TaskGetInputSchema>;

export const TaskGetResultSchema = z.object({
  taskId: z.string(),
  name: z.string(),
  status: TaskStatusSchema,
  progress: z.number().min(0).max(100),
  currentStepId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  waitCondition: z
    .object({
      type: z.enum(['approval', 'webhook', 'schedule', 'dependency']),
      expiresAt: z.string().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export type TaskGetResult = z.infer<typeof TaskGetResultSchema>;

// ── 5. tasks/list Schemas ───────────────────────────────────────────────────
export const TaskListInputSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(20)
    .transform((val) => {
      if (val < 1) return 1;
      if (val > 100) return 100;
      return val;
    }),
  status: TaskStatusSchema.optional(),
  definitionId: z.string().optional(),
});

export type TaskListInput = z.input<typeof TaskListInputSchema>;
export type TaskListOutput = z.output<typeof TaskListInputSchema>;

export const TaskListResultSchema = z.object({
  tasks: z.array(TaskGetResultSchema),
  total: z.number().int().nonnegative(),
});

export type TaskListResult = z.infer<typeof TaskListResultSchema>;

// ── 6. tasks/cancel Schemas ─────────────────────────────────────────────────
export const TaskCancelInputSchema = z.object({
  taskId: z.string().trim().min(1, 'Task ID is required'),
  reason: z.string().optional(),
});

export type TaskCancelInput = z.input<typeof TaskCancelInputSchema>;

export const TaskCancelResultSchema = z.object({
  taskId: z.string(),
  status: z.literal('cancelled'),
  cancelledAt: z.string(),
  reason: z.string().optional(),
});

export type TaskCancelResult = z.infer<typeof TaskCancelResultSchema>;

// ── 7. tasks/result Schemas ─────────────────────────────────────────────────
export const TaskResultInputSchema = z.object({
  taskId: z.string().trim().min(1, 'Task ID is required'),
});

export type TaskResultInput = z.infer<typeof TaskResultInputSchema>;

export const TaskResultResponseSchema = z.object({
  taskId: z.string(),
  status: TaskStatusSchema,
  output: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type TaskResultResponse = z.infer<typeof TaskResultResponseSchema>;
