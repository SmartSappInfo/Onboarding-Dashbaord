/**
 * @fileOverview Unit Tests for Cloud Tasks Workflow Dispatcher (Phase 7 Milestone 2)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createMemoryWorkflowDispatcher,
  createCloudTasksWorkflowDispatcher,
  buildWorkflowTaskKey,
} from '@/platform/workflows/dispatcher/workflow-dispatcher';
import { createMemoryWorkflowStore } from '@/platform/workflows/workflow-store';
import { createEventBus } from '@/platform/events/event-bus';
import { WorkflowDispatchError } from '@/platform/workflows/dispatcher/workflow-dispatcher-types';
import type { StoredPrincipal } from '@/platform/tasks/agent-step-contract';

describe('Workflow Dispatcher', () => {
  const tenant = {
    organizationId: 'org_disp_1',
    workspaceId: 'ws_disp_1',
  };
  const otherTenant = {
    organizationId: 'org_disp_2',
    workspaceId: 'ws_disp_2',
  };

  const samplePrincipal: StoredPrincipal = {
    actorType: 'agent',
    userId: 'usr_1',
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    effectiveRole: 'admin',
    grantedScopes: ['crm:read'],
  };

  it('builds a deterministic sanitized task key', () => {
    const key = buildWorkflowTaskKey('wf_abc', 'step_1', 0, 'idem_xyz');
    expect(key).toBe('wf-step-wf_abc-step_1-0-idem_xyz');
  });

  it('enqueues immediate workflow step successfully in memory dispatcher', async () => {
    const eventBus = createEventBus();
    const store = createMemoryWorkflowStore();
    const dispatcher = createMemoryWorkflowDispatcher({ store, eventBus });

    const instance = await store.createInstance({
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'wf_def_1',
      title: 'Test Workflow',
      initiator: { actorType: 'user', actorId: 'usr_1' },
      principal: samplePrincipal,
    });

    const step = await store.createStep({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      stepIndex: 0,
      capabilityId: 'crm.contact.read',
      name: 'Read Contact',
    });

    const enqueuedEventPromise = new Promise<{ stepId: string; attempt: number }>((resolve) => {
      eventBus.subscribe('workflow.step_enqueued', (ev) => {
        resolve(ev.payload as { stepId: string; attempt: number });
      });
    });

    const result = await dispatcher.enqueueWorkflowStep({
      workflowId: instance.id,
      stepId: step.id,
      tenant,
      idempotencyKey: 'idem_step_0',
    });

    expect(result.taskKey).toBe(`wf-step-${instance.id}-${step.id}-0-idem_step_0`);
    expect(result.payload.workflowId).toBe(instance.id);
    expect(result.payload.stepId).toBe(step.id);
    expect(result.payload.organizationId).toBe(tenant.organizationId);

    const event = await enqueuedEventPromise;
    expect(event.stepId).toBe(step.id);
    expect(event.attempt).toBe(0);

    // Step should now be in QUEUED status
    const updatedStep = await store.getStep(instance.id, step.id, tenant);
    expect(updatedStep?.status).toBe('QUEUED');
  });

  it('enqueues delayed step with delaySeconds', async () => {
    const dispatcher = createMemoryWorkflowDispatcher();

    const result = await dispatcher.enqueueWorkflowStep({
      workflowId: 'wf_123',
      stepId: 'step_2',
      tenant,
      idempotencyKey: 'idem_step_2',
      delaySeconds: 60,
      attempt: 1,
    });

    expect(result.payload.attempt).toBe(1);
    const enqueued = dispatcher.getEnqueuedTasksForTests?.();
    expect(enqueued).toHaveLength(1);
    expect(enqueued?.[0].delaySeconds).toBe(60);
  });

  it('rejects dispatch when workflow is not found in store', async () => {
    const store = createMemoryWorkflowStore();
    const dispatcher = createMemoryWorkflowDispatcher({ store });

    await expect(
      dispatcher.enqueueWorkflowStep({
        workflowId: 'non_existent_wf',
        stepId: 'step_1',
        tenant,
        idempotencyKey: 'idem_test',
      })
    ).rejects.toThrow(WorkflowDispatchError);
  });

  it('rejects dispatch across tenant boundaries', async () => {
    const store = createMemoryWorkflowStore();
    const dispatcher = createMemoryWorkflowDispatcher({ store });

    const instance = await store.createInstance({
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'wf_def_1',
      title: 'Test Workflow',
      initiator: { actorType: 'user', actorId: 'usr_1' },
      principal: samplePrincipal,
    });

    const step = await store.createStep({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      stepIndex: 0,
      capabilityId: 'crm.contact.read',
      name: 'Read Contact',
    });

    await expect(
      dispatcher.enqueueWorkflowStep({
        workflowId: instance.id,
        stepId: step.id,
        tenant: otherTenant, // Wrong tenant
        idempotencyKey: 'idem_test',
      })
    ).rejects.toThrow();
  });

  it('invokes scheduleTaskWithKey in Cloud Tasks dispatcher adapter', async () => {
    const store = createMemoryWorkflowStore();
    const mockSchedule = vi.fn().mockResolvedValue('task_key_123');

    const instance = await store.createInstance({
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'wf_def_1',
      title: 'Test Workflow',
      initiator: { actorType: 'user', actorId: 'usr_1' },
      principal: samplePrincipal,
    });

    const step = await store.createStep({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      stepIndex: 0,
      capabilityId: 'crm.contact.read',
      name: 'Read Contact',
    });

    const dispatcher = createCloudTasksWorkflowDispatcher({
      schedule: mockSchedule,
      store,
    });

    const result = await dispatcher.enqueueWorkflowStep({
      workflowId: instance.id,
      stepId: step.id,
      tenant,
      idempotencyKey: 'idem_cloud_task',
      delaySeconds: 15,
    });

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledWith(
      result.taskKey,
      'workflow-worker-queue',
      '/api/tasks/workflow-step',
      result.payload,
      15
    );
  });
});
