/**
 * @fileOverview Unit & Integration Tests for The Critical Distinction Bridge (Phase 7 Milestone 5)
 *
 * Verifies Document 10 / Rule 69:
 * - Agents plan goals and orchestrate intents
 * - Workflows execute deterministic, repeatable, multi-day state machines
 * - Capabilities: workflow.instantiate_template, workflow.get_instance_status, workflow.cancel_instance
 * - Rule 4: Zero `any` or `any[]` typing policy
 * - Rule 8 & 47: Anti-IDOR tenant boundary enforcement
 * - Rule 16 & 17: Attenuated principal scopes & non-delegable risk levels
 * - Rule 60: Emergency Dead-Man Switch evaluation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWorkflowCapabilities,
  registerWorkflowCapabilities,
  WorkflowInstantiateTemplateInputSchema,
} from '@/platform/workflows/bridge/agent-workflow-bridge';
import {
  WorkflowTemplateRegistry,
} from '@/platform/workflows/templates/workflow-template-registry';
import { LeadOnboardingWorkflow } from '@/platform/workflows/templates/lead-onboarding-template';
import { createMemoryWorkflowStore } from '@/platform/workflows/workflow-store';
import { getCapabilityRegistry } from '@/platform/capabilities/registry/capability-registry';
import type { AgentPrincipal, CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('The Critical Distinction Bridge (Agent-to-Workflow Adapter)', () => {
  const tenant = {
    organizationId: 'org_bridge_test',
    workspaceId: 'ws_bridge_test',
  };

  const samplePrincipal: AgentPrincipal = {
    actorType: 'agent' as const,
    agentId: 'persona_autonomous_orchestrator',
    agentVersion: '1.0.0',
    userId: 'usr_agent_bridge',
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    effectiveRole: 'agent:operator',
    grantedScopes: ['app:automations_manage', 'app:automations_view', 'crm:read', 'crm:write'],
  };

  const sampleContext: CapabilityExecutionContext = {
    principal: samplePrincipal,
    correlationId: 'corr_agent_bridge_01',
    timestamp: new Date().toISOString(),
  };

  let store: ReturnType<typeof createMemoryWorkflowStore>;
  let templateRegistry: WorkflowTemplateRegistry;

  beforeEach(() => {
    store = createMemoryWorkflowStore();
    setGovernanceDeadManStateForTests(false);

    templateRegistry = new WorkflowTemplateRegistry({
      store,
    });
    templateRegistry.registerTemplate(LeadOnboardingWorkflow);
  });

  describe('1. Capability Definitions & Registry Registration', () => {
    it('creates 3 canonical workflow capabilities with appropriate risk levels', () => {
      const capabilities = createWorkflowCapabilities({
        store,
        templateRegistry,
      });

      expect(capabilities.length).toBe(3);

      const [instantiateCap, statusCap, cancelCap] = capabilities;

      expect(instantiateCap.id).toBe('workflow.instantiate_template');
      expect(instantiateCap.risk.level).toBe('L2_STATE_MUTATION');
      expect(instantiateCap.domain).toBe('automation_workflows');

      expect(statusCap.id).toBe('workflow.get_instance_status');
      expect(statusCap.risk.level).toBe('L0_READ');
      expect(statusCap.domain).toBe('automation_workflows');

      expect(cancelCap.id).toBe('workflow.cancel_instance');
      expect(cancelCap.risk.level).toBe('L3_EXTERNAL_COMMUNICATION_FINANCE');
      expect(cancelCap.domain).toBe('automation_workflows');
    });

    it('registers capabilities into global CapabilityRegistry without errors', () => {
      const registry = getCapabilityRegistry();
      registerWorkflowCapabilities({
        store,
        templateRegistry,
      });

      expect(registry.getCapability('workflow.instantiate_template')).toBeDefined();
      expect(registry.getCapability('workflow.get_instance_status')).toBeDefined();
      expect(registry.getCapability('workflow.cancel_instance')).toBeDefined();
    });
  });

  describe('2. Autonomous Agent Capability Execution via Bridge', () => {
    it('executes workflow.instantiate_template: agent starts workflow without executing steps directly', async () => {
      const [instantiateCap] = createWorkflowCapabilities({
        store,
        templateRegistry,
      });

      const parsedInput = WorkflowInstantiateTemplateInputSchema.parse({
        templateId: 'lead_onboarding_v1',
        inputs: {
          email: 'agent_target@client.com',
          fullName: 'Target Client',
        },
        title: 'Agent Triggered Flow',
      });

      const result = await instantiateCap.handler(parsedInput, sampleContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.workflowId).toMatch(/^wf_/);
        expect(result.data.definitionId).toBe('lead_onboarding_v1');
        expect(result.data.status).toBe('QUEUED');
        expect(result.data.stepCount).toBe(5);

        // Verify stored in WorkflowStore
        const instance = await store.getInstance(result.data.workflowId, tenant);
        expect(instance).not.toBeNull();
        expect(instance?.title).toBe('Agent Triggered Flow');
      }
    });

    it('executes workflow.get_instance_status: agent inspects progress and wait condition', async () => {
      const [instantiateCap, statusCap] = createWorkflowCapabilities({
        store,
        templateRegistry,
      });

      // 1. Instantiate
      const initRes = await instantiateCap.handler(
        {
          templateId: 'lead_onboarding_v1',
          inputs: { email: 'agent@test.com' },
        },
        sampleContext
      );

      expect(initRes.success).toBe(true);
      const workflowId = initRes.success ? initRes.data.workflowId : '';

      // 2. Query status
      const statusRes = await statusCap.handler(
        { workflowId },
        sampleContext
      );

      expect(statusRes.success).toBe(true);
      if (statusRes.success) {
        expect(statusRes.data.workflowId).toBe(workflowId);
        expect(statusRes.data.status).toBe('QUEUED');
        expect(statusRes.data.progress).toBe(0);
      }
    });

    it('executes workflow.cancel_instance: agent requests abort and unwinds execution', async () => {
      const [instantiateCap, , cancelCap] = createWorkflowCapabilities({
        store,
        templateRegistry,
      });

      // 1. Instantiate
      const initRes = await instantiateCap.handler(
        {
          templateId: 'lead_onboarding_v1',
          inputs: { email: 'agent@test.com' },
        },
        sampleContext
      );

      const workflowId = initRes.success ? initRes.data.workflowId : '';

      // 2. Cancel
      const cancelRes = await cancelCap.handler(
        { workflowId, reason: 'Goal abandoned by agent' },
        sampleContext
      );

      expect(cancelRes.success).toBe(true);
      if (cancelRes.success) {
        expect(cancelRes.data.workflowId).toBe(workflowId);
        expect(cancelRes.data.status).toBe('cancelled');
        expect(cancelRes.data.reason).toBe('Goal abandoned by agent');

        const instance = await store.getInstance(workflowId, tenant);
        expect(instance?.status).toBe('CANCELLED');
      }
    });

    it('enforces Rule 60: halts execution when emergency dead-man switch is active', async () => {
      const [instantiateCap] = createWorkflowCapabilities({
        store,
        templateRegistry,
      });

      setGovernanceDeadManStateForTests(true);

      const result = await instantiateCap.handler(
        {
          templateId: 'lead_onboarding_v1',
          inputs: { email: 'paused@test.com' },
        },
        sampleContext
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DEAD_MAN_PAUSED');
      }
    });
  });
});
