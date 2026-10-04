/**
 * @fileOverview Unit tests for Workflow Domain Event Publishers & Subscribers (Phase 7 Milestone 1)
 */

import { describe, it, expect } from 'vitest';
import {
  publishWorkflowEvent,
  subscribeToWorkflows,
} from '../../workflows/subscribers/workflow-event-subscribers';
import { createMemoryWorkflowStore } from '../../workflows/workflow-store';
import { createEventBus } from '../../events/event-bus';
import type { DomainEvent } from '@/platform/capabilities/events/domain-event';
import type { StoredPrincipal } from '../../tasks/agent-step-contract';

describe('Workflow Domain Events & Subscribers', () => {
  const principalA: StoredPrincipal = {
    actorType: 'agent',
    userId: 'user_001',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    grantedScopes: ['crm.read', 'crm.write'],
    effectiveRole: 'admin',
  };

  it('publishes workflow.created and workflow.state_changed events to EventBus', async () => {
    const memoryEventBus = createEventBus();
    const store = createMemoryWorkflowStore();

    const publishedEvents: DomainEvent[] = [];
    subscribeToWorkflows({
      eventBus: memoryEventBus,
      onEvent: (event) => {
        publishedEvents.push(event);
      },
    });

    const inst = await store.createInstance({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      definitionId: 'lead_onboarding',
      title: 'Workflow Event Test',
      initiator: { actorType: 'user', actorId: 'user_001' },
      principal: principalA,
      correlationId: 'corr_event_001',
      idempotencyKey: 'idem_event_001',
    });

    // Publish creation event
    await publishWorkflowEvent({
      eventType: 'workflow.created',
      instance: inst,
      eventBus: memoryEventBus,
    });

    // Advance status to QUEUED and publish state_changed
    const queued = await store.updateInstanceStatus(inst.id, 'QUEUED', {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
    });

    await publishWorkflowEvent({
      eventType: 'workflow.state_changed',
      instance: queued,
      previousState: 'CREATED',
      eventBus: memoryEventBus,
    });

    expect(publishedEvents.length).toBe(2);
    expect(publishedEvents[0].type).toBe('workflow.created');
    expect(publishedEvents[0].entity.id).toBe(inst.id);
    expect(publishedEvents[0].correlationId).toBe('corr_event_001');

    expect(publishedEvents[1].type).toBe('workflow.state_changed');
    expect(publishedEvents[1].payload.status).toBe('QUEUED');
    expect(publishedEvents[1].payload.previousState).toBe('CREATED');
  });

  it('publishes step completion events with step metadata', async () => {
    const memoryEventBus = createEventBus();
    const store = createMemoryWorkflowStore();

    const receivedEvents: DomainEvent[] = [];
    subscribeToWorkflows({
      eventBus: memoryEventBus,
      onEvent: (event) => {
        receivedEvents.push(event);
      },
    });

    const inst = await store.createInstance({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      definitionId: 'lead_onboarding',
      title: 'Step Event Test',
      initiator: { actorType: 'agent', actorId: 'agent_sdr' },
      principal: principalA,
      correlationId: 'corr_step_evt_001',
      idempotencyKey: 'idem_step_evt_001',
    });

    const step = await store.createStep({
      workflowId: inst.id,
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      stepIndex: 0,
      capabilityId: 'crm.enrich_contact',
      name: 'Enrich Contact',
    });

    const completedStep = await store.updateStep(
      inst.id,
      step.id,
      {
        status: 'COMPLETED',
        output: { score: 90 },
        durationMs: 120,
      },
      { organizationId: 'org_test', workspaceId: 'ws_test' }
    );

    await publishWorkflowEvent({
      eventType: 'workflow.step_completed',
      instance: inst,
      step: completedStep,
      eventBus: memoryEventBus,
    });

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].type).toBe('workflow.step_completed');
    expect(receivedEvents[0].payload.stepId).toBe(step.id);
    expect(receivedEvents[0].payload.stepStatus).toBe('COMPLETED');
    expect(receivedEvents[0].payload.capabilityId).toBe('crm.enrich_contact');
    expect(receivedEvents[0].payload.durationMs).toBe(120);
  });
});
