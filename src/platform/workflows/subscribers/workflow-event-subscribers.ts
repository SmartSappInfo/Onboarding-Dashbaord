/**
 * @fileOverview Workflow Domain Event Publishers & Subscribers (Phase 7 Milestone 1)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed interfaces for event options and payloads.
 * 2. TENANT ISOLATION (Rule 8 & 47): Domain events carry explicit organizationId and workspaceId.
 * 3. DISTRIBUTED TRACING (Rule 20): Propagates correlationId and causationId across all events.
 * 4. AUDIT TRAIL IMMUTABILITY (Rule 40): Emits tamper-evident domain events through UniversalEventBus.
 * 5. SSE REACTIVITY (Rule 62): Workflow events feed live Server-Sent Events streams for operator UI.
 */

import { createDomainEvent, type DomainEvent } from '@/platform/capabilities/events/domain-event';
import { defaultEventBus, type EventBus, type EventPublishResult } from '@/platform/events/event-bus';
import type { WorkflowInstance, WorkflowStep, WorkflowState } from '../workflow-types';

export const WORKFLOW_EVENT_TYPES = [
  'workflow.created',
  'workflow.state_changed',
  'workflow.step_started',
  'workflow.step_completed',
  'workflow.completed',
  'workflow.failed',
  'workflow.cancelled',
  'workflow.timed_out',
  'workflow.dlq_routed',
] as const;

export type WorkflowEventType = (typeof WORKFLOW_EVENT_TYPES)[number];

export interface PublishWorkflowEventOptions {
  eventType: WorkflowEventType;
  instance: WorkflowInstance;
  step?: WorkflowStep;
  previousState?: WorkflowState;
  reason?: string;
  error?: { code: string; message: string; details?: unknown };
  customPayload?: Record<string, unknown>;
  eventBus?: EventBus;
}

/**
 * Publishes a structured domain event for workflow lifecycle transitions.
 */
export async function publishWorkflowEvent(
  options: PublishWorkflowEventOptions
): Promise<EventPublishResult> {
  const bus = options.eventBus || defaultEventBus;
  const { instance, step, eventType } = options;

  const correlationId =
    options.instance.correlationId ||
    `corr_${instance.id}`;

  const causationId = step?.id || instance.currentStepId || instance.id;

  const payload: Record<string, unknown> = {
    workflowId: instance.id,
    definitionId: instance.definitionId,
    title: instance.title,
    status: instance.status,
    currentStepId: instance.currentStepId,
    stepCounts: instance.stepCounts,
    ...(options.previousState ? { previousState: options.previousState } : {}),
    ...(options.reason ? { reason: options.reason } : {}),
    ...(options.error ? { error: options.error } : {}),
    ...(step
      ? {
          stepId: step.id,
          stepIndex: step.stepIndex,
          stepName: step.name,
          stepStatus: step.status,
          capabilityId: step.capabilityId,
          durationMs: step.durationMs,
          attempt: step.attempt,
          isMutating: step.isMutating,
          compensationStatus: step.compensationStatus,
        }
      : {}),
    ...(options.customPayload || {}),
  };

  const domainEvent = createDomainEvent({
    type: eventType,
    organizationId: instance.organizationId,
    workspaceId: instance.workspaceId,
    actor: {
      type: instance.initiator.actorType === 'user' ? 'user' : 'agent',
      id: instance.initiator.actorId,
    },
    entity: {
      type: 'workflow',
      id: instance.id,
    },
    correlationId,
    causationId,
    source: 'workflow-engine',
    payload,
    idempotencyKey: step?.idempotencyKey || `${instance.id}_${instance.status}_${Date.now()}`,
  });

  return bus.publish(domainEvent);
}

export interface SubscribeWorkflowOptions {
  organizationId?: string;
  workspaceId?: string;
  name?: string;
  onEvent: (event: DomainEvent) => Promise<void> | void;
  eventBus?: EventBus;
}

/**
 * Subscribes to workflow domain events with optional tenant scoping.
 */
export function subscribeToWorkflows(options: SubscribeWorkflowOptions) {
  const bus = options.eventBus || defaultEventBus;
  return bus.subscribe('workflow.*', options.onEvent, {
    organizationId: options.organizationId,
    workspaceId: options.workspaceId,
    name: options.name || 'workflow_event_listener',
  });
}
