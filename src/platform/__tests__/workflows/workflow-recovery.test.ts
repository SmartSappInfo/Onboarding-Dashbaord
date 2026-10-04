/**
 * @fileOverview Unit Tests for Crash Recovery & Zombie Workflow Reaper (Phase 7 Milestone 2)
 */

import { describe, it, expect } from 'vitest';
import { createMemoryWorkflowRecoveryService } from '@/platform/workflows/execution/workflow-recovery-service';
import { createMemoryWorkflowStore } from '@/platform/workflows/workflow-store';
import { createMemoryWorkflowLeaseManager } from '@/platform/workflows/execution/workflow-lease-manager';
import { createMemoryWorkflowDispatcher } from '@/platform/workflows/dispatcher/workflow-dispatcher';
import { createEventBus } from '@/platform/events/event-bus';
import type { StoredPrincipal } from '@/platform/tasks/agent-step-contract';

describe('Workflow Crash Recovery & Zombie Reaper', () => {
  const tenant = {
    organizationId: 'org_rec_1',
    workspaceId: 'ws_rec_1',
  };

  const samplePrincipal: StoredPrincipal = {
    actorType: 'agent',
    userId: 'usr_rec_1',
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    effectiveRole: 'admin',
    grantedScopes: ['rbac:operations.campuses.view'],
  };

  it('performs clean scan when no steps are zombies', async () => {
    const store = createMemoryWorkflowStore();
    const leaseManager = createMemoryWorkflowLeaseManager();
    const eventBus = createEventBus();
    const dispatcher = createMemoryWorkflowDispatcher({ store, eventBus });
    const recoveryService = createMemoryWorkflowRecoveryService({
      store,
      leaseManager,
      dispatcher,
      eventBus,
    });

    const instance = await store.createInstance({
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'wf_clean',
      title: 'Clean Workflow',
      initiator: { actorType: 'user', actorId: 'usr_rec_1' },
      principal: samplePrincipal,
    });

    await store.createStep({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      stepIndex: 0,
      capabilityId: 'some.cap',
      name: 'Active Step',
    });

    const result = await recoveryService.reapZombieSteps(tenant);
    expect(result.scannedSteps).toBe(1);
    expect(result.recoveredSteps).toHaveLength(0);
    expect(result.failedSteps).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('detects zombie step with expired lease, re-queues and dispatches recovery task', async () => {
    const store = createMemoryWorkflowStore();
    const leaseManager = createMemoryWorkflowLeaseManager();
    const eventBus = createEventBus();
    const dispatcher = createMemoryWorkflowDispatcher({ store, eventBus });
    const recoveryService = createMemoryWorkflowRecoveryService({
      store,
      leaseManager,
      dispatcher,
      eventBus,
    });

    const instance = await store.createInstance({
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'wf_zombie',
      title: 'Zombie Workflow',
      initiator: { actorType: 'user', actorId: 'usr_rec_1' },
      principal: samplePrincipal,
    });

    // Advance instance to RUNNING
    await store.updateInstanceStatus(instance.id, 'QUEUED', tenant);
    await store.updateInstanceStatus(instance.id, 'RUNNING', tenant);

    const step = await store.createStep({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      stepIndex: 0,
      capabilityId: 'some.cap',
      name: 'Zombie Step',
      maxAttempts: 3,
    });

    // Acquire lease and advance step to RUNNING
    const _lease = await leaseManager.acquireLease(instance.id, step.id, tenant, 'crashed_worker', 10);
    await store.updateStep(instance.id, step.id, {
      status: 'RUNNING',
      attempt: 1,
    }, tenant);

    // Wait for lease to expire
    await new Promise((resolve) => setTimeout(resolve, 25));

    const result = await recoveryService.reapZombieSteps(tenant);
    expect(result.scannedSteps).toBe(1);
    expect(result.recoveredSteps).toContain(step.id);
    expect(result.failedSteps).toHaveLength(0);

    // Step should now be in QUEUED status
    const recoveredStep = await store.getStep(instance.id, step.id, tenant);
    expect(recoveredStep?.status).toBe('QUEUED');
    expect(recoveredStep?.error?.code).toBe('LEASE_EXPIRED');

    // Recovery task should be enqueued in dispatcher
    const enqueued = dispatcher.getEnqueuedTasksForTests?.();
    expect(enqueued).toHaveLength(1);
    expect(enqueued?.[0].payload.stepId).toBe(step.id);
  });

  it('fails zombie step and workflow when max attempts are exhausted', async () => {
    const store = createMemoryWorkflowStore();
    const leaseManager = createMemoryWorkflowLeaseManager();
    const eventBus = createEventBus();
    const dispatcher = createMemoryWorkflowDispatcher({ store, eventBus });
    const recoveryService = createMemoryWorkflowRecoveryService({
      store,
      leaseManager,
      dispatcher,
      eventBus,
    });

    const instance = await store.createInstance({
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'wf_exhausted',
      title: 'Exhausted Workflow',
      initiator: { actorType: 'user', actorId: 'usr_rec_1' },
      principal: samplePrincipal,
    });

    await store.updateInstanceStatus(instance.id, 'QUEUED', tenant);
    await store.updateInstanceStatus(instance.id, 'RUNNING', tenant);

    const step = await store.createStep({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      stepIndex: 0,
      capabilityId: 'some.cap',
      name: 'Exhausted Step',
      maxAttempts: 2,
    });

    // Acquire lease with step already at attempt 2 (max attempts)
    await leaseManager.acquireLease(instance.id, step.id, tenant, 'crashed_worker', 10);
    await store.updateStep(instance.id, step.id, {
      status: 'RUNNING',
      attempt: 2,
    }, tenant);

    // Wait for lease to expire
    await new Promise((resolve) => setTimeout(resolve, 25));

    const result = await recoveryService.reapZombieSteps(tenant);
    expect(result.scannedSteps).toBe(1);
    expect(result.recoveredSteps).toHaveLength(0);
    expect(result.failedSteps).toContain(step.id);

    // Step should be FAILED
    const failedStep = await store.getStep(instance.id, step.id, tenant);
    expect(failedStep?.status).toBe('FAILED');

    // Instance should be FAILED
    const failedInstance = await store.getInstance(instance.id, tenant);
    expect(failedInstance?.status).toBe('FAILED');
  });
});
