/**
 * @fileOverview Unit & Integration Tests for ShadowSimulationEngine (Rule 42)
 *
 * Validates shadow mode dry-run simulation of ExecutionPlan DAGs:
 * - Zero live writes or mutating side effects on production data.
 * - Accurate interception of mutating capabilities (L1, L2, L3, L4).
 * - Blast radius calculation (mutations intercepted, high-risk operations, risk category).
 * - Strict topological DAG validation before simulation (Rule 47).
 * - Emergency dead-man fail-closed gates (Rule 60).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { ShadowSimulationEngine } from '../../runtime/planning/shadow-simulation';
import {
  createCapabilityRegistryStore,
  type CapabilityRegistryStore,
} from '@/platform/capabilities/registry/capability-registry';
import { type AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { AgentRuntimeError, type ExecutionPlan } from '../../runtime/agent-run-types';

describe('ShadowSimulationEngine (Rule 42)', () => {
  let registryStore: CapabilityRegistryStore;
  let engine: ShadowSimulationEngine;
  let executionOccurred: boolean;

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
    handler: async () => {
      return {
        success: true,
        data: { contactId: 'con_1', name: 'Acme Corp' },
        executionId: 'ex_1',
        emittedEvents: [],
        durationMs: 5,
      };
    },
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
    handler: async () => {
      executionOccurred = true; // Side effect sentinel!
      return {
        success: true,
        data: { noteId: 'note_real' },
        executionId: 'ex_2',
        emittedEvents: [],
        durationMs: 5,
      };
    },
  };

  const mockDeleteContract: AnyCapabilityDefinition = {
    id: 'contracts.delete',
    name: 'Delete Signed Contract',
    description: 'Permanently deletes a legal contract agreement.',
    version: '1.0.0',
    domain: 'crm_contacts',
    operation: 'delete',
    permissions: ['app:contracts_delete'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L4_PRIVILEGED_DESTRUCTIVE',
      destructive: true,
      idempotent: false,
      openWorld: false,
      requiresHumanApproval: true,
      nonDelegable: true,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 5000,
      supportsDryRun: true,
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
    handler: async () => {
      executionOccurred = true;
      return {
        success: true,
        data: { deleted: true },
        executionId: 'ex_del',
        emittedEvents: [],
        durationMs: 10,
      };
    },
  };

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
    executionOccurred = false;

    registryStore = createCapabilityRegistryStore();
    registryStore.register(mockFindContact);
    registryStore.register(mockCreateNote);
    registryStore.register(mockDeleteContract);

    engine = new ShadowSimulationEngine({
      capabilityRegistry: registryStore,
    });
  });

  describe('Simulation & Interception (Rule 42)', () => {
    it('intercepts mutating capabilities without executing live handlers and computes blast radius', async () => {
      const plan: ExecutionPlan = {
        planId: 'plan_sim_1',
        version: 1,
        rationale: 'Find contact and add risk note',
        estimatedTokens: 250,
        createdAt: new Date().toISOString(),
        steps: [
          {
            stepId: 'step_1',
            stepIndex: 0,
            title: 'Search Contact',
            type: 'tool_call',
            capabilityId: 'crm.find_contact',
            arguments: { name: 'Acme' },
            dependsOnStepIds: [],
            isNonDelegable: false,
            timeoutMs: 30000,
          },
          {
            stepId: 'step_2',
            stepIndex: 1,
            title: 'Create Risk Note',
            type: 'tool_call',
            capabilityId: 'crm.create_note',
            arguments: { body: 'Shadow risk note' },
            dependsOnStepIds: ['step_1'],
            expectedStateChange: 'New note created in CRM',
            isNonDelegable: false,
            timeoutMs: 30000,
          },
        ],
      };

      const report = await engine.simulate({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        plan,
        personaId: 'lead_sdr',
      });

      // 1. Invariant: live mutating handler was NOT called
      expect(executionOccurred).toBe(false);

      // 2. Report analysis
      expect(report.totalSteps).toBe(2);
      expect(report.stepResults).toHaveLength(2);
      expect(report.stepResults[0].simulatedAction).toBe('executed_read');
      expect(report.stepResults[1].simulatedAction).toBe('intercepted_mutation');
      expect(report.stepResults[1].simulated).toBe(true);

      // 3. Blast radius analysis
      expect(report.blastRadius.totalMutationsIntercepted).toBe(1);
      expect(report.blastRadius.highRiskOperationsCount).toBe(0);
      expect(report.blastRadius.nonDelegableOperationsCount).toBe(0);
      expect(report.blastRadius.overallRiskCategory).toBe('medium');
      expect(report.isSafeForExecution).toBe(true);
    });

    it('correctly flags L4 destructive and non-delegable operations as critical blast radius', async () => {
      const plan: ExecutionPlan = {
        planId: 'plan_critical',
        version: 1,
        rationale: 'Delete agreement',
        estimatedTokens: 150,
        createdAt: new Date().toISOString(),
        steps: [
          {
            stepId: 'step_del',
            stepIndex: 0,
            title: 'Delete Contract',
            type: 'tool_call',
            capabilityId: 'contracts.delete',
            arguments: { contractId: 'ctr_999' },
            dependsOnStepIds: [],
            isNonDelegable: true,
            timeoutMs: 30000,
          },
        ],
      };

      const report = await engine.simulate({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        plan,
        personaId: 'lead_sdr',
      });

      expect(executionOccurred).toBe(false);
      expect(report.blastRadius.totalMutationsIntercepted).toBe(1);
      expect(report.blastRadius.highRiskOperationsCount).toBe(1);
      expect(report.blastRadius.nonDelegableOperationsCount).toBe(1);
      expect(report.blastRadius.overallRiskCategory).toBe('critical');
      // Destructive non-delegable operations require explicit human approval before live run
      expect(report.stepResults[0].requiresHumanApproval).toBe(true);
      expect(report.stepResults[0].isNonDelegable).toBe(true);
    });

    it('rejects execution plans with circular dependencies (Rule 47)', async () => {
      const cyclicPlan: ExecutionPlan = {
        planId: 'plan_cycle',
        version: 1,
        rationale: 'Circular plan',
        estimatedTokens: 100,
        createdAt: new Date().toISOString(),
        steps: [
          {
            stepId: 'step_a',
            stepIndex: 0,
            title: 'Step A',
            type: 'tool_call',
            capabilityId: 'crm.find_contact',
            dependsOnStepIds: ['step_b'],
            isNonDelegable: false,
            timeoutMs: 30000,
          },
          {
            stepId: 'step_b',
            stepIndex: 1,
            title: 'Step B',
            type: 'tool_call',
            capabilityId: 'crm.find_contact',
            dependsOnStepIds: ['step_a'],
            isNonDelegable: false,
            timeoutMs: 30000,
          },
        ],
      };

      await expect(
        engine.simulate({
          organizationId: 'org_acme',
          workspaceId: 'ws_sales',
          plan: cyclicPlan,
          personaId: 'lead_sdr',
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });

    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      setGovernanceDeadManStateForTests(true);

      const plan: ExecutionPlan = {
        planId: 'plan_under_pause',
        version: 1,
        rationale: 'Plan under pause',
        estimatedTokens: 100,
        createdAt: new Date().toISOString(),
        steps: [
          {
            stepId: 'step_read',
            stepIndex: 0,
            title: 'Read step',
            type: 'tool_call',
            capabilityId: 'crm.find_contact',
            dependsOnStepIds: [],
            isNonDelegable: false,
            timeoutMs: 30000,
          },
        ],
      };

      await expect(
        engine.simulate({
          organizationId: 'org_acme',
          workspaceId: 'ws_sales',
          plan,
          personaId: 'lead_sdr',
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });
  });
});
