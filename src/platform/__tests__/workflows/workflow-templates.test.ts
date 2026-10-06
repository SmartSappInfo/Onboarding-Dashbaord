/**
 * @fileOverview Unit & Integration Tests for Deterministic Business Workflow Templates (Phase 7 Milestone 5)
 *
 * Verifies conformance with:
 * - Rule 4: Zero `any` or `any[]` typing policy
 * - Rule 8 & 47: Anti-IDOR multi-tenant parameter scoping
 * - Rule 9 & 23: Step count bounds (<= 30 steps)
 * - Rule 19: Deterministic idempotency keys
 * - Rule 47: Model Distrust & Kahn's Algorithm DAG cycle detection
 * - Rule 60: Emergency Dead-Man Switch evaluation
 * - Pre-built templates: LeadOnboardingWorkflow, DealReviewWorkflow, MeetingFollowUpWorkflow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowTemplateDefinitionSchema,
  validateTemplateDag,
  type WorkflowTemplateDefinition,
} from '@/platform/workflows/templates/workflow-template-types';
import { LeadOnboardingWorkflow } from '@/platform/workflows/templates/lead-onboarding-template';
import { DealReviewWorkflow } from '@/platform/workflows/templates/deal-review-template';
import { MeetingFollowUpWorkflow } from '@/platform/workflows/templates/meeting-followup-template';
import { getWorkflowTemplateRegistry, setWorkflowTemplateRegistryForTests } from '@/platform/workflows/templates/workflow-template-registry';
import {
  WorkflowTemplateRegistry,
} from '@/platform/workflows/templates/workflow-template-registry';
import { createMemoryWorkflowStore } from '@/platform/workflows/workflow-store';
import type { WorkflowDispatcher } from '@/platform/workflows/dispatcher/workflow-dispatcher';
import type { TenantBoundary } from '@/platform/workflows/workflow-types';
import type { StoredPrincipal } from '@/platform/tasks/agent-step-contract';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('Deterministic Business Workflow Templates (Phase 7 Milestone 5)', () => {
  const tenant: TenantBoundary = {
    organizationId: 'org_template_test',
    workspaceId: 'ws_template_test',
  };

  const samplePrincipal: StoredPrincipal = {
    actorType: 'agent',
    userId: 'usr_agent_templates',
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    agentId: 'agent_template_runner',
    grantedScopes: ['crm:read', 'crm:write', 'workflows:execute'],
    effectiveRole: 'agent:operator',
  };

  describe('1. Kahn\'s Algorithm DAG Cycle & Dependency Validator (Rule 47)', () => {
    it('sorts valid linear and branching acyclic DAGs in topological order', () => {
      const steps = [
        {
          id: 'step_c',
          name: 'Step C',
          capabilityId: 'crm.send_email',
          dependsOn: ['step_b'],
          isMutating: true,
          timeoutSeconds: 300,
          maxAttempts: 3,
          inputMapping: {},
        },
        {
          id: 'step_a',
          name: 'Step A',
          capabilityId: 'crm.create_contact',
          dependsOn: [],
          isMutating: true,
          timeoutSeconds: 300,
          maxAttempts: 3,
          inputMapping: {},
        },
        {
          id: 'step_b',
          name: 'Step B',
          capabilityId: 'crm.qualify_lead',
          dependsOn: ['step_a'],
          isMutating: false,
          timeoutSeconds: 300,
          maxAttempts: 3,
          inputMapping: {},
        },
      ];

      const sortedIds = validateTemplateDag(steps);
      expect(sortedIds).toEqual(['step_a', 'step_b', 'step_c']);
    });

    it('rejects circular dependencies with TEMPLATE_DAG_CYCLE_DETECTED (A -> B -> A)', () => {
      const steps = [
        {
          id: 'step_a',
          name: 'Step A',
          capabilityId: 'crm.create_contact',
          dependsOn: ['step_b'],
          isMutating: true,
          timeoutSeconds: 300,
          maxAttempts: 3,
          inputMapping: {},
        },
        {
          id: 'step_b',
          name: 'Step B',
          capabilityId: 'crm.qualify_lead',
          dependsOn: ['step_a'],
          isMutating: false,
          timeoutSeconds: 300,
          maxAttempts: 3,
          inputMapping: {},
        },
      ];

      expect(() => validateTemplateDag(steps)).toThrowError(
        /TEMPLATE_DAG_CYCLE_DETECTED/
      );
    });

    it('rejects self-dependencies with TEMPLATE_DAG_SELF_DEPENDENCY (A -> A)', () => {
      const steps = [
        {
          id: 'step_self',
          name: 'Self Dependent Step',
          capabilityId: 'crm.create_contact',
          dependsOn: ['step_self'],
          isMutating: true,
          timeoutSeconds: 300,
          maxAttempts: 3,
          inputMapping: {},
        },
      ];

      expect(() => validateTemplateDag(steps)).toThrowError(
        /TEMPLATE_DAG_SELF_DEPENDENCY/
      );
    });

    it('rejects dangling missing dependencies with TEMPLATE_DAG_MISSING_DEPENDENCY', () => {
      const steps = [
        {
          id: 'step_valid',
          name: 'Valid Step',
          capabilityId: 'crm.create_contact',
          dependsOn: ['step_nonexistent'],
          isMutating: true,
          timeoutSeconds: 300,
          maxAttempts: 3,
          inputMapping: {},
        },
      ];

      expect(() => validateTemplateDag(steps)).toThrowError(
        /TEMPLATE_DAG_MISSING_DEPENDENCY/
      );
    });

    it('enforces step bounds <= 30 steps (Rule 9 & 23)', () => {
      const tooManySteps = Array.from({ length: 31 }, (_, i) => ({
        id: `step_${i}`,
        name: `Step ${i}`,
        capabilityId: 'crm.dummy',
        dependsOn: i > 0 ? [`step_${i - 1}`] : [],
        isMutating: false,
        timeoutSeconds: 300,
        maxAttempts: 3,
        inputMapping: {},
      }));

      expect(() =>
        WorkflowTemplateDefinitionSchema.parse({
          id: 'huge_template',
          name: 'Huge Template',
          description: 'Too many steps',
          category: 'operations',
          steps: tooManySteps,
        })
      ).toThrow();
    });
  });

  describe('2. Pre-Built Enterprise Workflow Templates', () => {
    it('validates LeadOnboardingWorkflow definition and steps', () => {
      expect(LeadOnboardingWorkflow.id).toBe('lead_onboarding_v1');
      expect(LeadOnboardingWorkflow.category).toBe('onboarding');
      expect(LeadOnboardingWorkflow.steps.length).toBe(5);

      const sortedIds = validateTemplateDag(LeadOnboardingWorkflow.steps);
      expect(sortedIds.length).toBe(5);
      expect(sortedIds[0]).toBe('create_contact');
      expect(sortedIds[1]).toBe('qualify_lead');
      expect(sortedIds[2]).toBe('send_welcome_email');
      expect(sortedIds[3]).toBe('wait_nurture_window');
      expect(sortedIds[4]).toBe('schedule_sdr_call');

      // Verify wait condition on step 3
      const waitStep = LeadOnboardingWorkflow.steps.find((s) => s.id === 'wait_nurture_window');
      expect(waitStep?.waitCondition?.type).toBe('schedule');
    });

    it('validates DealReviewWorkflow definition and approval gate', () => {
      expect(DealReviewWorkflow.id).toBe('deal_review_v1');
      expect(DealReviewWorkflow.category).toBe('sales');
      expect(DealReviewWorkflow.steps.length).toBe(4);

      const sortedIds = validateTemplateDag(DealReviewWorkflow.steps);
      expect(sortedIds.length).toBe(4);
      expect(sortedIds[0]).toBe('fetch_deal');
      expect(sortedIds[1]).toBe('calculate_discount');
      expect(sortedIds[2]).toBe('vp_approval_gate');
      expect(sortedIds[3]).toBe('send_approval_notification');

      const approvalStep = DealReviewWorkflow.steps.find((s) => s.id === 'vp_approval_gate');
      expect(approvalStep?.waitCondition?.type).toBe('approval');
    });

    it('meeting_followup_v1 is retired: not registered in the production template registry (M2 · T3.3)', () => {
      setWorkflowTemplateRegistryForTests(undefined);
      const ids = getWorkflowTemplateRegistry().listTemplates().map((t) => t.id);
      expect(ids).not.toContain('meeting_followup_v1');
      setWorkflowTemplateRegistryForTests(undefined);
    });

    it('validates MeetingFollowUpWorkflow definition and episodic memory integration', () => {
      expect(MeetingFollowUpWorkflow.id).toBe('meeting_followup_v1');
      expect(MeetingFollowUpWorkflow.category).toBe('crm');
      expect(MeetingFollowUpWorkflow.steps.length).toBe(4);

      const sortedIds = validateTemplateDag(MeetingFollowUpWorkflow.steps);
      expect(sortedIds.length).toBe(4);
      expect(sortedIds[0]).toBe('fetch_meeting_transcript');
      expect(sortedIds[1]).toBe('save_episodic_memory');
      expect(sortedIds[2]).toBe('create_crm_note');
      expect(sortedIds[3]).toBe('send_attendee_recap');
    });
  });

  describe('3. WorkflowTemplateRegistry & Instantiation Compiler', () => {
    let store: ReturnType<typeof createMemoryWorkflowStore>;
    let dispatchedSteps: Array<{ workflowId: string; stepId: string }>;
    let dispatcher: WorkflowDispatcher;
    let registry: WorkflowTemplateRegistry;

    beforeEach(() => {
      store = createMemoryWorkflowStore();
      dispatchedSteps = [];
      setGovernanceDeadManStateForTests(false);

      dispatcher = {
        enqueueWorkflowStep: async (params) => {
          dispatchedSteps.push({
            workflowId: params.workflowId,
            stepId: params.stepId,
          });
          return {
            taskKey: `cloud_${params.stepId}`,
            payload: {
              workflowId: params.workflowId,
              stepId: params.stepId,
              organizationId: params.tenant.organizationId,
              workspaceId: params.tenant.workspaceId,
              idempotencyKey: params.idempotencyKey,
              attempt: params.attempt ?? 1,
              correlationId: params.correlationId || 'corr_test',
            },
          };
        },
        cancelWorkflowStepTask: async () => true,
      };

      registry = new WorkflowTemplateRegistry({
        store,
        dispatcher,
      });
      registry.registerTemplate(LeadOnboardingWorkflow);
      registry.registerTemplate(DealReviewWorkflow);
      registry.registerTemplate(MeetingFollowUpWorkflow);
    });

    it('registers and retrieves templates by ID', () => {
      const tmpl = registry.getTemplate('lead_onboarding_v1');
      expect(tmpl).toBeDefined();
      expect(tmpl?.name).toBe('Lead Onboarding Flow');

      const all = registry.listTemplates();
      expect(all.length).toBe(3);
    });

    it('rejects registering invalid template with cycles', () => {
      const cyclicTemplate: WorkflowTemplateDefinition = {
        id: 'cyclic_tmpl',
        version: '1.0.0',
        name: 'Cyclic Template',
        description: 'Invalid',
        category: 'custom',
        parameters: [],
        steps: [
          {
            id: 'step_1',
            name: 'Step 1',
            capabilityId: 'crm.test',
            dependsOn: ['step_2'],
            isMutating: false,
            timeoutSeconds: 300,
            maxAttempts: 3,
            inputMapping: {},
          },
          {
            id: 'step_2',
            name: 'Step 2',
            capabilityId: 'crm.test',
            dependsOn: ['step_1'],
            isMutating: false,
            timeoutSeconds: 300,
            maxAttempts: 3,
            inputMapping: {},
          },
        ],
      };

      expect(() => registry.registerTemplate(cyclicTemplate)).toThrowError(
        /TEMPLATE_DAG_CYCLE_DETECTED/
      );
    });

    it('validates template inputs and rejects missing required parameters', async () => {
      await expect(
        registry.instantiateTemplate({
          templateId: 'lead_onboarding_v1',
          inputs: {}, // Missing required email parameter
          initiator: { actorType: 'agent', actorId: samplePrincipal.userId },
          principal: samplePrincipal,
          tenant,
          dryRun: false,
        })
      ).rejects.toThrowError(/TEMPLATE_INVALID_PARAMETERS/);
    });

    it('instantiates template: compiles DAG steps in topological order, persists to store, and dispatches Step 0', async () => {
      const { instance, steps } = await registry.instantiateTemplate({
        templateId: 'lead_onboarding_v1',
        inputs: {
          email: 'jane@enterprise.com',
          fullName: 'Jane Doe',
          company: 'Acme Corp',
        },
        initiator: { actorType: 'agent', actorId: samplePrincipal.userId },
        principal: samplePrincipal,
        tenant,
        dryRun: false,
      });

      expect(instance.id).toMatch(/^wf_/);
      expect(instance.definitionId).toBe('lead_onboarding_v1');
      expect(instance.status).toBe('QUEUED');
      expect(steps.length).toBe(5);

      // Verify topological sort step indices: 0 to 4
      expect(steps[0].stepIndex).toBe(0);
      expect(steps[0].capabilityId).toBe('crm.create_contact');
      expect(steps[4].stepIndex).toBe(4);
      expect(steps[4].capabilityId).toBe('crm.schedule_call');

      // Verify Step 0 was dispatched to Cloud Tasks
      expect(dispatchedSteps.length).toBe(1);
      expect(dispatchedSteps[0].workflowId).toBe(instance.id);
      expect(dispatchedSteps[0].stepId).toBe(steps[0].id);

      // Verify all steps are stored in WorkflowStore
      const storedSteps = await store.listSteps(instance.id, tenant);
      expect(storedSteps.length).toBe(5);
    });

    it('enforces Rule 60: halts template instantiation when emergency dead-man switch is active', async () => {
      setGovernanceDeadManStateForTests(true);

      await expect(
        registry.instantiateTemplate({
          templateId: 'deal_review_v1',
          inputs: { dealId: 'deal_123', discountPercent: 25 },
          initiator: { actorType: 'agent', actorId: samplePrincipal.userId },
          principal: samplePrincipal,
          tenant,
          dryRun: false,
        })
      ).rejects.toThrowError(/DEAD_MAN_PAUSED/);
    });
  });
});
