/**
 * @fileOverview Unit & Integration Tests for SagaCompensationEngine (Rules 19, 20, 25, 27, 40, 42, 60, 63)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SagaCompensationEngine } from '@/platform/runtime/governance/saga-compensation';
import { createMemoryAgentRunStore } from '@/platform/runtime/agent-run-store';
import {
  createCapabilityRegistryStore,
  type CapabilityRegistryStore,
} from '@/platform/capabilities/registry/capability-registry';
import { type AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { GovernanceError } from '@/platform/runtime/governance/governance-types';
import { z } from 'zod/v4';

describe('SagaCompensationEngine (Rules 19, 20, 25, 27, 40, 42, 60, 63)', () => {
  let runStore: ReturnType<typeof createMemoryAgentRunStore>;
  let registryStore: CapabilityRegistryStore;
  let sagaEngine: SagaCompensationEngine;
  let executedRollbacks: string[];

  const mockDeleteContact: AnyCapabilityDefinition = {
    id: 'crm.delete_contact',
    name: 'Delete Contact',
    description: 'Rolls back contact creation',
    version: '1.0.0',
    domain: 'crm_contacts',
    operation: 'delete',
    permissions: [],
    public: { reason: 'Test mock rollback capability' },
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L2_STATE_MUTATION',
      destructive: true,
      idempotent: true,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 5000,
      supportsDryRun: true,
      supportsCancellation: true,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1048576,
    },
    policies: {
      requiresIdempotencyKey: true,
      requiresExpectedVersion: false,
      auditRequired: true,
    },
    inputSchema: z.object({ contactId: z.string().optional() }),
    outputSchema: z.object({ deleted: z.boolean() }),
    handler: async (rawInput: unknown) => {
      const payload = rawInput as { input?: { contactId?: string }; contactId?: string };
      const contactId = payload.input?.contactId ?? payload.contactId ?? '';
      executedRollbacks.push(`delete_contact:${contactId}`);
      return {
        success: true,
        data: { deleted: true },
        executionId: 'exec_del',
        emittedEvents: [],
        durationMs: 1,
      };
    },
  };

  const mockRevokeAccess: AnyCapabilityDefinition = {
    id: 'iam.revoke_access',
    name: 'Revoke Access',
    description: 'Rolls back granted access',
    version: '1.0.0',
    domain: 'identity_access',
    operation: 'update',
    permissions: [],
    public: { reason: 'Test mock rollback capability' },
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L2_STATE_MUTATION',
      destructive: true,
      idempotent: true,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 5000,
      supportsDryRun: true,
      supportsCancellation: true,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1048576,
    },
    policies: {
      requiresIdempotencyKey: true,
      requiresExpectedVersion: false,
      auditRequired: true,
    },
    inputSchema: z.object({ userId: z.string().optional() }),
    outputSchema: z.object({ revoked: z.boolean() }),
    handler: async (rawInput: unknown) => {
      const payload = rawInput as { input?: { userId?: string }; userId?: string };
      const userId = payload.input?.userId ?? payload.userId ?? '';
      executedRollbacks.push(`revoke_access:${userId}`);
      return {
        success: true,
        data: { revoked: true },
        executionId: 'exec_rev',
        emittedEvents: [],
        durationMs: 1,
      };
    },
  };

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
    executedRollbacks = [];
    runStore = createMemoryAgentRunStore();
    registryStore = createCapabilityRegistryStore();
    registryStore.register(mockDeleteContact);
    registryStore.register(mockRevokeAccess);
    sagaEngine = new SagaCompensationEngine({
      runStore,
      capabilityRegistry: registryStore,
    });
  });

  it('executes compensating steps in strict LIFO (reverse) order upon rollback', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Onboard contact and grant access' },
    });

    // Step 0: Create contact (compensated by crm.delete_contact)
    const step0 = await runStore.createStep('org_acme', run.runId, {
      stepId: 'step_0',
      runId: run.runId,
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      stepIndex: 0,
      type: 'tool_call',
      title: 'Create Contact',
      capabilityId: 'crm.create_contact',
      compensatingCapabilityId: 'crm.delete_contact',
      idempotencyKey: 'idemp_0',
      correlationId: 'corr_0',
      input: { name: 'Alice' },
    });

    // Mark step 0 completed with output
    await runStore.updateStep({
      organizationId: 'org_acme',
      runId: run.runId,
      stepId: step0.stepId,
      status: 'completed',
      output: { contactId: 'con_abc' },
      compensationStatus: 'pending',
    });

    // Step 1: Grant access (compensated by iam.revoke_access)
    const step1 = await runStore.createStep('org_acme', run.runId, {
      stepId: 'step_1',
      runId: run.runId,
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      stepIndex: 1,
      type: 'tool_call',
      title: 'Grant Access',
      capabilityId: 'iam.grant_access',
      compensatingCapabilityId: 'iam.revoke_access',
      idempotencyKey: 'idemp_1',
      correlationId: 'corr_1',
      input: { role: 'admin' },
    });

    // Mark step 1 completed with output
    await runStore.updateStep({
      organizationId: 'org_acme',
      runId: run.runId,
      stepId: step1.stepId,
      status: 'completed',
      output: { userId: 'usr_xyz' },
      compensationStatus: 'pending',
    });

    // Execute Saga Rollback
    const result = await sagaEngine.rollbackRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      runId: run.runId,
      reason: 'Step 2 failed; rolling back prior mutations',
    });

    expect(result.success).toBe(true);
    expect(result.totalCompensations).toBe(2);
    expect(result.completedCompensations).toBe(2);

    // Strict LIFO execution check: Step 1 (revoke_access) MUST execute before Step 0 (delete_contact)
    expect(executedRollbacks).toEqual([
      'revoke_access:usr_xyz',
      'delete_contact:con_abc',
    ]);

    // Check step compensation status was updated in store
    const updatedStep0 = await runStore.getStep('org_acme', run.runId, 'step_0');
    expect(updatedStep0?.compensationStatus).toBe('completed');
  });

  it('supports dry-run mode without invoking mutating capability handlers (Rule 42)', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Dry run compensation' },
    });

    const step = await runStore.createStep('org_acme', run.runId, {
      stepId: 'step_0',
      runId: run.runId,
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      stepIndex: 0,
      type: 'tool_call',
      title: 'Create Contact',
      capabilityId: 'crm.create_contact',
      compensatingCapabilityId: 'crm.delete_contact',
      idempotencyKey: 'idemp_0',
      correlationId: 'corr_0',
      input: {},
    });

    await runStore.updateStep({
      organizationId: 'org_acme',
      runId: run.runId,
      stepId: step.stepId,
      status: 'completed',
      output: { contactId: 'con_abc' },
      compensationStatus: 'pending',
    });

    const result = await sagaEngine.rollbackRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      runId: run.runId,
      reason: 'Simulate rollback',
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(executedRollbacks).toHaveLength(0); // Zero mutating handlers called
  });

  it('handles partial compensation failures and flags operator intervention required (Rules 25 & 63)', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Partial failure test' },
    });

    // Step with non-existent compensating capability to trigger failure
    const step = await runStore.createStep('org_acme', run.runId, {
      stepId: 'step_missing',
      runId: run.runId,
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      stepIndex: 0,
      type: 'tool_call',
      title: 'Bad Step',
      capabilityId: 'crm.create_contact',
      compensatingCapabilityId: 'crm.missing_rollback_capability',
      idempotencyKey: 'idemp_m',
      correlationId: 'corr_m',
      input: {},
    });

    await runStore.updateStep({
      organizationId: 'org_acme',
      runId: run.runId,
      stepId: step.stepId,
      status: 'completed',
      compensationStatus: 'pending',
    });

    const result = await sagaEngine.rollbackRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      runId: run.runId,
      reason: 'Rollback with missing cap',
    });

    expect(result.success).toBe(false);
    expect(result.failedCompensations).toBe(1);
    expect(result.requiresOperatorIntervention).toBe(true);

    const updatedStep = await runStore.getStep('org_acme', run.runId, 'step_missing');
    expect(updatedStep?.compensationStatus).toBe('failed');
  });

  it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
    setGovernanceDeadManStateForTests(true);

    await expect(
      sagaEngine.rollbackRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        runId: 'run_any',
        reason: 'Rollback under dead man',
      })
    ).rejects.toThrowError(GovernanceError);
  });
});
