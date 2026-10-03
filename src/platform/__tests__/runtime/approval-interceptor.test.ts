/**
 * @fileOverview Unit & Integration Tests for ApprovalInterceptor (Rules 17, 21, 22, 27, 41, 60)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApprovalInterceptor,
  createMemoryApprovalStore,
} from '@/platform/runtime/execution/approval-interceptor';
import { createMemoryAgentRunStore } from '@/platform/runtime/agent-run-store';
import { createEventBus, type EventBus } from '@/platform/events/event-bus';
import { type DomainEvent } from '@/platform/capabilities/events/domain-event';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { type PlanStep, type AgentRun } from '@/platform/runtime/agent-run-types';
import { type AgentPersonaDefinition } from '@/platform/identity/agent-persona-types';
import { globalAgentPersonaRegistry } from '@/platform/identity/agent-registry';

describe('ApprovalInterceptor (Rules 17, 21, 22, 27, 41, 60)', () => {
  let approvalStore: ReturnType<typeof createMemoryApprovalStore>;
  let runStore: ReturnType<typeof createMemoryAgentRunStore>;
  let eventBus: EventBus;
  let emittedEvents: DomainEvent[];
  let interceptor: ApprovalInterceptor;

  const mockPersona: AgentPersonaDefinition = globalAgentPersonaRegistry.getPersona('lead_sdr')!;

  let mockRun: AgentRun;

  beforeEach(async () => {
    setGovernanceDeadManStateForTests(false);
    approvalStore = createMemoryApprovalStore();
    runStore = createMemoryAgentRunStore();
    eventBus = createEventBus();
    emittedEvents = [];
    eventBus.subscribe('*', (ev) => {
      emittedEvents.push(ev);
    });
    interceptor = new ApprovalInterceptor({
      approvalStore,
      runStore,
      eventBus,
    });

    mockRun = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'usr_sarah',
      goal: { prompt: 'Reach out to high-value leads' },
    });
  });

  it('permits low-risk L0/L1/L2 autonomous steps without interception', async () => {
    const safeStep: PlanStep = {
      stepId: 'step_read',
      stepIndex: 0,
      title: 'Find high value contacts',
      type: 'tool_call',
      capabilityId: 'crm.search_contacts',
      riskLevel: 'L0_READ',
      isNonDelegable: false,
      dependsOnStepIds: [],
      arguments: { query: 'VP of Engineering' },
      timeoutMs: 30000,
    };

    const result = await interceptor.evaluateStepApproval({
      run: mockRun,
      planStep: safeStep,
      persona: mockPersona,
    });

    expect(result.requiresApproval).toBe(false);
    expect(result.actionProposalId).toBeUndefined();
  });

  it('intercepts L3 external communication actions and generates ActionProposal (Rules 21 & 22)', async () => {
    const l3Step: PlanStep = {
      stepId: 'step_send',
      stepIndex: 1,
      title: 'Send outreach email campaign',
      type: 'tool_call',
      capabilityId: 'messaging.send_outbound_email',
      riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      isNonDelegable: false,
      dependsOnStepIds: ['step_read'],
      arguments: {
        to: 'target@corp.com',
        subject: 'Partnership Inquiry',
        body: 'Hello from SmartSapp',
      },
      expectedStateChange: 'email delivered to target',
      timeoutMs: 30000,
    };

    const result = await interceptor.evaluateStepApproval({
      run: mockRun,
      planStep: l3Step,
      persona: mockPersona,
    });

    expect(result.requiresApproval).toBe(true);
    expect(result.actionProposalId).toBeDefined();
    expect(result.payloadHash).toMatch(/^[0-9a-f]{64}$/);

    // Verify proposal stored in store
    const proposal = await approvalStore.getProposal('org_acme', result.actionProposalId!);
    expect(proposal).not.toBeNull();
    expect(proposal?.status).toBe('pending');
    expect(proposal?.what).toContain('Send outreach email campaign');
    expect(proposal?.payloadHash).toBe(result.payloadHash);

    // Verify run transitioned to waiting_for_approval
    const updatedRun = await runStore.getRun('org_acme', mockRun.runId);
    expect(updatedRun?.status).toBe('waiting_for_approval');

    // Verify domain event emitted (Rule 40)
    const event = emittedEvents.find((e) => e.type === 'agent.run.approval_required');
    expect(event).toBeDefined();
    expect((event?.payload as Record<string, unknown>).proposalId).toBe(result.actionProposalId);
  });

  it('intercepts non-delegable actions unconditionally (Rule 17)', async () => {
    const nonDelegableStep: PlanStep = {
      stepId: 'step_admin',
      stepIndex: 2,
      title: 'Rotate API Key',
      type: 'tool_call',
      capabilityId: 'security.rotate_key',
      riskLevel: 'L2_STATE_MUTATION',
      isNonDelegable: true,
      dependsOnStepIds: [],
      arguments: { keyId: 'key_123' },
      timeoutMs: 30000,
    };

    const result = await interceptor.evaluateStepApproval({
      run: mockRun,
      planStep: nonDelegableStep,
      persona: mockPersona,
    });

    expect(result.requiresApproval).toBe(true);
    expect(result.isNonDelegable).toBe(true);
    expect(result.reason).toContain('non-delegable');
  });

  it('verifies approval binding and rejects tampered execution payloads (Rule 22)', async () => {
    const payload = { recipient: 'user@corp.com', amount: 500 };
    const hash = ApprovalInterceptor.computePayloadHash(payload);
    expect(hash).toHaveLength(64);

    const proposal = await approvalStore.createProposal({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      capabilityId: 'billing.charge_customer',
      capabilityVersion: '1.0.0',
      agentPersonaId: 'lead_sdr',
      authorizingUserId: 'usr_sarah',
      what: 'Charge customer',
      why: 'Monthly plan',
      payload,
    });

    // Mark approved by human operator
    await approvalStore.updateProposalStatus({
      organizationId: 'org_acme',
      proposalId: proposal.proposalId,
      status: 'approved',
      decidedBy: 'usr_operator',
    });

    // 1. Valid binding with identical payload
    await expect(
      interceptor.verifyApprovalBinding({
        organizationId: 'org_acme',
        proposalId: proposal.proposalId,
        currentPayload: payload,
      })
    ).resolves.toBeUndefined();

    // 2. Tampered payload: attacker changed amount from 500 to 50000
    const tamperedPayload = { recipient: 'user@corp.com', amount: 50000 };
    await expect(
      interceptor.verifyApprovalBinding({
        organizationId: 'org_acme',
        proposalId: proposal.proposalId,
        currentPayload: tamperedPayload,
      })
    ).rejects.toThrow(/PAYLOAD_TAMPERED/);
  });

  it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
    setGovernanceDeadManStateForTests(true);

    const l3Step: PlanStep = {
      stepId: 'step_l3',
      stepIndex: 0,
      title: 'Outbound dispatch',
      type: 'tool_call',
      capabilityId: 'messaging.send',
      riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      isNonDelegable: false,
      dependsOnStepIds: [],
      arguments: {},
      timeoutMs: 30000,
    };

    await expect(
      interceptor.evaluateStepApproval({
        run: mockRun,
        planStep: l3Step,
        persona: mockPersona,
      })
    ).rejects.toThrow(/emergency dead-man/i);
  });
});
