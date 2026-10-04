/**
 * @fileOverview Unit Tests for Distributed Workflow Lease Manager (Phase 7 Milestone 2)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMemoryWorkflowLeaseManager,
  type WorkflowLeaseManager,
} from '@/platform/workflows/execution/workflow-lease-manager';
import { WorkflowLeaseError } from '@/platform/workflows/execution/workflow-execution-types';

describe('Distributed Workflow Lease Manager', () => {
  let leaseManager: WorkflowLeaseManager;
  const tenant = {
    organizationId: 'org_test_1',
    workspaceId: 'ws_test_1',
  };
  const otherTenant = {
    organizationId: 'org_test_2',
    workspaceId: 'ws_test_2',
  };

  beforeEach(async () => {
    leaseManager = createMemoryWorkflowLeaseManager();
    if (leaseManager.clearForTests) {
      await leaseManager.clearForTests();
    }
  });

  it('acquires and releases a lease successfully', async () => {
    const lease = await leaseManager.acquireLease(
      'wf_123',
      'step_1',
      tenant,
      'worker_alpha',
      30_000
    );

    expect(lease.workflowId).toBe('wf_123');
    expect(lease.stepId).toBe('step_1');
    expect(lease.workerId).toBe('worker_alpha');
    expect(lease.organizationId).toBe(tenant.organizationId);
    expect(lease.workspaceId).toBe(tenant.workspaceId);
    expect(lease.leaseVersion).toBe(1);

    const fetched = await leaseManager.getLease('wf_123', 'step_1', tenant);
    expect(fetched).not.toBeNull();
    expect(fetched?.workerId).toBe('worker_alpha');

    await leaseManager.releaseLease('wf_123', 'step_1', tenant, 'worker_alpha');
    const afterRelease = await leaseManager.getLease('wf_123', 'step_1', tenant);
    expect(afterRelease).toBeNull();
  });

  it('rejects concurrent acquisition while active lease is held by another worker', async () => {
    await leaseManager.acquireLease(
      'wf_123',
      'step_1',
      tenant,
      'worker_alpha',
      60_000
    );

    await expect(
      leaseManager.acquireLease(
        'wf_123',
        'step_1',
        tenant,
        'worker_beta',
        60_000
      )
    ).rejects.toThrow(WorkflowLeaseError);

    try {
      await leaseManager.acquireLease(
        'wf_123',
        'step_1',
        tenant,
        'worker_beta',
        60_000
      );
    } catch (err) {
      expect(err).toBeInstanceOf(WorkflowLeaseError);
      expect((err as WorkflowLeaseError).code).toBe('LEASE_ALREADY_ACQUIRED');
    }
  });

  it('renews an active lease successfully (heartbeat extension)', async () => {
    const initialLease = await leaseManager.acquireLease(
      'wf_123',
      'step_1',
      tenant,
      'worker_alpha',
      10_000
    );

    const renewed = await leaseManager.renewLease(
      'wf_123',
      'step_1',
      tenant,
      'worker_alpha',
      20_000
    );

    expect(renewed.workerId).toBe('worker_alpha');
    expect(renewed.leaseVersion).toBe(initialLease.leaseVersion + 1);
    expect(new Date(renewed.leaseExpiresAt).getTime()).toBeGreaterThan(
      new Date(initialLease.leaseExpiresAt).getTime()
    );
  });

  it('rejects renewal from a different worker', async () => {
    await leaseManager.acquireLease(
      'wf_123',
      'step_1',
      tenant,
      'worker_alpha',
      10_000
    );

    await expect(
      leaseManager.renewLease(
        'wf_123',
        'step_1',
        tenant,
        'worker_beta',
        10_000
      )
    ).rejects.toThrow(WorkflowLeaseError);
  });

  it('allows lease acquisition when existing lease has expired', async () => {
    // Acquire with short TTL (10ms)
    await leaseManager.acquireLease(
      'wf_123',
      'step_1',
      tenant,
      'worker_alpha',
      10
    );

    // Wait for lease to expire
    await new Promise((resolve) => setTimeout(resolve, 25));

    // worker_beta can now acquire the expired lease
    const newLease = await leaseManager.acquireLease(
      'wf_123',
      'step_1',
      tenant,
      'worker_beta',
      30_000
    );

    expect(newLease.workerId).toBe('worker_beta');
    expect(newLease.leaseVersion).toBe(2);
  });

  it('enforces strict multi-tenant boundary checks', async () => {
    await leaseManager.acquireLease(
      'wf_123',
      'step_1',
      tenant,
      'worker_alpha',
      30_000
    );

    await expect(
      leaseManager.getLease('wf_123', 'step_1', otherTenant)
    ).rejects.toThrow(WorkflowLeaseError);

    await expect(
      leaseManager.renewLease('wf_123', 'step_1', otherTenant, 'worker_alpha', 30_000)
    ).rejects.toThrow(WorkflowLeaseError);

    await expect(
      leaseManager.releaseLease('wf_123', 'step_1', otherTenant, 'worker_alpha')
    ).rejects.toThrow(WorkflowLeaseError);
  });

  it('prevents another worker from releasing an active lease held by worker_alpha', async () => {
    await leaseManager.acquireLease(
      'wf_123',
      'step_1',
      tenant,
      'worker_alpha',
      30_000
    );

    await expect(
      leaseManager.releaseLease('wf_123', 'step_1', tenant, 'worker_beta')
    ).rejects.toThrow(WorkflowLeaseError);
  });
});
