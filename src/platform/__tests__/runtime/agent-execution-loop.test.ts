/**
 * @fileOverview Comprehensive Integration Tests for AgentExecutionLoop (Rules 4, 14, 17, 18, 21, 22, 23, 26, 27, 28, 30, 31, 40, 41, 42, 47, 48, 54, 56, 60, 68)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { AgentExecutionLoop } from '@/platform/runtime/execution/agent-execution-loop';
import { createMemoryAgentRunStore } from '@/platform/runtime/agent-run-store';
import { createMemoryApprovalStore } from '@/platform/runtime/execution/approval-interceptor';
import { AgentBudgetManager } from '@/platform/runtime/governance/agent-budget-manager';
import { CancellationEngine } from '@/platform/runtime/governance/cancellation-engine';
import { SagaCompensationEngine } from '@/platform/runtime/governance/saga-compensation';
import { createEventBus, type EventBus } from '@/platform/events/event-bus';
import { canonicalCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { type DomainEvent } from '@/platform/capabilities/events/domain-event';
import { type ExecutionPlan, type AgentRun } from '@/platform/runtime/agent-run-types';

describe('AgentExecutionLoop (Rules 4, 14, 17, 18, 21, 22, 23, 26, 27, 28, 30, 31, 40, 41, 42, 47, 48, 54, 56, 60, 68)', () => {
  let runStore: ReturnType<typeof createMemoryAgentRunStore>;
  let approvalStore: ReturnType<typeof createMemoryApprovalStore>;
  let eventBus: EventBus;
  let emittedEvents: DomainEvent[];
  let budgetManager: AgentBudgetManager;
  let cancellationEngine: CancellationEngine;
  let sagaEngine: SagaCompensationEngine;
  let executionLoop: AgentExecutionLoop;

  let activeRun: AgentRun;

  beforeEach(async () => {
    setGovernanceDeadManStateForTests(false);
    runStore = createMemoryAgentRunStore();
    approvalStore = createMemoryApprovalStore();
    eventBus = createEventBus();
    emittedEvents = [];
    eventBus.subscribe('*', (ev) => {
      emittedEvents.push(ev);
    });

    budgetManager = new AgentBudgetManager({ runStore, eventBus });
    cancellationEngine = new CancellationEngine({ runStore, eventBus });
    sagaEngine = new SagaCompensationEngine({
      runStore,
      capabilityRegistry: canonicalCapabilityRegistryStore,
      eventBus,
    });

    executionLoop = new AgentExecutionLoop({
      runStore,
      approvalStore,
      budgetManager,
      cancellationEngine,
      sagaEngine,
      eventBus,
    });

    // Register test capabilities in capability registry
    canonicalCapabilityRegistryStore.register({
      id: 'crm.find_contact',
      name: 'Find Contact',
      version: '1.0.0',
      domain: 'crm_contacts',
      operation: 'read',
      description: 'Search for contact',
      permissions: [],
      public: { reason: 'Test mock capability' },
      workspaceScoped: true,
      tenantScoped: true,
      risk: {
        level: 'L0_READ',
        destructive: false,
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
        requiresIdempotencyKey: false,
        requiresExpectedVersion: false,
        auditRequired: false,
      },
      inputSchema: z.record(z.string(), z.unknown()),
      outputSchema: z.record(z.string(), z.unknown()),
      handler: async () => ({
        success: true,
        data: { contactId: 'con_100', name: 'Bob Smith', status: 'lead' },
        executionId: 'exec_find_1',
        emittedEvents: [],
        durationMs: 15,
      }),
    }, { allowOverride: true });

    canonicalCapabilityRegistryStore.register({
      id: 'crm.update_status',
      name: 'Update Contact Status',
      version: '1.0.0',
      domain: 'crm_contacts',
      operation: 'update',
      description: 'Update contact status',
      permissions: [],
      public: { reason: 'Test mock capability' },
      workspaceScoped: true,
      tenantScoped: true,
      risk: {
        level: 'L2_STATE_MUTATION',
        destructive: false,
        idempotent: true,
        openWorld: false,
        requiresHumanApproval: false,
        nonDelegable: false,
        compensatingCapabilityId: 'crm.revert_status',
      },
      execution: {
        synchronous: true,
        maxDurationMs: 5000,
        supportsDryRun: true,
        supportsCancellation: true,
        supportsCompensation: true,
        maxPayloadSizeBytes: 1048576,
      },
      policies: {
        requiresIdempotencyKey: false,
        requiresExpectedVersion: false,
        auditRequired: false,
      },
      inputSchema: z.record(z.string(), z.unknown()),
      outputSchema: z.record(z.string(), z.unknown()),
      handler: async () => ({
        success: true,
        data: { contactId: 'con_100', status: 'qualified', updatedAt: new Date().toISOString() },
        executionId: 'exec_update_1',
        emittedEvents: [],
        durationMs: 25,
      }),
    }, { allowOverride: true });

    canonicalCapabilityRegistryStore.register({
      id: 'crm.revert_status',
      name: 'Revert Contact Status',
      version: '1.0.0',
      domain: 'crm_contacts',
      operation: 'update',
      description: 'Revert contact status compensation',
      permissions: [],
      public: { reason: 'Test mock capability' },
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
        maxDurationMs: 5000,
        supportsDryRun: true,
        supportsCancellation: true,
        supportsCompensation: false,
        maxPayloadSizeBytes: 1048576,
      },
      policies: {
        requiresIdempotencyKey: false,
        requiresExpectedVersion: false,
        auditRequired: false,
      },
      inputSchema: z.record(z.string(), z.unknown()),
      outputSchema: z.record(z.string(), z.unknown()),
      handler: async () => ({
        success: true,
        data: { contactId: 'con_100', status: 'lead', reverted: true },
        executionId: 'exec_revert_1',
        emittedEvents: [],
        durationMs: 10,
      }),
    }, { allowOverride: true });

    canonicalCapabilityRegistryStore.register({
      id: 'messaging.send_outbound',
      name: 'Send Outbound Email',
      version: '1.0.0',
      domain: 'communication_messaging',
      operation: 'execute',
      description: 'Send outbound communication',
      permissions: [],
      public: { reason: 'Test mock capability' },
      workspaceScoped: true,
      tenantScoped: true,
      risk: {
        level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
        destructive: false,
        idempotent: false,
        openWorld: true,
        requiresHumanApproval: true,
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
        requiresIdempotencyKey: false,
        requiresExpectedVersion: false,
        auditRequired: false,
      },
      inputSchema: z.record(z.string(), z.unknown()),
      outputSchema: z.record(z.string(), z.unknown()),
      handler: async () => ({
        success: true,
        data: { messageId: 'msg_999', delivered: true },
        executionId: 'exec_msg_1',
        emittedEvents: [],
        durationMs: 40,
      }),
    }, { allowOverride: true });

    activeRun = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'usr_sarah',
      goal: { prompt: 'Find contact and qualify' },
    });
  });

  it('executes a multi-step plan through the full cycle to completion (Happy Path)', async () => {
    const plan: ExecutionPlan = {
      planId: 'plan_1',
      version: 1,
      estimatedTokens: 500,
      rationale: 'Search and qualify',
      createdAt: new Date().toISOString(),
      steps: [
        {
          stepId: 'step_1',
          stepIndex: 0,
          title: 'Find Contact',
          type: 'tool_call',
          capabilityId: 'crm.find_contact',
          riskLevel: 'L0_READ',
          isNonDelegable: false,
          dependsOnStepIds: [],
          arguments: { query: 'Bob' },
          timeoutMs: 10000,
        },
        {
          stepId: 'step_2',
          stepIndex: 1,
          title: 'Qualify Contact',
          type: 'tool_call',
          capabilityId: 'crm.update_status',
          riskLevel: 'L2_STATE_MUTATION',
          isNonDelegable: false,
          dependsOnStepIds: ['step_1'],
          arguments: { contactId: 'con_100', status: 'qualified' },
          expectedStateChange: 'status is qualified',
          compensatingCapabilityId: 'crm.revert_status',
          timeoutMs: 10000,
        },
      ],
    };

    await runStore.saveExecutionPlan('org_acme', activeRun.runId, plan);

    const outcome = await executionLoop.executeRun({
      organizationId: 'org_acme',
      runId: activeRun.runId,
    });

    expect(outcome.status).toBe('completed');
    expect(outcome.completedStepsCount).toBe(2);
    expect(outcome.failedStepsCount).toBe(0);

    // Verify run store updated
    const finalRun = await runStore.getRun('org_acme', activeRun.runId);
    expect(finalRun?.status).toBe('completed');

    // Verify steps stored
    const steps = await runStore.listSteps('org_acme', activeRun.runId);
    expect(steps.length).toBe(2);
    expect(steps[0].status).toBe('completed');
    expect(steps[1].status).toBe('completed');
    expect(steps[1].outputValidated).toBe(true);

    // Verify domain event emitted
    const completedEvent = emittedEvents.find((e) => e.type === 'agent.run.completed');
    expect(completedEvent).toBeDefined();
  });

  it('intercepts high-risk L3 action, pauses run in waiting_for_approval, and creates proposal (Rules 21 & 22)', async () => {
    const plan: ExecutionPlan = {
      planId: 'plan_l3',
      version: 1,
      estimatedTokens: 300,
      rationale: 'Outreach campaign',
      createdAt: new Date().toISOString(),
      steps: [
        {
          stepId: 'step_outbound',
          stepIndex: 0,
          title: 'Send Offer',
          type: 'tool_call',
          capabilityId: 'messaging.send_outbound',
          riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
          isNonDelegable: false,
          dependsOnStepIds: [],
          arguments: { recipient: 'bob@example.com', body: 'Special deal' },
          timeoutMs: 10000,
        },
      ],
    };

    await runStore.saveExecutionPlan('org_acme', activeRun.runId, plan);

    const outcome = await executionLoop.executeRun({
      organizationId: 'org_acme',
      runId: activeRun.runId,
    });

    expect(outcome.status).toBe('waiting_for_approval');
    expect(outcome.actionProposalId).toBeDefined();

    const run = await runStore.getRun('org_acme', activeRun.runId);
    expect(run?.status).toBe('waiting_for_approval');

    const proposal = await approvalStore.getProposal('org_acme', outcome.actionProposalId!);
    expect(proposal?.status).toBe('pending');
    expect(proposal?.what).toContain('Send Offer');
  });

  it('resumes execution and completes upon human approval (Rules 21 & 22)', async () => {
    const plan: ExecutionPlan = {
      planId: 'plan_resume',
      version: 1,
      estimatedTokens: 300,
      rationale: 'Outbound flow',
      createdAt: new Date().toISOString(),
      steps: [
        {
          stepId: 'step_outbound',
          stepIndex: 0,
          title: 'Send Offer',
          type: 'tool_call',
          capabilityId: 'messaging.send_outbound',
          riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
          isNonDelegable: false,
          dependsOnStepIds: [],
          arguments: { recipient: 'bob@example.com' },
          timeoutMs: 10000,
        },
      ],
    };

    await runStore.saveExecutionPlan('org_acme', activeRun.runId, plan);

    // Initial pass: intercepts and creates proposal
    const outcome1 = await executionLoop.executeRun({
      organizationId: 'org_acme',
      runId: activeRun.runId,
    });
    expect(outcome1.status).toBe('waiting_for_approval');

    // Operator approves in UI
    await approvalStore.updateProposalStatus({
      organizationId: 'org_acme',
      proposalId: outcome1.actionProposalId!,
      status: 'approved',
      decidedBy: 'usr_operator',
    });

    // Advance run back to executing to resume
    await runStore.updateRunStatus({
      organizationId: 'org_acme',
      runId: activeRun.runId,
      toStatus: 'executing',
      reason: 'Proposal approved by operator',
    });

    // Second pass: executes approved step and completes
    const outcome2 = await executionLoop.executeRun({
      organizationId: 'org_acme',
      runId: activeRun.runId,
    });

    expect(outcome2.status).toBe('completed');
    expect(outcome2.completedStepsCount).toBe(1);
  });

  it('triggers Saga reverse-LIFO rollback when an unrecoverable failure occurs (Rule 27)', async () => {
    canonicalCapabilityRegistryStore.register({
      id: 'crm.failing_step',
      name: 'Failing Step',
      version: '1.0.0',
      domain: 'crm_contacts',
      operation: 'update',
      description: 'Step that always fails',
      permissions: [],
      public: { reason: 'Test mock capability' },
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
        maxDurationMs: 5000,
        supportsDryRun: true,
        supportsCancellation: true,
        supportsCompensation: false,
        maxPayloadSizeBytes: 1048576,
      },
      policies: {
        requiresIdempotencyKey: false,
        requiresExpectedVersion: false,
        auditRequired: false,
      },
      inputSchema: z.record(z.string(), z.unknown()),
      outputSchema: z.record(z.string(), z.unknown()),
      handler: async () => {
        throw new Error('Unrecoverable external API crash');
      },
    }, { allowOverride: true });

    const plan: ExecutionPlan = {
      planId: 'plan_saga',
      version: 1,
      estimatedTokens: 400,
      rationale: 'Update and fail',
      createdAt: new Date().toISOString(),
      steps: [
        {
          stepId: 'step_mutate_1',
          stepIndex: 0,
          title: 'Qualify',
          type: 'tool_call',
          capabilityId: 'crm.update_status',
          riskLevel: 'L2_STATE_MUTATION',
          isNonDelegable: false,
          dependsOnStepIds: [],
          arguments: { contactId: 'con_100', status: 'qualified' },
          compensatingCapabilityId: 'crm.revert_status',
          timeoutMs: 10000,
        },
        {
          stepId: 'step_fail_2',
          stepIndex: 1,
          title: 'Failing Step',
          type: 'tool_call',
          capabilityId: 'crm.failing_step',
          riskLevel: 'L2_STATE_MUTATION',
          isNonDelegable: false,
          dependsOnStepIds: ['step_mutate_1'],
          arguments: {},
          timeoutMs: 10000,
        },
      ],
    };

    await runStore.saveExecutionPlan('org_acme', activeRun.runId, plan);

    const outcome = await executionLoop.executeRun({
      organizationId: 'org_acme',
      runId: activeRun.runId,
      options: { maxReplans: 0 }, // Do not replan, trigger immediate saga rollback
    });

    expect(outcome.status).toBe('failed');

    // Verify compensating capability was executed
    const compensatedEvent = emittedEvents.find((e) => e.type === 'agent.run.compensated');
    expect(compensatedEvent).toBeDefined();
  });

  it('halts immediately when emergency dead-man switch is engaged (Rule 60)', async () => {
    setGovernanceDeadManStateForTests(true);

    await expect(
      executionLoop.executeRun({
        organizationId: 'org_acme',
        runId: activeRun.runId,
      })
    ).rejects.toThrow(/emergency dead-man/i);
  });
});
