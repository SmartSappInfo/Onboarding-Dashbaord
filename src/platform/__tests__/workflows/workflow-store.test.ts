/**
 * @fileOverview Unit tests for Multi-Tenant Workflow Checkpoint Store (Phase 7 Milestone 1)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryWorkflowStore, type WorkflowStore } from '../../workflows/workflow-store';
import { WorkflowError } from '../../workflows/workflow-types';
import type { StoredPrincipal } from '../../tasks/agent-step-contract';

describe('WorkflowStore (In-Memory Adapter)', () => {
  let store: WorkflowStore;

  const tenantA = {
    organizationId: 'org_alpha',
    workspaceId: 'ws_alpha',
  };

  const tenantB = {
    organizationId: 'org_beta',
    workspaceId: 'ws_beta',
  };

  const principalA: StoredPrincipal = {
    actorType: 'agent',
    userId: 'user_001',
    organizationId: 'org_alpha',
    workspaceId: 'ws_alpha',
    grantedScopes: ['crm.read', 'crm.write'],
    effectiveRole: 'admin',
  };

  beforeEach(() => {
    store = createMemoryWorkflowStore();
  });

  describe('Instance Management & Anti-IDOR', () => {
    it('creates and retrieves a workflow instance', async () => {
      const created = await store.createInstance({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        definitionId: 'lead_onboarding',
        title: 'Lead Onboarding #1',
        initiator: { actorType: 'user', actorId: 'user_001' },
        principal: principalA,
        idempotencyKey: 'idem_create_001',
        correlationId: 'corr_001',
      });

      expect(created.id).toMatch(/^wf_/);
      expect(created.status).toBe('CREATED');
      expect(created.stepCounts.total).toBe(0);

      const fetched = await store.getInstance(created.id, tenantA);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.title).toBe('Lead Onboarding #1');
    });

    it('enforces Anti-IDOR: rejects access when tenant boundaries do not match', async () => {
      const created = await store.createInstance({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        definitionId: 'lead_onboarding',
        title: 'Lead Onboarding Tenant A',
        initiator: { actorType: 'user', actorId: 'user_001' },
        principal: principalA,
        idempotencyKey: 'idem_idor_001',
        correlationId: 'corr_idor_001',
      });

      // Attempt access from Tenant B
      await expect(store.getInstance(created.id, tenantB)).rejects.toThrowError(WorkflowError);
      try {
        await store.getInstance(created.id, tenantB);
      } catch (err) {
        expect((err as WorkflowError).code).toBe('TENANT_SCOPE_VIOLATION');
      }
    });

    it('rejects duplicate instance creation with identical idempotencyKey in same tenant', async () => {
      const input = {
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        definitionId: 'lead_onboarding',
        title: 'Lead Onboarding Idempotent',
        initiator: { actorType: 'user' as const, actorId: 'user_001' },
        principal: principalA,
        idempotencyKey: 'same_idempotency_key',
        correlationId: 'corr_dup_001',
      };

      await store.createInstance(input);

      await expect(store.createInstance(input)).rejects.toThrowError(WorkflowError);
      try {
        await store.createInstance(input);
      } catch (err) {
        expect((err as WorkflowError).code).toBe('IDEMPOTENCY_CONFLICT');
      }
    });
  });

  describe('Status Transitions & Checkpoint Recording', () => {
    it('updates instance status and records sequential chained checkpoints', async () => {
      const inst = await store.createInstance({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        definitionId: 'lead_onboarding',
        title: 'State Transition Workflow',
        initiator: { actorType: 'system', actorId: 'sys_cron' },
        principal: principalA,
        idempotencyKey: 'idem_state_001',
        correlationId: 'corr_state_001',
      });

      // CREATED -> QUEUED
      const queued = await store.updateInstanceStatus(inst.id, 'QUEUED', tenantA);
      expect(queued.status).toBe('QUEUED');

      // QUEUED -> RUNNING
      const running = await store.updateInstanceStatus(inst.id, 'RUNNING', tenantA);
      expect(running.status).toBe('RUNNING');

      // RUNNING -> WAITING
      const waiting = await store.updateInstanceStatus(inst.id, 'WAITING', tenantA, {
        waitCondition: {
          type: 'webhook',
          token: 'token_webhook_123',
        },
      });
      expect(waiting.status).toBe('WAITING');
      expect(waiting.currentWaitCondition?.type).toBe('webhook');

      // WAITING -> RESUMED
      const resumed = await store.updateInstanceStatus(inst.id, 'RESUMED', tenantA);
      expect(resumed.status).toBe('RESUMED');

      // RESUMED -> VERIFYING
      const verifying = await store.updateInstanceStatus(inst.id, 'VERIFYING', tenantA);
      expect(verifying.status).toBe('VERIFYING');

      // VERIFYING -> COMPLETED
      const completed = await store.updateInstanceStatus(inst.id, 'COMPLETED', tenantA, {
        outputs: { result: 'all steps verified' },
      });
      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).toBeDefined();
      expect(completed.outputs).toEqual({ result: 'all steps verified' });

      // Verify checkpoints list and hash chaining
      const checkpoints = await store.listCheckpoints(inst.id, tenantA);
      expect(checkpoints.length).toBeGreaterThanOrEqual(6);

      for (let i = 1; i < checkpoints.length; i++) {
        expect(checkpoints[i].previousHash).toBe(checkpoints[i - 1].hash);
      }
    });

    it('rejects invalid state transition out of terminal state', async () => {
      const inst = await store.createInstance({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        definitionId: 'lead_onboarding',
        title: 'Cancel Workflow',
        initiator: { actorType: 'user', actorId: 'user_001' },
        principal: principalA,
        idempotencyKey: 'idem_cancel_001',
        correlationId: 'corr_cancel_001',
      });

      // CREATED -> CANCELLED
      await store.updateInstanceStatus(inst.id, 'CANCELLED', tenantA);

      // Attempt transition CANCELLED -> RUNNING
      await expect(store.updateInstanceStatus(inst.id, 'RUNNING', tenantA)).rejects.toThrowError(
        WorkflowError
      );
    });
  });

  describe('Step Management & Execution Records', () => {
    it('creates, retrieves, and updates workflow steps', async () => {
      const inst = await store.createInstance({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        definitionId: 'lead_onboarding',
        title: 'Step Test Workflow',
        initiator: { actorType: 'agent', actorId: 'agent_sdr' },
        principal: principalA,
        idempotencyKey: 'idem_step_test_001',
        correlationId: 'corr_step_test_001',
      });

      const step1 = await store.createStep({
        workflowId: inst.id,
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        stepIndex: 0,
        capabilityId: 'crm.enrich_lead',
        name: 'Enrich Lead Data',
        input: { email: 'lead@example.com' },
        isMutating: false,
      });

      expect(step1.id).toBeDefined();
      expect(step1.status).toBe('PENDING');

      // Update step to RUNNING
      const runningStep = await store.updateStep(
        inst.id,
        step1.id,
        {
          status: 'RUNNING',
          startedAt: new Date().toISOString(),
          attempt: 1,
        },
        tenantA
      );
      expect(runningStep.status).toBe('RUNNING');
      expect(runningStep.attempt).toBe(1);

      // Update step to COMPLETED
      const completedStep = await store.updateStep(
        inst.id,
        step1.id,
        {
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          output: { domain: 'example.com', score: 85 },
          durationMs: 250,
          outputValidated: true,
        },
        tenantA
      );
      expect(completedStep.status).toBe('COMPLETED');
      expect(completedStep.output?.score).toBe(85);

      const allSteps = await store.listSteps(inst.id, tenantA);
      expect(allSteps.length).toBe(1);
      expect(allSteps[0].id).toBe(step1.id);
    });

    it('enforces Anti-IDOR on step operations', async () => {
      const inst = await store.createInstance({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        definitionId: 'lead_onboarding',
        title: 'Step IDOR Test',
        initiator: { actorType: 'user', actorId: 'user_001' },
        principal: principalA,
        idempotencyKey: 'idem_step_idor',
        correlationId: 'corr_step_idor',
      });

      const step = await store.createStep({
        workflowId: inst.id,
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        stepIndex: 0,
        capabilityId: 'crm.enrich',
        name: 'Step 1',
      });

      // Tenant B accessing Tenant A's step
      await expect(store.getStep(inst.id, step.id, tenantB)).rejects.toThrowError(WorkflowError);
      await expect(
        store.updateStep(inst.id, step.id, { status: 'COMPLETED' }, tenantB)
      ).rejects.toThrowError(WorkflowError);
    });
  });

  describe('Listing & Filtering', () => {
    it('lists instances filtered by status with pagination', async () => {
      // Create 3 instances for Tenant A
      const w1 = await store.createInstance({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        definitionId: 'def_1',
        title: 'Workflow 1',
        initiator: { actorType: 'user', actorId: 'u1' },
        principal: principalA,
        idempotencyKey: 'idem_list_1',
        correlationId: 'c1',
      });

      const w2 = await store.createInstance({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        definitionId: 'def_1',
        title: 'Workflow 2',
        initiator: { actorType: 'user', actorId: 'u1' },
        principal: principalA,
        idempotencyKey: 'idem_list_2',
        correlationId: 'c2',
      });

      await store.updateInstanceStatus(w1.id, 'QUEUED', tenantA);
      await store.updateInstanceStatus(w1.id, 'RUNNING', tenantA);

      // List all
      const all = await store.listInstances({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
      });
      expect(all.total).toBe(2);
      expect(all.items.some((i) => i.id === w2.id)).toBe(true);

      // Filter by status RUNNING
      const runningOnly = await store.listInstances({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        status: 'RUNNING',
      });
      expect(runningOnly.items.length).toBe(1);
      expect(runningOnly.items[0].id).toBe(w1.id);

      // Pagination
      const page1 = await store.listInstances({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        limit: 1,
        offset: 0,
      });
      expect(page1.items.length).toBe(1);

      const page2 = await store.listInstances({
        organizationId: tenantA.organizationId,
        workspaceId: tenantA.workspaceId,
        limit: 1,
        offset: 1,
      });
      expect(page2.items.length).toBe(1);
      expect(page2.items[0].id).not.toBe(page1.items[0].id);
    });
  });
});
