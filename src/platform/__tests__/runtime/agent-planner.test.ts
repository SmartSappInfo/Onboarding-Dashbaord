/**
 * @fileOverview Unit & Integration Tests for Autonomous Agent Planner (Rules 13, 16, 27, 30, 41, 47, 59, 60)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { AgentPlanner } from '@/platform/runtime/planning/agent-planner';
import {
  TieredModelRouter,
  DeterministicMockModelProvider,
} from '@/platform/runtime/routing/model-router';
import { createMemoryAgentRunStore } from '@/platform/runtime/agent-run-store';
import {
  createCapabilityRegistryStore,
  type CapabilityRegistryStore,
} from '@/platform/capabilities/registry/capability-registry';
import { type AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { AgentRuntimeError } from '@/platform/runtime/agent-run-types';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('AgentPlanner (Rules 13, 16, 27, 30, 41, 47, 59, 60)', () => {
  let mockPro: DeterministicMockModelProvider;
  let modelRouter: TieredModelRouter;
  let registryStore: CapabilityRegistryStore;
  let runStore: ReturnType<typeof createMemoryAgentRunStore>;
  let planner: AgentPlanner;

  // Mock capabilities conforming to AnyCapabilityDefinition
  const mockFindContact: AnyCapabilityDefinition = {
    id: 'crm.find_contact',
    name: 'Find Contact',
    description: 'Find contact by name or email',
    version: '1.0.0',
    domain: 'crm_contacts',
    operation: 'read',
    permissions: ['app:contacts_view'],
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
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    handler: async () => ({
      success: true,
      data: { contactId: 'con_123' },
      executionId: 'ex_1',
      emittedEvents: [],
      durationMs: 5,
    }),
  };

  const mockCreateNote: AnyCapabilityDefinition = {
    id: 'crm.create_note',
    name: 'Create CRM Note',
    description: 'Create a note on a contact or company',
    version: '1.2.0',
    domain: 'crm_contacts',
    operation: 'create',
    permissions: ['app:contacts_edit'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L2_STATE_MUTATION',
      compensatingCapabilityId: 'crm.delete_note',
      destructive: false,
      idempotent: false,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
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
      requiresIdempotencyKey: true,
      requiresExpectedVersion: false,
      auditRequired: true,
    },
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    handler: async () => ({
      success: true,
      data: { noteId: 'note_456' },
      executionId: 'ex_2',
      emittedEvents: [],
      durationMs: 5,
    }),
  };

  const mockSendPortalInvite: AnyCapabilityDefinition = {
    id: 'experience_portal.send_invite',
    name: 'Send Portal Invite',
    description: 'Send external portal invitation email',
    version: '1.0.0',
    domain: 'experience_portal',
    operation: 'execute',
    permissions: ['app:contacts_create'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      requiresHumanApproval: true,
      nonDelegable: true,
      destructive: false,
      idempotent: false,
      openWorld: true,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 5000,
      supportsDryRun: false,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1048576,
    },
    policies: {
      requiresIdempotencyKey: true,
      requiresExpectedVersion: false,
      auditRequired: true,
    },
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    handler: async () => ({
      success: true,
      data: { sent: true },
      executionId: 'ex_3',
      emittedEvents: [],
      durationMs: 5,
    }),
  };

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);

    mockPro = new DeterministicMockModelProvider('mock-pro', 'pro');
    modelRouter = new TieredModelRouter({
      providers: { pro: mockPro },
    });

    registryStore = createCapabilityRegistryStore();
    registryStore.register(mockFindContact);
    registryStore.register(mockCreateNote);
    registryStore.register(mockSendPortalInvite);

    runStore = createMemoryAgentRunStore();

    planner = new AgentPlanner({
      modelRouter,
      capabilityRegistry: registryStore,
      runStore,
    });
  });

  describe('Goal Decomposition & Plan Synthesis', () => {
    it('synthesizes a validated ExecutionPlan DAG from natural language goal', async () => {
      // 1. Create a run first
      const run = await runStore.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Find contact and record risk note' },
      });

      // 2. Prepare mock model response with valid DAG
      const candidatePlan = {
        rationale: 'First find the contact, then record note citing findings.',
        estimatedTokens: 350,
        steps: [
          {
            stepId: 'step_find',
            title: 'Search for Acme contact',
            type: 'tool_call',
            capabilityId: 'crm.find_contact',
            arguments: { name: 'Acme' },
            dependsOnStepIds: [],
            what: 'Find contact details',
            why: 'Target entity for note',
          },
          {
            stepId: 'step_note',
            title: 'Record warning note',
            type: 'tool_call',
            capabilityId: 'crm.create_note',
            arguments: { body: 'High risk' },
            dependsOnStepIds: ['step_find'],
            what: 'Create note',
            why: 'Save risk assessment',
            expectedStateChange: 'New note created in CRM',
          },
        ],
      };
      mockPro.enqueueResponse(JSON.stringify(candidatePlan));

      // 3. Generate plan
      const plan = await planner.generatePlan({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        runId: run.runId,
        goal: { prompt: 'Find contact and record risk note' },
        personaId: 'lead_sdr',
        authorizingUserId: 'user_ae',
      });

      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0].stepId).toBe('step_find');
      expect(plan.steps[0].stepIndex).toBe(0);
      expect(plan.steps[0].capabilityVersion).toBe('1.0.0');
      expect(plan.steps[0].riskLevel).toBe('L0_READ');

      expect(plan.steps[1].stepId).toBe('step_note');
      expect(plan.steps[1].stepIndex).toBe(1);
      expect(plan.steps[1].capabilityVersion).toBe('1.2.0');
      expect(plan.steps[1].riskLevel).toBe('L2_STATE_MUTATION');
      expect(plan.steps[1].compensatingCapabilityId).toBe('crm.delete_note'); // Rule 27

      // 4. Verify persisted in runStore
      const updatedRun = await runStore.getRun('org_acme', run.runId);
      expect(updatedRun?.currentPlan?.planId).toBe(plan.planId);
      expect(updatedRun?.currentPlan?.steps).toHaveLength(2);
    });

    it('rejects candidate plan with circular dependency (Rule 47)', async () => {
      const run = await runStore.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'crm_researcher',
        principalId: 'agent_res_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Cyclic goal' },
      });

      const cyclicPlan = {
        rationale: 'Deadlock plan',
        estimatedTokens: 200,
        steps: [
          {
            stepId: 'step_a',
            title: 'Step A',
            type: 'tool_call',
            capabilityId: 'crm.find_contact',
            dependsOnStepIds: ['step_b'], // Cycle!
          },
          {
            stepId: 'step_b',
            title: 'Step B',
            type: 'tool_call',
            capabilityId: 'crm.find_contact',
            dependsOnStepIds: ['step_a'],
          },
        ],
      };
      mockPro.enqueueResponse(JSON.stringify(cyclicPlan));

      await expect(
        planner.generatePlan({
          organizationId: 'org_acme',
          workspaceId: 'ws_sales',
          runId: run.runId,
          goal: { prompt: 'Cyclic goal' },
          personaId: 'crm_researcher',
          authorizingUserId: 'user_ae',
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });

    it('strictly filters capabilities by persona allowed domains (Rule 16 & Rule 59)', async () => {
      // crm_researcher persona does NOT have experience_portal in allowedDomains
      const run = await runStore.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'crm_researcher',
        principalId: 'agent_res_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Unauthorized portal invite' },
      });

      // Model hallucinates capability outside persona allowed domains
      const invalidDomainPlan = {
        rationale: 'Attempt unauthorized portal send',
        estimatedTokens: 200,
        steps: [
          {
            stepId: 'step_illegal',
            title: 'Illegal Portal Invite',
            type: 'tool_call',
            capabilityId: 'experience_portal.send_invite', // Prohibited for crm_researcher!
            dependsOnStepIds: [],
          },
        ],
      };
      mockPro.enqueueResponse(JSON.stringify(invalidDomainPlan));

      await expect(
        planner.generatePlan({
          organizationId: 'org_acme',
          workspaceId: 'ws_sales',
          runId: run.runId,
          goal: { prompt: 'Unauthorized portal invite' },
          personaId: 'crm_researcher',
          authorizingUserId: 'user_ae',
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });

    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      setGovernanceDeadManStateForTests(true); // Trip kill switch

      const run = await runStore.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'crm_researcher',
        principalId: 'agent_res_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Plan under pause' },
      });

      await expect(
        planner.generatePlan({
          organizationId: 'org_acme',
          workspaceId: 'ws_sales',
          runId: run.runId,
          goal: { prompt: 'Plan under pause' },
          personaId: 'crm_researcher',
          authorizingUserId: 'user_ae',
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });
  });
});
