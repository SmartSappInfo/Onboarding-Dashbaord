/**
 * @fileOverview Agent Run Store Test Suite (Phase 6 Milestone 1)
 *
 * Implements Rule 4 (Strict Typing), Rule 8 & 47 (Multi-Tenant Isolation & Anti-IDOR),
 * Rule 9 (Resource Limits), Rule 19 (Idempotency), Rule 20 (Distributed Tracing),
 * Rule 23 (Budget Ceilings), Rule 26 (Cancellation), and Rule 40 (Audit Immutability).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMemoryAgentRunStore,
  type AgentRunStore,
} from '../../runtime/agent-run-store';
import {
  AgentRuntimeError,
  type ExecutionPlan,
  type AgentOutcome,
} from '../../runtime/agent-run-types';
import {
  publishAgentRunEvent,
  subscribeToAgentRuns,
} from '../../runtime/subscribers/agent-event-subscribers';
import { createEventBus } from '../../events/event-bus';
import type { DomainEvent } from '../../capabilities/events/domain-event';

describe('Agent Run Store & Multi-Tenant Persistence', () => {
  let store: AgentRunStore;

  beforeEach(async () => {
    store = createMemoryAgentRunStore();
    if (store.clearForTests) {
      await store.clearForTests();
    }
  });

  describe('Run Creation & Retrieval', () => {
    it('creates an agent run with default budgets and initial status', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'deal_coach',
        principalId: 'agent_deal_coach_1',
        authorizingUserId: 'user_sales_vp',
        triggerType: 'manual',
        goal: {
          prompt: 'Identify top pipeline risks for Q4',
          intent: 'deal_coaching',
        },
      });

      expect(run.runId).toMatch(/^run_/);
      expect(run.organizationId).toBe('org_acme');
      expect(run.workspaceId).toBe('ws_sales');
      expect(run.agentPersonaId).toBe('deal_coach');
      expect(run.status).toBe('created');
      expect(run.budgets.maxTokens).toBe(50000);
      expect(run.budgets.maxToolCalls).toBe(15);
      expect(run.budgets.maxDurationMs).toBe(120000);
      expect(run.budgetUsage.tokensUsed).toBe(0);
      expect(run.stateHistory).toHaveLength(1);
      expect(run.stateHistory[0].from).toBe('created');
    });

    it('sets initial status to queued when triggerType is scheduled', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'crm_researcher',
        principalId: 'agent_researcher_1',
        authorizingUserId: 'cron_scheduler',
        triggerType: 'scheduled',
        goal: {
          prompt: 'Nightly account sync and dossier refresh',
          intent: 'research',
        },
      });

      expect(run.status).toBe('queued');
      expect(run.stateHistory[0].from).toBe('queued');
    });

    it('allows custom budgets that override defaults within bounds (Rule 23)', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_1',
        authorizingUserId: 'user_sdr_mgr',
        goal: {
          prompt: 'Batch prospect research',
          intent: 'research',
        },
        customBudgets: {
          maxTokens: 80000,
          maxToolCalls: 30,
        },
      });

      expect(run.budgets.maxTokens).toBe(80000);
      expect(run.budgets.maxToolCalls).toBe(30);
      expect(run.budgets.maxDurationMs).toBe(120000); // kept default
    });

    it('retrieves run and enforces tenant isolation (Anti-IDOR, Rules 8 & 47)', async () => {
      const run = await store.createRun({
        organizationId: 'org_tenant_A',
        workspaceId: 'ws_alpha',
        agentPersonaId: 'portal_guide',
        principalId: 'agent_guide_1',
        authorizingUserId: 'user_alice',
        goal: {
          prompt: 'Explain lesson 4 concepts',
          intent: 'portal_guidance',
        },
      });

      // Tenant A can retrieve their run
      const fetched = await store.getRun('org_tenant_A', run.runId);
      expect(fetched).not.toBeNull();
      expect(fetched?.runId).toBe(run.runId);

      // Tenant B cannot retrieve Tenant A's run
      const forbidden = await store.getRun('org_tenant_B', run.runId);
      expect(forbidden).toBeNull();
    });
  });

  describe('State Transitions & Concurrency Guards', () => {
    it('executes valid state transitions and records history', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'deal_coach',
        principalId: 'agent_coach_1',
        authorizingUserId: 'user_mgr',
        goal: { prompt: 'Pipeline review' },
      });

      // created -> planning
      const planningRun = await store.updateRunStatus({
        runId: run.runId,
        organizationId: 'org_acme',
        fromStatus: 'created',
        toStatus: 'planning',
        reason: 'Autonomous planning started',
      });
      expect(planningRun.status).toBe('planning');
      expect(planningRun.startedAt).toBeDefined();

      // planning -> executing
      const executingRun = await store.updateRunStatus({
        runId: run.runId,
        organizationId: 'org_acme',
        fromStatus: 'planning',
        toStatus: 'executing',
        reason: 'Plan approved, beginning step execution',
      });
      expect(executingRun.status).toBe('executing');

      // executing -> verifying
      const verifyingRun = await store.updateRunStatus({
        runId: run.runId,
        organizationId: 'org_acme',
        fromStatus: 'executing',
        toStatus: 'verifying',
        reason: 'Steps completed, verifying post-conditions',
      });
      expect(verifyingRun.status).toBe('verifying');

      // verifying -> completed
      const completedRun = await store.updateRunStatus({
        runId: run.runId,
        organizationId: 'org_acme',
        fromStatus: 'verifying',
        toStatus: 'completed',
        reason: 'All checks passed',
      });
      expect(completedRun.status).toBe('completed');
      expect(completedRun.completedAt).toBeDefined();
      expect(completedRun.stateHistory).toHaveLength(5);
    });

    it('rejects update with CONCURRENCY_CONFLICT if current status does not match fromStatus', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'deal_coach',
        principalId: 'agent_coach_1',
        authorizingUserId: 'user_mgr',
        goal: { prompt: 'Review' },
      });

      await expect(
        store.updateRunStatus({
          runId: run.runId,
          organizationId: 'org_acme',
          fromStatus: 'executing', // Wrong! Actually 'created'
          toStatus: 'completed',
        })
      ).rejects.toThrowError(AgentRuntimeError);

      try {
        await store.updateRunStatus({
          runId: run.runId,
          organizationId: 'org_acme',
          fromStatus: 'executing',
          toStatus: 'completed',
        });
      } catch (e) {
        const err = e as AgentRuntimeError;
        expect(err.code).toBe('CONCURRENCY_CONFLICT');
      }
    });

    it('forbids mutating runs in terminal states (TERMINAL_STATE_IMMUTABLE)', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_1',
        authorizingUserId: 'user_mgr',
        goal: { prompt: 'Quick outreach' },
      });

      // created -> cancelled
      await store.updateRunStatus({
        runId: run.runId,
        organizationId: 'org_acme',
        toStatus: 'cancelled',
        reason: 'User aborted run',
      });

      // Attempting to transition from cancelled to executing must throw
      await expect(
        store.updateRunStatus({
          runId: run.runId,
          organizationId: 'org_acme',
          toStatus: 'executing',
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });
  });

  describe('Execution Plan Storage', () => {
    it('saves execution plan on active run and prevents saving on terminal run', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'meeting_prep',
        principalId: 'agent_prep_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Prep dossier for meeting with Acme' },
      });

      const plan: ExecutionPlan = {
        planId: 'plan_prep_1',
        version: 1,
        steps: [
          {
            stepId: 'step_1',
            stepIndex: 0,
            title: 'Fetch meeting attendees',
            type: 'tool_call',
            capabilityId: 'meetings.get_attendees',
            dependsOnStepIds: [],
            isNonDelegable: false,
            timeoutMs: 30000,
          },
        ],
        estimatedTokens: 2500,
        rationale: 'Fetch attendees before synthesizing dossiers',
        createdAt: new Date().toISOString(),
      };

      const withPlan = await store.saveExecutionPlan('org_acme', run.runId, plan);
      expect(withPlan.currentPlan?.planId).toBe('plan_prep_1');
      expect(withPlan.currentPlan?.steps).toHaveLength(1);

      // Cancel the run
      await store.updateRunStatus({
        runId: run.runId,
        organizationId: 'org_acme',
        toStatus: 'cancelled',
      });

      // Saving plan on cancelled run must fail
      await expect(
        store.saveExecutionPlan('org_acme', run.runId, plan)
      ).rejects.toThrowError(AgentRuntimeError);
    });
  });

  describe('Discrete Step Management (Subcollection Architecture, Rule 9)', () => {
    it('creates steps, lists steps chronologically, and updates step results', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'deal_coach',
        principalId: 'agent_coach_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Pipeline check' },
      });

      // Step 0: Context retrieval
      const step0 = await store.createStep('org_acme', run.runId, {
        runId: run.runId,
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        stepIndex: 0,
        type: 'context_retrieval',
        title: 'Retrieve deal history from CompanyBrain',
        idempotencyKey: 'idem_step_0_hash',
        correlationId: 'corr_test_123',
        input: { query: 'Acme deal stage history' },
      });

      expect(step0.stepIndex).toBe(0);
      expect(step0.status).toBe('running');
      expect(step0.idempotencyKey).toBe('idem_step_0_hash');

      // Step 1: Tool call
      const step1 = await store.createStep('org_acme', run.runId, {
        runId: run.runId,
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        stepIndex: 1,
        type: 'tool_call',
        title: 'Score deal risk probability',
        capabilityId: 'deals.score_risk',
        idempotencyKey: 'idem_step_1_hash',
        correlationId: 'corr_test_123',
        input: { dealId: 'deal_789' },
        compensatingCapabilityId: 'deals.revert_score',
      });
      expect(step1.stepIndex).toBe(1);

      // List steps - asserts order by stepIndex
      const steps = await store.listSteps('org_acme', run.runId);
      expect(steps).toHaveLength(2);
      expect(steps[0].stepIndex).toBe(0);
      expect(steps[1].stepIndex).toBe(1);

      // Complete step 0
      const completedStep0 = await store.updateStep({
        organizationId: 'org_acme',
        runId: run.runId,
        stepId: step0.stepId,
        status: 'completed',
        output: { factsCount: 5 },
        outputValidated: true,
        tokensUsed: 450,
        durationMs: 320,
      });

      expect(completedStep0.status).toBe('completed');
      expect(completedStep0.outputValidated).toBe(true);
      expect(completedStep0.tokensUsed).toBe(450);

      // Check currentStepIndex advanced on parent run
      const fetchedRun = await store.getRun('org_acme', run.runId);
      expect(fetchedRun?.currentStepIndex).toBe(1);
    });

    it('rejects step creation with tenant scope violation', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Outreach' },
      });

      await expect(
        store.createStep('org_hacker', run.runId, {
          runId: run.runId,
          organizationId: 'org_acme', // Mismatch!
          workspaceId: 'ws_sales',
          stepIndex: 0,
          type: 'tool_call',
          title: 'Tamper',
          idempotencyKey: 'idem_bad',
          correlationId: 'corr_bad',
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });

    it('rejects step creation when workspaceId does not match run workspaceId', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Outreach' },
      });

      await expect(
        store.createStep('org_acme', run.runId, {
          runId: run.runId,
          organizationId: 'org_acme',
          workspaceId: 'ws_other_workspace', // Mismatch with run's ws_sales!
          stepIndex: 0,
          type: 'tool_call',
          title: 'Cross Workspace Leak',
          idempotencyKey: 'idem_leak',
          correlationId: 'corr_leak',
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });
  });

  describe('Budget Tracking & Ceiling Enforcement (Rule 23)', () => {
    it('accumulates budget usage accurately across operations', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'deal_coach',
        principalId: 'agent_coach_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Deal review' },
        customBudgets: {
          maxTokens: 10000,
          maxToolCalls: 5,
          maxRecordsMutated: 10,
        },
      });

      const updated = await store.updateBudgetUsage('org_acme', run.runId, {
        tokensUsed: 2500,
        toolCallsExecuted: 2,
        recordsMutated: 3,
        durationMs: 1500,
      });

      expect(updated.budgetUsage.tokensUsed).toBe(2500);
      expect(updated.budgetUsage.toolCallsExecuted).toBe(2);
      expect(updated.budgetUsage.recordsMutated).toBe(3);
      expect(updated.budgetUsage.durationMs).toBe(1500);
    });

    it('throws BUDGET_EXCEEDED when token ceiling is breached', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'crm_researcher',
        principalId: 'agent_res_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Heavy research' },
        customBudgets: {
          maxTokens: 5000,
        },
      });

      await expect(
        store.updateBudgetUsage('org_acme', run.runId, {
          tokensUsed: 6000, // Exceeds 5000 ceiling!
        })
      ).rejects.toThrowError(AgentRuntimeError);

      try {
        await store.updateBudgetUsage('org_acme', run.runId, {
          tokensUsed: 6000,
        });
      } catch (e) {
        const err = e as AgentRuntimeError;
        expect(err.code).toBe('BUDGET_EXCEEDED');
        expect(err.details?.metric).toBe('tokens');
      }
    });

    it('throws BUDGET_EXCEEDED when tool call ceiling is breached', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'crm_researcher',
        principalId: 'agent_res_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Heavy research' },
        customBudgets: {
          maxToolCalls: 3,
        },
      });

      await expect(
        store.updateBudgetUsage('org_acme', run.runId, {
          toolCallsExecuted: 4, // Exceeds 3 ceiling!
        })
      ).rejects.toThrowError(AgentRuntimeError);
    });

    it('throws BUDGET_EXCEEDED when financial spending ceiling is breached', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'deal_coach',
        principalId: 'agent_coach_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Paid API research' },
        customBudgets: {
          maxFinancialAmount: 50,
        },
      });

      await expect(
        store.updateBudgetUsage('org_acme', run.runId, {
          financialAmount: 75, // Exceeds 50 ceiling!
        })
      ).rejects.toThrowError(AgentRuntimeError);

      try {
        await store.updateBudgetUsage('org_acme', run.runId, {
          financialAmount: 75,
        });
      } catch (e) {
        const err = e as AgentRuntimeError;
        expect(err.code).toBe('BUDGET_EXCEEDED');
        expect(err.details?.metric).toBe('financialAmount');
      }
    });

    it('throws BUDGET_EXCEEDED when delegation depth ceiling is breached', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'supervisor',
        principalId: 'agent_sup_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Multi-agent hierarchy' },
        customBudgets: {
          maxDelegationDepth: 2,
        },
      });

      await expect(
        store.updateBudgetUsage('org_acme', run.runId, {
          currentDelegationDepth: 3, // Exceeds 2 ceiling!
        })
      ).rejects.toThrowError(AgentRuntimeError);

      try {
        await store.updateBudgetUsage('org_acme', run.runId, {
          currentDelegationDepth: 3,
        });
      } catch (e) {
        const err = e as AgentRuntimeError;
        expect(err.code).toBe('BUDGET_EXCEEDED');
        expect(err.details?.metric).toBe('delegationDepth');
      }
    });
  });

  describe('Outcome & Run Listing', () => {
    it('records final AgentOutcome on completed run', async () => {
      const run = await store.createRun({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        agentPersonaId: 'deal_coach',
        principalId: 'agent_coach_1',
        authorizingUserId: 'user_ae',
        goal: { prompt: 'Coach report' },
      });

      const outcome: AgentOutcome = {
        answer: 'Deal has a high risk of slippage due to unengaged economic buyer.',
        summary: 'Identified 2 primary risks and proposed 1 mitigating action.',
        findings: ['Economic buyer unengaged', 'Competitor AcmeX introduced'],
        actionsTaken: ['Logged warning note in CRM'],
        actionProposalsCreated: ['prop_schedule_exec_meeting'],
        memoriesCreated: ['mem_deal_risk_snapshot_1'],
        sourceCitations: [
          {
            sourceId: 'meet_last_call',
            sourceType: 'meeting',
            snippet: 'Customer mentioned evaluating alternative vendor',
          },
        ],
        completedAt: new Date().toISOString(),
      };

      const updated = await store.setOutcome('org_acme', run.runId, outcome);
      expect(updated.outcome?.summary).toBe(outcome.summary);
      expect(updated.outcome?.findings).toHaveLength(2);
      expect(updated.outcome?.sourceCitations).toHaveLength(1);
    });

    it('lists runs with filtering and pagination', async () => {
      // Create 3 runs
      await store.createRun({
        organizationId: 'org_corp',
        workspaceId: 'ws_1',
        agentPersonaId: 'deal_coach',
        principalId: 'agent_1',
        authorizingUserId: 'user_1',
        goal: { prompt: 'Goal 1' },
      });
      await store.createRun({
        organizationId: 'org_corp',
        workspaceId: 'ws_1',
        agentPersonaId: 'crm_researcher',
        principalId: 'agent_2',
        authorizingUserId: 'user_1',
        goal: { prompt: 'Goal 2' },
      });
      await store.createRun({
        organizationId: 'org_corp',
        workspaceId: 'ws_2',
        agentPersonaId: 'deal_coach',
        principalId: 'agent_3',
        authorizingUserId: 'user_1',
        goal: { prompt: 'Goal 3' },
      });

      // Filter by workspace
      const ws1Result = await store.listRuns('org_corp', { workspaceId: 'ws_1' });
      expect(ws1Result.runs).toHaveLength(2);
      expect(ws1Result.total).toBe(2);

      // Filter by persona
      const coachResult = await store.listRuns('org_corp', { agentPersonaId: 'deal_coach' });
      expect(coachResult.runs).toHaveLength(2);
      expect(coachResult.total).toBe(2);

      // Pagination
      const pageResult = await store.listRuns('org_corp', { limit: 1, offset: 0 });
      expect(pageResult.runs).toHaveLength(1);
      expect(pageResult.total).toBe(3);
    });
  });

  describe('Domain Event Publication Integration (Rule 40)', () => {
    it('publishes domain events to EventBus for run state transitions', async () => {
      const eventBus = createEventBus();
      const emittedEvents: DomainEvent[] = [];

      subscribeToAgentRuns({
        organizationId: 'org_events',
        onEvent: (event) => {
          emittedEvents.push(event);
        },
        eventBus,
      });

      const run = await store.createRun({
        organizationId: 'org_events',
        workspaceId: 'ws_demo',
        agentPersonaId: 'lead_sdr',
        principalId: 'agent_sdr_99',
        authorizingUserId: 'user_operator',
        goal: { prompt: 'Outreach campaign analysis' },
      });

      await publishAgentRunEvent({
        eventType: 'agent.run.created',
        run,
        eventBus,
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe('agent.run.created');
      expect(emittedEvents[0].organizationId).toBe('org_events');
      expect(emittedEvents[0].entity.id).toBe(run.runId);
      expect(emittedEvents[0].actor.id).toBe('agent_sdr_99');

      // State changed event
      const updatedRun = await store.updateRunStatus({
        runId: run.runId,
        organizationId: 'org_events',
        toStatus: 'planning',
      });

      await publishAgentRunEvent({
        eventType: 'agent.run.state_changed',
        run: updatedRun,
        previousStatus: 'created',
        eventBus,
      });

      expect(emittedEvents).toHaveLength(2);
      expect(emittedEvents[1].type).toBe('agent.run.state_changed');
      expect(emittedEvents[1].payload.status).toBe('planning');
      expect(emittedEvents[1].payload.previousStatus).toBe('created');
    });
  });
});
