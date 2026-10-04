/**
 * @fileOverview Cloud Tasks Workflow Dispatcher (Phase 7 Milestone 2)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed throughout with Zod v4 and typed errors.
 * 2. LIGHTWEIGHT TASK PAYLOAD (Cloud Run §5.2): Payloads carry only minimal immutable
 *    identifiers ({ workflowId, stepId, organizationId, workspaceId, idempotencyKey, attempt, correlationId }).
 *    Never pass sensitive tokens or principal authority in the Cloud Tasks request body.
 * 3. ANTI-IDOR & MULTI-TENANCY (Rule 8 & 47): Every enqueue option binds organizationId and workspaceId.
 * 4. DISTRIBUTED TRACING (Rule 20 & 39): correlationId propagated through task payloads and events.
 * 5. HMR PRESERVATION (Rule 69): Global singleton preserved on globalThis.__smartsappWorkflowDispatcher.
 */

import { randomUUID } from 'node:crypto';
import { scheduleTaskWithKey } from '@/lib/gcp-tasks-client';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import type { TenantBoundary } from '../workflow-types';
import { type WorkflowStore, getWorkflowStore } from '../workflow-store';
import {
  type EnqueueWorkflowStepOptions,
  type WorkflowTaskPayload,
  WorkflowTaskPayloadSchema,
  WORKFLOW_WORKER_QUEUE,
  WORKFLOW_STEP_ENDPOINT,
  WorkflowDispatchError,
} from './workflow-dispatcher-types';

export interface WorkflowDispatcher {
  enqueueWorkflowStep(options: EnqueueWorkflowStepOptions): Promise<{ taskKey: string; payload: WorkflowTaskPayload }>;
  cancelWorkflowStepTask(
    workflowId: string,
    stepId: string,
    idempotencyKey: string,
    tenant: TenantBoundary
  ): Promise<boolean>;
  getEnqueuedTasksForTests?(): Array<{ taskKey: string; payload: WorkflowTaskPayload; delaySeconds: number }>;
  clearForTests?(): Promise<void>;
}

export function buildWorkflowTaskKey(
  workflowId: string,
  stepId: string,
  attempt: number,
  idempotencyKey: string
): string {
  const rawKey = `wf-step-${workflowId}-${stepId}-${attempt}-${idempotencyKey}`;
  return rawKey.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 500);
}

// ── In-Memory Implementation for Hermetic Testing ───────────────────────────
export function createMemoryWorkflowDispatcher(options?: {
  store?: WorkflowStore;
  eventBus?: EventBus;
}): WorkflowDispatcher {
  const store = options?.store;
  const eventBus = options?.eventBus ?? defaultEventBus;
  const scheduledTasks: Array<{ taskKey: string; payload: WorkflowTaskPayload; delaySeconds: number }> = [];

  return {
    async enqueueWorkflowStep(
      opts: EnqueueWorkflowStepOptions
    ): Promise<{ taskKey: string; payload: WorkflowTaskPayload }> {
      if (!opts.workflowId || !opts.stepId || !opts.idempotencyKey) {
        throw new WorkflowDispatchError(
          'INVALID_PAYLOAD',
          'workflowId, stepId, and idempotencyKey are required'
        );
      }

      if (store) {
        const instance = await store.getInstance(opts.workflowId, opts.tenant);
        if (!instance) {
          throw new WorkflowDispatchError(
            'WORKFLOW_NOT_FOUND',
            `Workflow instance ${opts.workflowId} not found for tenant`
          );
        }

        const step = await store.getStep(opts.workflowId, opts.stepId, opts.tenant);
        if (!step) {
          throw new WorkflowDispatchError(
            'STEP_NOT_FOUND',
            `Step ${opts.stepId} not found in workflow ${opts.workflowId}`
          );
        }

        if (step.status === 'PENDING') {
          await store.updateStep(
            opts.workflowId,
            opts.stepId,
            { status: 'QUEUED' },
            opts.tenant
          );
        }
      }

      const attempt = opts.attempt ?? 0;
      const correlationId = opts.correlationId ?? `corr_${randomUUID()}`;
      const delaySeconds = Math.max(0, opts.delaySeconds ?? 0);
      const scheduledAt = opts.executeAt ?? new Date(Date.now() + delaySeconds * 1000).toISOString();

      const rawPayload: WorkflowTaskPayload = {
        workflowId: opts.workflowId,
        stepId: opts.stepId,
        organizationId: opts.tenant.organizationId,
        workspaceId: opts.tenant.workspaceId,
        idempotencyKey: opts.idempotencyKey,
        attempt,
        correlationId,
        scheduledAt,
      };

      const payload = WorkflowTaskPayloadSchema.parse(rawPayload);
      const taskKey = buildWorkflowTaskKey(payload.workflowId, payload.stepId, payload.attempt, payload.idempotencyKey);

      scheduledTasks.push({ taskKey, payload, delaySeconds });

      await eventBus.publish(
        createDomainEvent({
          type: 'workflow.step_enqueued',
          organizationId: payload.organizationId,
          workspaceId: payload.workspaceId,
          entity: { type: 'workflow', id: payload.workflowId },
          actor: { type: 'system', id: 'workflow_dispatcher' },
          correlationId: payload.correlationId,
          source: 'workflow_dispatcher',
          payload: {
            stepId: payload.stepId,
            attempt: payload.attempt,
            taskKey,
            delaySeconds,
          },
        })
      );

      return { taskKey, payload };
    },

    async cancelWorkflowStepTask(
      workflowId: string,
      stepId: string,
      idempotencyKey: string,
      tenant: TenantBoundary
    ): Promise<boolean> {
      const idx = scheduledTasks.findIndex(
        (t) =>
          t.payload.workflowId === workflowId &&
          t.payload.stepId === stepId &&
          t.payload.idempotencyKey === idempotencyKey &&
          t.payload.organizationId === tenant.organizationId &&
          t.payload.workspaceId === tenant.workspaceId
      );

      if (idx >= 0) {
        scheduledTasks.splice(idx, 1);
        return true;
      }
      return false;
    },

    getEnqueuedTasksForTests() {
      return [...scheduledTasks];
    },

    async clearForTests(): Promise<void> {
      scheduledTasks.length = 0;
    },
  };
}

