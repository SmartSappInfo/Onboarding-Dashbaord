/**
 * @fileOverview Unit & Integration Tests for AgentReplanner (Rules 23, 47, 48, 60)
 *
 * Validates dynamic failure replanning, DAG pruning of downstream dependent steps,
 * plan version incrementing, hard replan budget ceilings (Rule 23), anti-oscillation
 * capability blacklisting (Rule 47), and emergency dead-man fail-closed gates (Rule 60).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { AgentReplanner } from '../../runtime/planning/agent-replanner';
import {
  TieredModelRouter,
  DeterministicMockModelProvider,
} from '../../runtime/routing/model-router';
import { createMemoryAgentRunStore, type AgentRunStore } from '../../runtime/agent-run-store';
import {
  createCapabilityRegistryStore,
  type CapabilityRegistryStore,
} from '@/platform/capabilities/registry/capability-registry';
import { type AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { AgentRuntimeError, type ExecutionPlan } from '../../runtime/agent-run-types';

describe('AgentReplanner (Rules 23, 47, 48, 60)', () => {
  let mockPro: DeterministicMockModelProvider;
  let modelRouter: TieredModelRouter;
  let registryStore: CapabilityRegistryStore;
  let runStore: AgentRunStore;
  let replanner: AgentReplanner;

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
      data: { contactId: 'con_1', name: 'Acme Corp' },
      executionId: 'ex_1',
      emittedEvents: [],
      durationMs: 5,
    }),
  };

  const mockCreateNote: AnyCapabilityDefinition = {
    id: 'crm.create_note',
    name: 'Create CRM Note',
    description: 'Creates a note attached to a contact.',
    version: '1.2.0',
    domain: 'crm_contacts',
    operation: 'create',
    permissions: ['app:contacts_edit'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L2_STATE_MUTATION',
      destructive: false,
      idempotent: false,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
      compensatingCapabilityId: 'crm.delete_note',
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
      data: { noteId: 'note_1' },
      executionId: 'ex_2',
      emittedEvents: [],
      durationMs: 5,
    }),
  };

  const mockSendChat: AnyCapabilityDefinition = {
    id: 'comm.send_chat',
    name: 'Send Internal Chat',
    description: 'Sends an internal notification chat message.',
    version: '1.0.0',
    domain: 'communication_messaging',
    operation: 'execute',
    permissions: ['workspace:read'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L2_STATE_MUTATION',
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
      data: { messageId: 'msg_1' },
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
    registryStore.register(mockSendChat);

    runStore = createMemoryAgentRunStore();

    replanner = new AgentReplanner({
      modelRouter,
      capabilityRegistry: registryStore,
      runStore,
    });
  });

  describe('Dynamic Failure Replanning & DAG Pruning', () => {
    it('prunes failed step and downstream dependents, stitching remedial steps with incremented version', async () => {
      // 1. Create run with a 3-step DAG: step_find -> step_note -> step_chat
      const run = await runStore.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Find contact, add note, and notify team' },
      });

      const initialPlan: ExecutionPlan = {
        planId: 'plan_initial',
        version: 1,
        rationale: 'Initial 3-step pipeline',
        estimatedTokens: 300,
        createdAt: new Date().toISOString(),
        steps: [
          {
            stepId: 'step_find',
            stepIndex: 0,
            title: 'Find Contact',
            type: 'tool_call',
            capabilityId: 'crm.find_contact',
            arguments: { name: 'Acme' },
            dependsOnStepIds: [],
            isNonDelegable: false,
            timeoutMs: 30000,
          },
          {
            stepId: 'step_note',
            stepIndex: 1,
            title: 'Create Note',
            type: 'tool_call',
            capabilityId: 'crm.create_note',
            arguments: { body: 'Important note' },
            dependsOnStepIds: ['step_find'],
            isNonDelegable: false,
            timeoutMs: 30000,
          },
          {
            stepId: 'step_chat',
            stepIndex: 2,
            title: 'Notify Team',
            type: 'tool_call',
            capabilityId: 'comm.send_chat',
            arguments: { message: 'Note recorded' },
            dependsOnStepIds: ['step_note'], // Transitive dependency on step_note
            isNonDelegable: false,
            timeoutMs: 30000,
          },
        ],
      };

      await runStore.saveExecutionPlan('org_acme', run.runId, initialPlan);

      // Record step_find as completed
      await runStore.createStep('org_acme', run.runId, {
        stepId: 'step_find',
        runId: run.runId,
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        stepIndex: 0,
        title: 'Find Contact',
        type: 'tool_call',
        capabilityId: 'crm.find_contact',
        idempotencyKey: 'idem_find',
        correlationId: 'corr_find',
        input: { name: 'Acme' },
      });
      await runStore.updateStep({
        organizationId: 'org_acme',
        runId: run.runId,
        stepId: 'step_find',
        status: 'completed',
        output: { contactId: 'con_1' },
      });

      // Prepare remedial model response: replace failed step_note & step_chat with alternative comm.send_chat directly
      const remedialCandidate = {
        remedialRationale: 'Note service unavailable; fallback to sending urgent chat directly to team citing contact ID.',
        estimatedTokens: 180,
        remedialSteps: [
          {
            stepId: 'step_remedial_chat',
            title: 'Direct Chat Notification',
            type: 'tool_call',
            capabilityId: 'comm.send_chat',
            arguments: { message: 'Contact Acme found; note creation skipped due to outage.' },
            dependsOnStepIds: ['step_find'],
            what: 'Notify team without note creation',
            why: 'Bypass broken note service',
          },
        ],
      };
      mockPro.enqueueResponse(JSON.stringify(remedialCandidate));

      // 2. Trigger replanning on failed step_note
      const newPlan = await replanner.replan({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        runId: run.runId,
        failedStepId: 'step_note',
        failureReason: 'CRM Note Service HTTP 503 Service Unavailable',
      });

      // 3. Assertions
      expect(newPlan.version).toBe(2);
      expect(newPlan.steps).toHaveLength(2); // step_find (retained) + step_remedial_chat (remedial)
      expect(newPlan.steps[0].stepId).toBe('step_find');
      expect(newPlan.steps[0].stepIndex).toBe(0);
      expect(newPlan.steps[1].stepId).toBe('step_remedial_chat');
      expect(newPlan.steps[1].stepIndex).toBe(1);
      expect(newPlan.steps[1].dependsOnStepIds).toEqual(['step_find']);

      // 4. Verify run store updated
      const updatedRun = await runStore.getRun('org_acme', run.runId);
      expect(updatedRun?.currentPlan?.version).toBe(2);
      expect(updatedRun?.currentPlan?.steps).toHaveLength(2);
    });

    it('enforces hard replan ceiling of maxReplansPerRun = 3 and fails run (Rule 23)', async () => {
      const run = await runStore.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Find contact' },
      });

      // Plan is already at version 4 (meaning 3 replans already happened)
      const maxedPlan: ExecutionPlan = {
        planId: 'plan_maxed',
        version: 4,
        rationale: 'Attempted 3 replans already',
        estimatedTokens: 100,
        createdAt: new Date().toISOString(),
        steps: [
          {
            stepId: 'step_fail_again',
            stepIndex: 0,
            title: 'Retry tool',
            type: 'tool_call',
            capabilityId: 'crm.find_contact',
            dependsOnStepIds: [],
            isNonDelegable: false,
            timeoutMs: 30000,
          },
        ],
      };
      await runStore.saveExecutionPlan('org_acme', run.runId, maxedPlan);

      await expect(
        replanner.replan({
          organizationId: 'org_acme',
          workspaceId: 'ws_sales',
          runId: run.runId,
          failedStepId: 'step_fail_again',
          failureReason: 'Still failing',
          maxReplansPerRun: 3,
        })
      ).rejects.toThrowError(AgentRuntimeError);

      const finalRun = await runStore.getRun('org_acme', run.runId);
      expect(finalRun?.status).toBe('failed');
    });

    it('detects oscillation loop and blacklists capability when it fails multiple times (Rule 47)', async () => {
      const run = await runStore.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Record notes safely' },
      });

      const plan: ExecutionPlan = {
        planId: 'plan_osc',
        version: 2,
        rationale: 'Second attempt',
        estimatedTokens: 100,
        createdAt: new Date().toISOString(),
        steps: [
          {
            stepId: 'step_note_2',
            stepIndex: 0,
            title: 'Note attempt 2',
            type: 'tool_call',
            capabilityId: 'crm.create_note',
            dependsOnStepIds: [],
            isNonDelegable: false,
            timeoutMs: 30000,
          },
        ],
      };
      await runStore.saveExecutionPlan('org_acme', run.runId, plan);

      // Record 2 previous failures of crm.create_note
      await runStore.createStep('org_acme', run.runId, {
        stepId: 'step_note_1',
        runId: run.runId,
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        stepIndex: 0,
        title: 'Note attempt 1',
        type: 'tool_call',
        capabilityId: 'crm.create_note',
        idempotencyKey: 'idem_n1',
        correlationId: 'corr_n1',
      });
      await runStore.updateStep({
        organizationId: 'org_acme',
        runId: run.runId,
        stepId: 'step_note_1',
        status: 'failed',
        sanitizedError: { code: 'WRITE_ERROR', message: 'Quota exceeded' },
      });

      await runStore.createStep('org_acme', run.runId, {
        stepId: 'step_note_2',
        runId: run.runId,
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        stepIndex: 1,
        title: 'Note attempt 2',
        type: 'tool_call',
        capabilityId: 'crm.create_note',
        idempotencyKey: 'idem_n2',
        correlationId: 'corr_n2',
      });
      await runStore.updateStep({
        organizationId: 'org_acme',
        runId: run.runId,
        stepId: 'step_note_2',
        status: 'failed',
        sanitizedError: { code: 'WRITE_ERROR', message: 'Quota exceeded' },
      });

      // Remedial plan must switch to comm.send_chat because crm.create_note is oscillating
      const remedialCandidate = {
        remedialRationale: 'Blacklisted crm.create_note due to oscillation; notifying via chat instead.',
        estimatedTokens: 150,
        remedialSteps: [
          {
            stepId: 'step_notify',
            title: 'Send Notification',
            type: 'tool_call',
            capabilityId: 'comm.send_chat',
            arguments: { message: 'Notes unavailable due to quota' },
            dependsOnStepIds: [],
          },
        ],
      };
      mockPro.enqueueResponse(JSON.stringify(remedialCandidate));

      const newPlan = await replanner.replan({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        runId: run.runId,
        failedStepId: 'step_note_2',
        failureReason: 'Quota exceeded again',
      });

      expect(newPlan.steps[0].capabilityId).toBe('comm.send_chat');
      // Assert that mock model received instructions blacklisting crm.create_note
      const lastCall = mockPro.invocations[0];
      expect(lastCall.prompt).toContain('crm.create_note');
      expect(lastCall.prompt).toContain('BLACKLISTED');
    });

    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      setGovernanceDeadManStateForTests(true);

      const run = await runStore.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Replan under pause' },
      });

      await expect(
        replanner.replan({
          organizationId: 'org_acme',
          workspaceId: 'ws_sales',
          runId: run.runId,
          failedStepId: 'step_any',
          failureReason: 'Network error',
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });

    it('throws STEP_NOT_FOUND when failedStepId is not in the plan', async () => {
      const run = await runStore.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Find contact' },
      });

      const plan: ExecutionPlan = {
        planId: 'plan_1',
        version: 1,
        rationale: 'Single step',
        estimatedTokens: 50,
        createdAt: new Date().toISOString(),
        steps: [
          {
            stepId: 'step_real',
            stepIndex: 0,
            title: 'Real Step',
            type: 'tool_call',
            capabilityId: 'crm.find_contact',
            dependsOnStepIds: [],
            isNonDelegable: false,
            timeoutMs: 30000,
          },
        ],
      };
      await runStore.saveExecutionPlan('org_acme', run.runId, plan);

      await expect(
        replanner.replan({
          organizationId: 'org_acme',
          workspaceId: 'ws_sales',
          runId: run.runId,
          failedStepId: 'step_ghost',
          failureReason: 'Not real',
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });
  });
});
