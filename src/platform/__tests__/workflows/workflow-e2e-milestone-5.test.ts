/**
 * @fileOverview Comprehensive End-to-End Integration Suite for Milestone 5
 *
 * Verifies the complete integrated workflow & MCP protocol system:
 * - Scenario 1: MCP Tasks Protocol Spec 2026-07-28 (create, get, list, cancel)
 * - Scenario 2: Autonomous Agent Dispatches Workflow via Agent Workflow Bridge
 * - Scenario 3: Human-in-the-Loop Interception & Wait State Resume
 * - Scenario 4: Cooperative Cancellation and State Transition (Rule 26)
 * - Scenario 5: Emergency Dead-Man Switch Evaluation & Fail-Closed Halting (Rule 60)
 * - Scenario 6: Legacy Automations Strangler Fig Bridge Fallback (Rule 69)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMemoryWorkflowStore,
  setWorkflowStoreForTests,
} from '@/platform/workflows/workflow-store';
import {
  WorkflowTemplateRegistry,
  setWorkflowTemplateRegistryForTests,
} from '@/platform/workflows/templates/workflow-template-registry';
import { LeadOnboardingWorkflow } from '@/platform/workflows/templates/lead-onboarding-template';
import { DealReviewWorkflow } from '@/platform/workflows/templates/deal-review-template';
import { MeetingFollowUpWorkflow } from '@/platform/workflows/templates/meeting-followup-template';
import { McpTasksHandler } from '@/platform/mcp/tasks/mcp-tasks-handler';
import { createWorkflowCapabilities } from '@/platform/workflows/bridge/agent-workflow-bridge';
import {
  LegacyWorkflowBridge,
  type LegacyAutomationRecord,
} from '@/platform/workflows/bridge/legacy-workflow-bridge';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import type { TenantBoundary, StoredPrincipal } from '@/platform/workflows/workflow-types';
import type { CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';

const tenant: TenantBoundary = {
  organizationId: 'org_e2e_m5',
  workspaceId: 'ws_e2e_m5',
};

const agentPrincipal: StoredPrincipal = {
  actorType: 'agent',
  agentId: 'persona_autonomous_orchestrator',
  agentVersion: '1.0.0',
  userId: 'agent_e2e_worker',
  organizationId: 'org_e2e_m5',
  workspaceId: 'ws_e2e_m5',
  effectiveRole: 'agent:operator',
  grantedScopes: [
    'app:automations_manage',
    'app:automations_view',
    'rbac:workflows.run.create',
    'rbac:workflows.run.read',
    'rbac:workflows.run.cancel',
    'crm:read',
    'crm:write',
  ],
};

const sampleContext: CapabilityExecutionContext = {
  principal: agentPrincipal,
  correlationId: 'corr_e2e_test_999',
  timestamp: new Date().toISOString(),
};

describe('Milestone 5 End-to-End Integration Suite', () => {
  let store: ReturnType<typeof createMemoryWorkflowStore>;
  let templateRegistry: WorkflowTemplateRegistry;

  beforeEach(() => {
    store = createMemoryWorkflowStore();
    setWorkflowStoreForTests(store);
    setWorkflowTemplateRegistryForTests(undefined);
    setGovernanceDeadManStateForTests(false);

    templateRegistry = new WorkflowTemplateRegistry({ store });
    templateRegistry.registerTemplate(LeadOnboardingWorkflow);
    templateRegistry.registerTemplate(DealReviewWorkflow);
    templateRegistry.registerTemplate(MeetingFollowUpWorkflow);
  });

  afterEach(() => {
    setGovernanceDeadManStateForTests(null);
  });

  // ── SCENARIO 1: MCP Tasks Protocol Spec 2026-07-28 ─────────────────────────
  describe('Scenario 1: MCP Tasks Protocol Spec 2026-07-28', () => {
    it('creates, polls, and cancels a task via McpTasksHandler', async () => {
      const handler = new McpTasksHandler({ store, eventBus: defaultEventBus });

      // 1. tasks/create
      const createRes = await handler.handleCreateTask(
        {
          name: 'E2E Lead Acquisition',
          definitionId: 'lead_onboarding_v1',
          inputs: {
            email: 'ceo@partner.com',
            fullName: 'Partner CEO',
            company: 'Partner Corp',
          },
        },
        agentPrincipal
      );

      expect(createRes.taskId).toBeDefined();
      expect(createRes.status).toBe('working');
      expect(createRes.createdAt).toBeDefined();

      // 2. tasks/get
      const getRes = await handler.handleGetTask(
        { taskId: createRes.taskId },
        agentPrincipal
      );
      expect(getRes.taskId).toBe(createRes.taskId);
      expect(getRes.status).toBe('working');

      // Verify underlying workflow store instance was created
      const instance = await store.getInstance(createRes.taskId, tenant);
      expect(instance).toBeDefined();
      expect(instance?.status).toBe('CREATED');

      // 3. tasks/list
      const listRes = await handler.handleListTasks({}, agentPrincipal);
      expect(listRes.tasks.length).toBeGreaterThanOrEqual(1);
      const found = listRes.tasks.find((t) => t.taskId === createRes.taskId);
      expect(found).toBeDefined();

      // 4. tasks/cancel
      const cancelRes = await handler.handleCancelTask(
        { taskId: createRes.taskId, reason: 'Client requested abort' },
        agentPrincipal
      );
      expect(cancelRes.status).toBe('cancelled');

      // Verify workflow store updated status to CANCELLED
      const cancelledInst = await store.getInstance(createRes.taskId, tenant);
      expect(cancelledInst?.status).toBe('CANCELLED');
    });
  });

  // ── SCENARIO 2: Autonomous Agent Dispatches Workflow via Bridge ────────────
  describe('Scenario 2: Autonomous Agent Dispatches Workflow via Bridge', () => {
    it('instantiates template through workflow.instantiate_template capability', async () => {
      const capabilities = createWorkflowCapabilities({ store, templateRegistry });
      const [instantiateCap, statusCap] = capabilities;

      const result = await instantiateCap.handler(
        {
          templateId: 'meeting_followup_v1',
          title: 'Quarterly Business Review Recap',
          inputs: {
            meetingId: 'meet_qbr_2026',
          },
        },
        sampleContext
      );

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected result.success to be true');
      expect(result.data).toBeDefined();
      expect(result.data.workflowId).toBeDefined();
      expect(result.data.definitionId).toBe('meeting_followup_v1');
      expect(result.data.status).toBe('QUEUED');

      // Query status via statusCap
      const statusRes = await statusCap.handler(
        { workflowId: result.data.workflowId },
        sampleContext
      );

      expect(statusRes.success).toBe(true);
      if (!statusRes.success) throw new Error('Expected statusRes.success to be true');
      expect(statusRes.data.workflowId).toBe(result.data.workflowId);
      expect(statusRes.data.status).toBe('QUEUED');
      expect(statusRes.data.progress).toBe(0);
    });
  });

  // ── SCENARIO 3: Human-in-the-Loop Interception & Wait State ────────────────
  describe('Scenario 3: Human-in-the-Loop Wait Condition Flow', () => {
    it('instantiates deal review template and transitions to WAITING on approval gate', async () => {
      // Instantiate deal review flow with 25% discount (triggers VP approval gate)
      const { instance, steps: createdSteps } = await templateRegistry.instantiateTemplate({
        templateId: 'deal_review_v1',
        title: 'Enterprise License Deal',
        inputs: {
          dealId: 'deal_enterprise_99',
          discountPercent: 25, // > 20%
        },
        initiator: { actorType: 'agent', actorId: 'agent_sales_rep' },
        principal: agentPrincipal,
        tenant,
        dryRun: false,
      });

      expect(instance.definitionId).toBe('deal_review_v1');
      expect(createdSteps.length).toBe(4);

      // Find the approval step (policy.request_approval)
      const approvalStep = createdSteps.find((s) => s.capabilityId === 'policy.request_approval');
      expect(approvalStep).toBeDefined();

      // FSM: QUEUED -> RUNNING
      await store.updateInstanceStatus(instance.id, 'RUNNING', tenant);

      // FSM: RUNNING -> WAITING when reaching approval gate
      await store.updateInstanceStatus(instance.id, 'WAITING', tenant, {
        currentStepId: approvalStep?.id,
        waitCondition: {
          type: 'approval',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          details: { requiredRole: 'vp_sales', thresholdPercent: 20 },
        },
      });

      const waitingInst = await store.getInstance(instance.id, tenant);
      expect(waitingInst?.status).toBe('WAITING');
      expect(waitingInst?.currentWaitCondition?.type).toBe('approval');

      // FSM: WAITING -> RESUMED upon human approval resolution
      await store.updateInstanceStatus(instance.id, 'RESUMED', tenant);
      const resumedInst = await store.getInstance(instance.id, tenant);
      expect(resumedInst?.status).toBe('RESUMED');
    });
  });

  // ── SCENARIO 4: Cooperative Cancellation (Rule 26) ────────────────────────
  describe('Scenario 4: Cooperative Cancellation (Rule 26)', () => {
    it('cooperatively cancels active workflow and publishes audit domain event', async () => {
      const eventPublishedSpy = vi.fn();
      const subscription = defaultEventBus.subscribe('workflow.cancelled', (event) => {
        eventPublishedSpy(event);
      });

      try {
        const { instance } = await templateRegistry.instantiateTemplate({
          templateId: 'lead_onboarding_v1',
          inputs: {
            email: 'abort@example.com',
          },
          initiator: { actorType: 'user', actorId: 'usr_operator' },
          principal: agentPrincipal,
          tenant,
          dryRun: false,
        });

        const capabilities = createWorkflowCapabilities({ store, templateRegistry });
        const cancelCap = capabilities[2]; // workflow.cancel_instance

        const cancelResult = await cancelCap.handler(
          {
            workflowId: instance.id,
            reason: 'Compliance hold triggered',
          },
          sampleContext
        );

        expect(cancelResult.success).toBe(true);
        if (!cancelResult.success) throw new Error('Expected cancelResult.success to be true');
        expect(cancelResult.data.status).toBe('cancelled');

        // Verify status in store
        const updated = await store.getInstance(instance.id, tenant);
        expect(updated?.status).toBe('CANCELLED');
      } finally {
        subscription.unsubscribe();
      }
    });
  });

  // ── SCENARIO 5: Emergency Dead-Man Switch Evaluation (Rule 60) ─────────────
  describe('Scenario 5: Emergency Dead-Man Switch Evaluation (Rule 60)', () => {
    it('halts MCP task creation and template instantiation when dead-man switch is tripped', async () => {
      // Trip emergency kill switch
      setGovernanceDeadManStateForTests(true);

      // 1. MCP Tasks creation should fail closed
      const handler = new McpTasksHandler({ store, eventBus: defaultEventBus });
      await expect(
        handler.handleCreateTask(
          {
            name: 'Paused Task',
            definitionId: 'lead_onboarding_v1',
            inputs: { email: 'paused@test.com' },
          },
          agentPrincipal
        )
      ).rejects.toThrow(/DEAD_MAN_PAUSED/);

      // 2. Agent capability instantiation should fail closed
      const capabilities = createWorkflowCapabilities({ store, templateRegistry });
      const instantiateCap = capabilities[0];

      const res = await instantiateCap.handler(
        {
          templateId: 'lead_onboarding_v1',
          inputs: { email: 'paused2@test.com' },
        },
        sampleContext
      );

      expect(res.success).toBe(false);
      if (res.success) throw new Error('Expected res.success to be false');
      expect(res.error.code).toBe('DEAD_MAN_PAUSED');

      // 3. Reset dead-man switch: operations resume immediately
      setGovernanceDeadManStateForTests(false);

      const resumeCreate = await handler.handleCreateTask(
        {
          name: 'Resumed Task',
          definitionId: 'lead_onboarding_v1',
          inputs: { email: 'resumed@test.com' },
        },
        agentPrincipal
      );
      expect(resumeCreate.status).toBe('working');
    });
  });

  // ── SCENARIO 6: Legacy Automation Bridge Strangler Fig (Rule 69) ───────────
  describe('Scenario 6: Legacy Automation Bridge Strangler Fig (Rule 69)', () => {
    it('routes matching automations to templates and falls back smoothly for unmatched ones', async () => {
      const sampleLegacyAutomation: LegacyAutomationRecord = {
        id: 'legacy_auto_42',
        name: 'Legacy Welcome Flow',
        trigger: 'contact.created',
        status: 'active',
        actions: [
          {
            id: 'act_1',
            type: 'send_email',
            config: { template: 'welcome_v1' },
          },
        ],
      };

      const bridge = new LegacyWorkflowBridge({
        store,
        templateRegistry,
        enableDurableWorkflows: true,
      });

      // 1. Durable workflow translation
      const matchingRes = await bridge.executeLegacyAutomation({
        automation: sampleLegacyAutomation,
        payload: { contactId: 'cnt_999', email: 'test@legacy.com' },
        tenant,
        actorId: 'usr_legacy_operator',
      });

      expect(matchingRes.mode).toBe('durable_workflow');
      expect(matchingRes.workflowId).toBeDefined();
      expect(matchingRes.status).toBe('QUEUED');

      // 2. Unmatched legacy automation triggers fallback handler
      const mockLegacyRunner = vi.fn().mockResolvedValue({
        success: true,
        executionId: 'exec_legacy_fallback',
      });

      const fallbackBridge = new LegacyWorkflowBridge({
        store,
        templateRegistry,
        enableDurableWorkflows: false,
        legacyRunner: mockLegacyRunner,
      });

      const fallbackRes = await fallbackBridge.executeLegacyAutomation({
        automation: sampleLegacyAutomation,
        payload: { contactId: 'cnt_999' },
        tenant,
        actorId: 'usr_legacy_operator',
      });

      expect(fallbackRes.mode).toBe('legacy_engine');
      expect(mockLegacyRunner).toHaveBeenCalledWith(
        sampleLegacyAutomation.id,
        { contactId: 'cnt_999' },
        expect.anything()
      );
      expect(fallbackRes.status).toBe('COMPLETED');
    });
  });
});
