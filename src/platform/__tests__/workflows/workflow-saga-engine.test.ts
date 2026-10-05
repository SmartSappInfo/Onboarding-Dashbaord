/**
 * @fileOverview Unit tests for Distributed Workflow Saga Compensation Engine (Phase 7 Milestone 4)
 *
 * Validates:
 * - Strict LIFO execution order (Rule 27)
 * - Deterministic idempotency keys (Rule 19)
 * - Shadow simulation & dryRun mode (Rule 42)
 * - Emergency dead-man switch enforcement (Rule 60)
 * - Operator intervention escalation on failure (Rule 25 & 63)
 * - Domain event audit emission (Rule 40)
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod/v4';
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryWorkflowStore } from '@/platform/workflows/workflow-store';
import { createEventBus } from '@/platform/events/event-bus';
import { createCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { WorkflowSagaEngine } from '@/platform/workflows/resilience/workflow-saga-engine';
import { WorkflowResilienceError } from '@/platform/workflows/resilience/workflow-resilience-types';
import type { CapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import type { DomainEvent } from '@/platform/capabilities/events/domain-event';

describe('Distributed Workflow Saga Compensation Engine (Phase 7 Milestone 4)', () => {
  const orgId = 'org_saga_test';
  const workspaceId = 'ws_saga_test';
  const tenant = { organizationId: orgId, workspaceId };

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
  });

  const principal = {
    actorType: 'agent' as const,
    userId: 'user_saga_001',
    organizationId: orgId,
    workspaceId,
    // Compensations now run through the gateway (Phase 11 M0 · T3), which enforces the declared
    // permission; the stored principal must actually hold it.
    grantedScopes: ['crm.write', 'billing.write', 'app:automations_manage'],
    effectiveRole: 'admin',
  };

  function createMockCapability(
    id: string,
    success: boolean = true,
    callsAccumulator?: { push: (item: { args: Record<string, unknown>; idempotencyKey?: string }) => void }
  ): CapabilityDefinition<Record<string, unknown>, Record<string, unknown>> {
    return {
      id,
      version: '1.0.0',
      name: id,
      description: `Mock capability ${id}`,
      domain: 'deals_revenue',
      operation: 'execute',
      permissions: ['app:automations_manage'],
      workspaceScoped: true,
      tenantScoped: true,
      risk: {
        level: 'L2_STATE_MUTATION',
        destructive: false,
        idempotent: true,
        openWorld: false,
        requiresHumanApproval: false,
        nonDelegable: false,
      },
      execution: {
        synchronous: true,
        maxDurationMs: 10000,
        supportsDryRun: true,
        supportsCancellation: false,
        supportsCompensation: false,
        maxPayloadSizeBytes: 1024 * 1024,
      },
      policies: {
        requiresIdempotencyKey: false,
        requiresExpectedVersion: false,
        auditRequired: false,
        defaultEnabled: true,
      },
      inputSchema: z.record(z.string(), z.unknown()),
      outputSchema: z.record(z.string(), z.unknown()),
      handler: async (args, ctx) => {
        if (callsAccumulator) {
          callsAccumulator.push({ args, idempotencyKey: ctx.idempotencyKey });
        }
        if (!success) {
          return {
            success: false,
            error: { code: 'EXECUTION_FAILED', message: `Mock failure in ${id}`, retryable: false },
            executionId: randomUUID(),
          };
        }
        return {
          success: true,
          data: { status: 'reversed', forCapability: id },
          executionId: randomUUID(),
          durationMs: 10,
          emittedEvents: [],
        };
      },
    };
  }

  it('1. executes compensating capabilities in strict reverse-LIFO order with deterministic idempotency keys', async () => {
    const store = createMemoryWorkflowStore();
    const eventBus = createEventBus();
    const capabilityRegistry = createCapabilityRegistryStore();

    const executionLog: string[] = [];
    const calls: Array<{ args: Record<string, unknown>; idempotencyKey?: string }> = [];

    // Register compensating capabilities
    const compCap1 = createMockCapability('billing.refund_payment', true, {
      push: (item) => {
        executionLog.push('billing.refund_payment');
        calls.push(item);
      },
    });
    const compCap2 = createMockCapability('crm.delete_customer', true, {
      push: (item) => {
        executionLog.push('crm.delete_customer');
        calls.push(item);
      },
    });

    capabilityRegistry.register(compCap1);
    capabilityRegistry.register(compCap2);

    const publishedEvents: DomainEvent[] = [];
    eventBus.subscribe('workflow.saga_completed', async (e) => {
      publishedEvents.push(e);
    });

    // Create workflow instance
    const workflow = await store.createInstance({
      organizationId: orgId,
      workspaceId,
      definitionId: 'checkout_workflow',
      title: 'Checkout Saga Test',
      initiator: { actorType: 'user', actorId: 'user_001' },
      principal,
      correlationId: 'corr_saga_001',
      idempotencyKey: 'idem_saga_001',
    });

    // Create step 1: create customer (stepIndex 0)
    const step1 = await store.createStep({
      workflowId: workflow.id,
      organizationId: orgId,
      workspaceId,
      stepIndex: 0,
      capabilityId: 'crm.create_customer',
      name: 'Create Customer',
      idempotencyKey: 'step_1_key',
      compensatingCapabilityId: 'crm.delete_customer',
      input: { customerEmail: 'test@example.com' },
    });
    await store.updateStep(
      workflow.id,
      step1.id,
      {
        status: 'COMPLETED',
        output: { customerId: 'cust_123' },
      },
      tenant
    );

    // Create step 2: charge card (stepIndex 1)
    const step2 = await store.createStep({
      workflowId: workflow.id,
      organizationId: orgId,
      workspaceId,
      stepIndex: 1,
      capabilityId: 'billing.charge_card',
      name: 'Charge Card',
      idempotencyKey: 'step_2_key',
      compensatingCapabilityId: 'billing.refund_payment',
      input: { amount: 5000 },
    });
    await store.updateStep(
      workflow.id,
      step2.id,
      {
        status: 'COMPLETED',
        output: { chargeId: 'ch_456' },
      },
      tenant
    );

    // Instantiate Saga Engine
    const sagaEngine = new WorkflowSagaEngine({
      store,
      capabilityRegistry,
      eventBus,
    });

    const result = await sagaEngine.rollbackWorkflow({
      organizationId: orgId,
      workspaceId,
      workflowId: workflow.id,
      reason: 'Upstream fulfillment failure',
      correlationId: 'corr_saga_001',
    });

    expect(result.success).toBe(true);
    expect(result.totalStepsToCompensate).toBe(2);
    expect(result.compensatedStepsCount).toBe(2);
    expect(result.failedStepsCount).toBe(0);
    expect(result.requiresOperatorIntervention).toBe(false);
    expect(result.dryRun).toBe(false);

    // Strict LIFO: step 2 (index 1) rolled back BEFORE step 1 (index 0)
    expect(executionLog).toEqual(['billing.refund_payment', 'crm.delete_customer']);

    // Deterministic Idempotency Keys (Rule 19)
    expect(calls[0].idempotencyKey).toBe(`saga_comp_${workflow.id}_${step2.id}`);
    expect(calls[1].idempotencyKey).toBe(`saga_comp_${workflow.id}_${step1.id}`);

    // Context merging: inputs + outputs merged into args
    expect(calls[0].args).toMatchObject({ amount: 5000, chargeId: 'ch_456' });
    expect(calls[1].args).toMatchObject({ customerEmail: 'test@example.com', customerId: 'cust_123' });

    // Store state updated
    const updatedStep1 = await store.getStep(workflow.id, step1.id, tenant);
    const updatedStep2 = await store.getStep(workflow.id, step2.id, tenant);
    expect(updatedStep1?.compensationStatus).toBe('completed');
    expect(updatedStep2?.compensationStatus).toBe('completed');

    // Domain event published
    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0].type).toBe('workflow.saga_completed');
  });

  it('2. supports dry-run simulation mode without mutating state or invoking handlers (Rule 42)', async () => {
    const store = createMemoryWorkflowStore();
    const eventBus = createEventBus();
    const capabilityRegistry = createCapabilityRegistryStore();

    let handlerInvoked = false;
    const compCap = createMockCapability('billing.refund_payment', true, {
      push: () => {
        handlerInvoked = true;
      },
    });
    capabilityRegistry.register(compCap);

    const workflow = await store.createInstance({
      organizationId: orgId,
      workspaceId,
      definitionId: 'checkout_workflow',
      title: 'Dry Run Saga Test',
      initiator: { actorType: 'user', actorId: 'user_001' },
      principal,
      correlationId: 'corr_dry_001',
      idempotencyKey: 'idem_dry_001',
    });

    const step = await store.createStep({
      workflowId: workflow.id,
      organizationId: orgId,
      workspaceId,
      stepIndex: 0,
      capabilityId: 'billing.charge_card',
      name: 'Charge Card',
      idempotencyKey: 'step_dry_key',
      compensatingCapabilityId: 'billing.refund_payment',
      input: { amount: 1000 },
    });
    await store.updateStep(workflow.id, step.id, { status: 'COMPLETED' }, tenant);

    const sagaEngine = new WorkflowSagaEngine({
      store,
      capabilityRegistry,
      eventBus,
    });

    const result = await sagaEngine.rollbackWorkflow({
      organizationId: orgId,
      workspaceId,
      workflowId: workflow.id,
      reason: 'Dry run test',
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.compensatedStepsCount).toBe(1);
    expect(handlerInvoked).toBe(false);

    // Store compensation status must remain unchanged in dryRun mode
    const stepInStore = await store.getStep(workflow.id, step.id, tenant);
    expect(stepInStore?.compensationStatus).toBe('none');
  });

  it('3. flags requiresOperatorIntervention: true and emits workflow.saga_failed on partial compensation failure (Rule 25 & 63)', async () => {
    const store = createMemoryWorkflowStore();
    const eventBus = createEventBus();
    const capabilityRegistry = createCapabilityRegistryStore();

    // Register a failing compensating capability
    const failingCap = createMockCapability('billing.failing_compensation', false);
    capabilityRegistry.register(failingCap);

    const failedEvents: DomainEvent[] = [];
    eventBus.subscribe('workflow.saga_failed', async (e) => {
      failedEvents.push(e);
    });

    const workflow = await store.createInstance({
      organizationId: orgId,
      workspaceId,
      definitionId: 'failing_workflow',
      title: 'Failing Saga Test',
      initiator: { actorType: 'user', actorId: 'user_001' },
      principal,
      correlationId: 'corr_fail_001',
      idempotencyKey: 'idem_fail_001',
    });

    const step = await store.createStep({
      workflowId: workflow.id,
      organizationId: orgId,
      workspaceId,
      stepIndex: 0,
      capabilityId: 'billing.charge_card',
      name: 'Charge Card',
      idempotencyKey: 'step_fail_key',
      compensatingCapabilityId: 'billing.failing_compensation',
      input: { amount: 2000 },
    });
    await store.updateStep(workflow.id, step.id, { status: 'COMPLETED' }, tenant);

    const sagaEngine = new WorkflowSagaEngine({
      store,
      capabilityRegistry,
      eventBus,
    });

    const result = await sagaEngine.rollbackWorkflow({
      organizationId: orgId,
      workspaceId,
      workflowId: workflow.id,
      reason: 'Payment processor error',
    });

    expect(result.success).toBe(false);
    expect(result.failedStepsCount).toBe(1);
    expect(result.compensatedStepsCount).toBe(0);
    expect(result.requiresOperatorIntervention).toBe(true);
    expect(result.errorMessage).toContain('Mock failure in billing.failing_compensation');

    const stepInStore = await store.getStep(workflow.id, step.id, tenant);
    expect(stepInStore?.compensationStatus).toBe('failed');

    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].payload.requiresOperatorIntervention).toBe(true);
  });

  it('4. halts rollback and throws DEAD_MAN_PAUSED if emergency dead-man switch is active (Rule 60)', async () => {
    const store = createMemoryWorkflowStore();
    const sagaEngine = new WorkflowSagaEngine({ store });

    setGovernanceDeadManStateForTests(true);

    await expect(
      sagaEngine.rollbackWorkflow({
        organizationId: orgId,
        workspaceId,
        workflowId: 'wf_any',
        reason: 'Emergency test',
      })
    ).rejects.toThrowError(WorkflowResilienceError);

    try {
      await sagaEngine.rollbackWorkflow({
        organizationId: orgId,
        workspaceId,
        workflowId: 'wf_any',
        reason: 'Emergency test',
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(WorkflowResilienceError);
      expect((err as WorkflowResilienceError).code).toBe('DEAD_MAN_PAUSED');
    } finally {
      setGovernanceDeadManStateForTests(false);
    }
  });

  it('5. returns success with 0 steps when no completed steps require compensation', async () => {
    const store = createMemoryWorkflowStore();
    const sagaEngine = new WorkflowSagaEngine({ store });

    const workflow = await store.createInstance({
      organizationId: orgId,
      workspaceId,
      definitionId: 'read_only_workflow',
      title: 'Read Only Saga Test',
      initiator: { actorType: 'user', actorId: 'user_001' },
      principal,
      correlationId: 'corr_ro_001',
      idempotencyKey: 'idem_ro_001',
    });

    // Step with no compensating capability
    await store.createStep({
      workflowId: workflow.id,
      organizationId: orgId,
      workspaceId,
      stepIndex: 0,
      capabilityId: 'crm.read_contact',
      name: 'Read Contact',
      idempotencyKey: 'step_ro_key',
    });

    const result = await sagaEngine.rollbackWorkflow({
      organizationId: orgId,
      workspaceId,
      workflowId: workflow.id,
      reason: 'No rollback needed',
    });

    expect(result.success).toBe(true);
    expect(result.totalStepsToCompensate).toBe(0);
    expect(result.compensatedStepsCount).toBe(0);
  });
});
