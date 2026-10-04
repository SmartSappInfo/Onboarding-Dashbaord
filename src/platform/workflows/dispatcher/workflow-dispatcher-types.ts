/**
 * @fileOverview Canonical Dispatcher Contracts, Schemas & Error Taxonomy (Phase 7 Milestone 2)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): All schemas strictly typed via Zod v4.
 * 2. LIGHTWEIGHT TASK PAYLOAD (Cloud Run §5.2): Payloads carry only minimal immutable
 *    identifiers ({ workflowId, stepId, organizationId, workspaceId, idempotencyKey, attempt, correlationId }).
 *    Never pass sensitive tokens or principal authority in the Cloud Tasks request body.
 * 3. ANTI-IDOR & MULTI-TENANCY (Rule 8 & 47): Every enqueue option binds organizationId and workspaceId.
 * 4. DISTRIBUTED TRACING (Rule 20): correlationId propagated through task payloads and events.
 * 5. SAFE QUEUE DISPATCH (Rule 9 & 33): Targets workflow-worker-queue and /api/tasks/workflow-step.
 */

import { z } from 'zod/v4';
import type { TenantBoundary } from '../workflow-types';

export const WORKFLOW_WORKER_QUEUE = 'workflow-worker-queue';
export const WORKFLOW_STEP_ENDPOINT = '/api/tasks/workflow-step';

// ── 1. Workflow Task Payload Schema (Cloud Tasks Body) ──────────────────────
export const WorkflowTaskPayloadSchema = z.object({
  workflowId: z.string().min(1),
  stepId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  attempt: z.number().int().nonnegative().default(0),
  correlationId: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
});
export type WorkflowTaskPayload = z.infer<typeof WorkflowTaskPayloadSchema>;

// ── 2. Enqueue Options ──────────────────────────────────────────────────────
export interface EnqueueWorkflowStepOptions {
  workflowId: string;
  stepId: string;
  tenant: TenantBoundary;
  idempotencyKey: string;
  attempt?: number;
  correlationId?: string;
  delaySeconds?: number;
  executeAt?: string;
}

// ── 3. Error Taxonomy ───────────────────────────────────────────────────────
export const DISPATCH_ERROR_CODES = [
  'DISPATCH_FAILED',
  'QUEUE_UNAVAILABLE',
  'INVALID_PAYLOAD',
  'TENANT_MISMATCH',
  'TASK_TOO_LARGE',
  'WORKFLOW_NOT_FOUND',
  'STEP_NOT_FOUND',
  'IDEMPOTENCY_KEY_CONFLICT',
] as const;

export type DispatchErrorCode = (typeof DISPATCH_ERROR_CODES)[number];

export class WorkflowDispatchError extends Error {
  constructor(
    public readonly code: DispatchErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WorkflowDispatchError';
  }
}

// ── 4. Cloud Tasks Workflow Dispatcher Contract ────────────────────────────
export interface CloudTasksWorkflowDispatcher {
  enqueueWorkflowStep(params: {
    workflowId: string;
    stepId: string;
    stepIndex?: number;
    attempt?: number;
    delaySeconds?: number;
    tenant: TenantBoundary;
    correlationId?: string;
  }): Promise<{
    taskId: string;
    queue: string;
    scheduledAt: string;
  }>;
  cancelWorkflowStepTask(
    workflowId: string,
    stepId: string,
    idempotencyKey?: string,
    tenant?: TenantBoundary
  ): Promise<boolean>;
  getQueueMetrics?(): Promise<{
    queueName: string;
    tasksCount: number;
    oldestTaskAgeSeconds: number;
    healthy: boolean;
  }>;
}

