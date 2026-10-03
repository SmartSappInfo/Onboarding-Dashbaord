/**
 * @fileOverview Agent Runtime Domain Event Publishers & Subscribers (Phase 6 Milestone 1)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 8 & 47: Multi-Tenant Boundary Isolation in event routing.
 * - Rule 10: Complete inline architectural documentation.
 * - Rule 20: Distributed tracing (`correlationId`, `causationId`).
 * - Rule 40: Audit Log Immutability by publishing structured domain events to UniversalEventBus.
 * - Rule 62: Feeding real-time SSE streaming for the operator UI.
 */

import { createDomainEvent, type DomainEvent } from '@/platform/capabilities/events/domain-event';
import { defaultEventBus, type EventBus, type EventPublishResult } from '@/platform/events/event-bus';
import type { AgentRun, AgentStep, AgentRunStatus } from '../agent-run-types';

export const AGENT_RUN_EVENT_TYPES = [
  'agent.run.created',
  'agent.run.state_changed',
  'agent.run.step_started',
  'agent.run.step_completed',
  'agent.run.completed',
  'agent.run.failed',
  'agent.run.cancelled',
  'agent.run.approval_required',
] as const;

export type AgentRunEventType = (typeof AGENT_RUN_EVENT_TYPES)[number];

export interface PublishAgentRunEventOptions {
  eventType: AgentRunEventType;
  run: AgentRun;
  step?: AgentStep;
  previousStatus?: AgentRunStatus;
  reason?: string;
  error?: { code: string; message: string };
  customPayload?: Record<string, unknown>;
  eventBus?: EventBus;
}

/**
 * Publishes a structured, tamper-evident domain event for agent run lifecycle transitions.
 */
export async function publishAgentRunEvent(
  options: PublishAgentRunEventOptions
): Promise<EventPublishResult> {
  const bus = options.eventBus || defaultEventBus;
  const { run, step, eventType } = options;

  const correlationId =
    step?.correlationId ||
    run.metadata?.correlationId ||
    `corr_${run.runId}`;

  const causationId = step?.stepId || run.runId;

  const payload: Record<string, unknown> = {
    runId: run.runId,
    workspaceId: run.workspaceId,
    agentPersonaId: run.agentPersonaId,
    status: run.status,
    triggerType: run.triggerType,
    goalIntent: run.goal.intent,
    currentStepIndex: run.currentStepIndex,
    tokensUsed: run.budgetUsage.tokensUsed,
    toolCallsExecuted: run.budgetUsage.toolCallsExecuted,
    durationMs: run.budgetUsage.durationMs,
    ...(options.previousStatus ? { previousStatus: options.previousStatus } : {}),
    ...(options.reason ? { reason: options.reason } : {}),
    ...(options.error ? { error: options.error } : {}),
    ...(step
      ? {
          stepId: step.stepId,
          stepIndex: step.stepIndex,
          stepType: step.type,
          stepTitle: step.title,
          stepStatus: step.status,
          capabilityId: step.capabilityId,
        }
      : {}),
    ...(options.customPayload || {}),
  };

  const domainEvent = createDomainEvent({
    type: eventType,
    organizationId: run.organizationId,
    workspaceId: run.workspaceId,
    actor: {
      type: 'agent',
      id: run.principalId,
      agentVersion: '1.0.0',
    },
    entity: {
      type: 'agent_run',
      id: run.runId,
    },
    correlationId,
    causationId,
    source: 'agent-runtime',
    payload,
    idempotencyKey: step?.idempotencyKey || `${run.runId}_${run.status}_${run.stateHistory.length}`,
  });

  return bus.publish(domainEvent);
}

/**
 * Subscribes to agent run domain events with optional tenant scoping.
 */
export function subscribeToAgentRuns(options: {
  organizationId?: string;
  workspaceId?: string;
  name?: string;
  onEvent: (event: DomainEvent) => Promise<void> | void;
  eventBus?: EventBus;
}) {
  const bus = options.eventBus || defaultEventBus;
  return bus.subscribe('agent.run.*', options.onEvent, {
    organizationId: options.organizationId,
    workspaceId: options.workspaceId,
    name: options.name || 'agent_run_listener',
  });
}