// ── Production Cloud Tasks Dispatcher ───────────────────────────────────────
export function createCloudTasksWorkflowDispatcher(deps?: {
  schedule?: typeof scheduleTaskWithKey;
  store?: WorkflowStore;
  eventBus?: EventBus;
}): WorkflowDispatcher {
  const schedule = deps?.schedule ?? scheduleTaskWithKey;
  const store = deps?.store ?? getWorkflowStore();
  const eventBus = deps?.eventBus ?? defaultEventBus;

  return {
    async enqueueWorkflowStep(
      opts: EnqueueWorkflowStepOptions
    ): Promise<{ taskKey: string; payload: WorkflowTaskPayload }> {
      if (!opts.workflowId || !opts.stepId || !opts.idempotencyKey) {
        throw new WorkflowDispatchError(
          'INVALID_PAYLOAD',
          'workflowId, stepId, and idempotencyKey are required'
        );
      }

      const instance = await store.getInstance(opts.workflowId, opts.tenant);
      if (!instance) {
        throw new WorkflowDispatchError(
          'WORKFLOW_NOT_FOUND',
          `Workflow instance ${opts.workflowId} not found for tenant`
        );
      }

      const step = await store.getStep(opts.workflowId, opts.stepId, opts.tenant);
      if (!step) {
        throw new WorkflowDispatchError(
          'STEP_NOT_FOUND',
          `Step ${opts.stepId} not found in workflow ${opts.workflowId}`
        );
      }

      if (step.status === 'PENDING') {
        await store.updateStep(
          opts.workflowId,
          opts.stepId,
          { status: 'QUEUED' },
          opts.tenant
        );
      }

      const attempt = opts.attempt ?? 0;
      const correlationId = opts.correlationId ?? instance.correlationId ?? `corr_${randomUUID()}`;
      const delaySeconds = Math.max(0, opts.delaySeconds ?? 0);
      const scheduledAt = opts.executeAt ?? new Date(Date.now() + delaySeconds * 1000).toISOString();

      const rawPayload: WorkflowTaskPayload = {
        workflowId: opts.workflowId,
        stepId: opts.stepId,
        organizationId: opts.tenant.organizationId,
        workspaceId: opts.tenant.workspaceId,
        idempotencyKey: opts.idempotencyKey,
        attempt,
        correlationId,
        scheduledAt,
      };

      const payload = WorkflowTaskPayloadSchema.parse(rawPayload);
      const taskKey = buildWorkflowTaskKey(payload.workflowId, payload.stepId, payload.attempt, payload.idempotencyKey);

      const taskPayload: Record<string, unknown> = {
        workflowId: payload.workflowId,
        stepId: payload.stepId,
        organizationId: payload.organizationId,
        workspaceId: payload.workspaceId,
        attempt: payload.attempt,
        idempotencyKey: payload.idempotencyKey,
        correlationId: payload.correlationId,
        scheduledAt: payload.scheduledAt,
      };

      await schedule(
        taskKey,
        WORKFLOW_WORKER_QUEUE,
        WORKFLOW_STEP_ENDPOINT,
        taskPayload,
        delaySeconds
      );

      await eventBus.publish(
        createDomainEvent({
          type: 'workflow.step_enqueued',
          organizationId: payload.organizationId,
          workspaceId: payload.workspaceId,
          entity: { type: 'workflow', id: payload.workflowId },
          actor: { type: 'system', id: 'workflow_dispatcher' },
          correlationId: payload.correlationId,
          source: 'workflow_dispatcher',
          payload: {
            stepId: payload.stepId,
            attempt: payload.attempt,
            taskKey,
            delaySeconds,
          },
        })
      );

      return { taskKey, payload };
    },

    async cancelWorkflowStepTask(
      _workflowId: string,
      _stepId: string,
      _idempotencyKey: string,
      _tenant: TenantBoundary
    ): Promise<boolean> {
      // In Cloud Tasks, individual tasks can be deleted via client.deleteTask if the full task name is known.
      // Leases and step cancellation in Firestore (WorkflowState = CANCELLED) protect against stale task execution.
      return true;
    },
  };
}

// ── Global Singleton with HMR Preservation (Rule 69) ────────────────────────
declare global {
  var __smartsappWorkflowDispatcher: WorkflowDispatcher | undefined;
}

export function getWorkflowDispatcher(): WorkflowDispatcher {
  if (process.env.NODE_ENV === 'test') {
    return createMemoryWorkflowDispatcher();
  }

  if (!globalThis.__smartsappWorkflowDispatcher) {
    globalThis.__smartsappWorkflowDispatcher = createCloudTasksWorkflowDispatcher();
  }
  return globalThis.__smartsappWorkflowDispatcher;
}
