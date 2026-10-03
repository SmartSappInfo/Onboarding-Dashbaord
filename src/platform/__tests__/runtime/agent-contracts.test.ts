/**
 * @fileOverview Agent Runtime Contracts & Schemas Test Suite (Phase 6 Milestone 1)
 *
 * Implements Rule 4 (Strict Typing), Rule 8 & 47 (Multi-Tenancy), Rule 16 (Agent Principal),
 * Rule 23 (Resource Budgets), Rule 48 (Error Taxonomy).
 */

import { describe, it, expect } from 'vitest';
import {
  AgentRunSchema,
  AgentStepSchema,
  AgentGoalSchema,
  ExecutionPlanSchema,
  PlanStepSchema,
  AgentOutcomeSchema,
  AgentRunBudgetsSchema,
  AgentRunBudgetUsageSchema,
  CreateAgentRunInputSchema,
  AgentRuntimeError,
  AGENT_RUN_STATUSES,
  AGENT_STEP_STATUSES,
  AGENT_RUNTIME_ERROR_CODES,
} from '../../runtime/agent-run-types';

describe('Agent Runtime Contracts & Schemas', () => {
  it('validates canonical agent run statuses and step statuses', () => {
    expect(AGENT_RUN_STATUSES).toHaveLength(11);
    expect(AGENT_RUN_STATUSES).toContain('created');
    expect(AGENT_RUN_STATUSES).toContain('queued');
    expect(AGENT_RUN_STATUSES).toContain('planning');
    expect(AGENT_RUN_STATUSES).toContain('context_building');
    expect(AGENT_RUN_STATUSES).toContain('executing');
    expect(AGENT_RUN_STATUSES).toContain('waiting_for_approval');
    expect(AGENT_RUN_STATUSES).toContain('verifying');
    expect(AGENT_RUN_STATUSES).toContain('retrying');
    expect(AGENT_RUN_STATUSES).toContain('completed');
    expect(AGENT_RUN_STATUSES).toContain('failed');
    expect(AGENT_RUN_STATUSES).toContain('cancelled');

    expect(AGENT_STEP_STATUSES).toHaveLength(6);
    expect(AGENT_STEP_STATUSES).toContain('pending');
    expect(AGENT_STEP_STATUSES).toContain('running');
    expect(AGENT_STEP_STATUSES).toContain('completed');
    expect(AGENT_STEP_STATUSES).toContain('failed');
    expect(AGENT_STEP_STATUSES).toContain('skipped');
    expect(AGENT_STEP_STATUSES).toContain('compensated');
  });

  it('validates default resource budgets and ceilings (Rule 23)', () => {
    const defaultBudgets = AgentRunBudgetsSchema.parse({});
    expect(defaultBudgets.maxDurationMs).toBe(120000);
    expect(defaultBudgets.maxTokens).toBe(50000);
    expect(defaultBudgets.maxToolCalls).toBe(15);
    expect(defaultBudgets.maxRecordsMutated).toBe(25);
    expect(defaultBudgets.maxFinancialAmount).toBe(0);
    expect(defaultBudgets.maxDelegationDepth).toBe(3);

    // Negative budgets or excessive values must fail validation
    expect(() => AgentRunBudgetsSchema.parse({ maxTokens: -100 })).toThrow();
    expect(() => AgentRunBudgetsSchema.parse({ maxTokens: 500000 })).toThrow();
    expect(() => AgentRunBudgetsSchema.parse({ maxDurationMs: 500 })).toThrow();
  });

  it('validates initial budget usage schema with zero defaults', () => {
    const usage = AgentRunBudgetUsageSchema.parse({});
    expect(usage.tokensUsed).toBe(0);
    expect(usage.toolCallsExecuted).toBe(0);
    expect(usage.durationMs).toBe(0);
    expect(usage.recordsMutated).toBe(0);
    expect(usage.financialAmount).toBe(0);
    expect(usage.currentDelegationDepth).toBe(0);
  });

  it('validates AgentGoalSchema with intent and constraints', () => {
    const goal = AgentGoalSchema.parse({
      prompt: 'Analyze stalled enterprise deals in Q3',
      intent: 'pipeline_audit',
      subject: { type: 'deal', id: 'deal_123', name: 'Acme Corp Deal' },
      constraints: ['read_only_mode', 'skip_archived'],
    });

    expect(goal.prompt).toBe('Analyze stalled enterprise deals in Q3');
    expect(goal.intent).toBe('pipeline_audit');
    expect(goal.subject?.id).toBe('deal_123');
    expect(goal.constraints).toHaveLength(2);
  });

  it('validates PlanStepSchema and ExecutionPlanSchema', () => {
    const step1 = PlanStepSchema.parse({
      stepId: 'step_1',
      stepIndex: 0,
      title: 'Fetch deal history',
      type: 'tool_call',
      capabilityId: 'crm.deal.get_details',
      capabilityVersion: '1.0.0',
      riskLevel: 'L0_READ',
      arguments: { dealId: 'deal_123' },
      isNonDelegable: false,
    });

    const step2 = PlanStepSchema.parse({
      stepId: 'step_2',
      stepIndex: 1,
      title: 'Synthesize coach recommendation',
      type: 'reflection',
      dependsOnStepIds: ['step_1'],
    });

    const plan = ExecutionPlanSchema.parse({
      planId: 'plan_1',
      version: 1,
      steps: [step1, step2],
      estimatedTokens: 3500,
      rationale: 'First retrieve deal context, then synthesize recommendations.',
      createdAt: new Date().toISOString(),
    });

    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[1].dependsOnStepIds).toContain('step_1');
  });

  it('validates full AgentRunSchema with strict tenant isolation and personas', () => {
    const now = new Date().toISOString();
    const run = AgentRunSchema.parse({
      runId: 'run_abc_123',
      organizationId: 'org_enterprise_1',
      workspaceId: 'ws_prod_1',
      agentPersonaId: 'deal_coach',
      principalId: 'agent_principal_456',
      authorizingUserId: 'user_joseph_789',
      triggerType: 'manual',
      modelTier: 'pro',
      dryRun: false,
      goal: {
        prompt: 'Review pipeline risks',
        intent: 'deal_coaching',
      },
      status: 'created',
      stateHistory: [
        {
          from: 'created',
          to: 'created',
          timestamp: now,
          reason: 'Initial creation',
        },
      ],
      currentStepIndex: 0,
      budgets: {
        maxDurationMs: 120000,
        maxTokens: 50000,
        maxToolCalls: 15,
        maxRecordsMutated: 25,
        maxFinancialAmount: 0,
        maxDelegationDepth: 3,
      },
      createdAt: now,
      updatedAt: now,
    });

    expect(run.runId).toBe('run_abc_123');
    expect(run.agentPersonaId).toBe('deal_coach');
    expect(run.status).toBe('created');
    expect(run.budgetUsage.tokensUsed).toBe(0);
  });

  it('rejects AgentRun with invalid persona or non-ISO timestamp', () => {
    const invalidPersona = {
      runId: 'run_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      agentPersonaId: 'hacker_bot', // Invalid!
      principalId: 'princ_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Do bad things' },
      budgets: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(() => AgentRunSchema.parse(invalidPersona)).toThrow();

    const invalidDate = {
      runId: 'run_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      agentPersonaId: 'crm_researcher',
      principalId: 'princ_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Valid prompt' },
      budgets: {},
      createdAt: 'yesterday', // Invalid!
      updatedAt: new Date().toISOString(),
    };

    expect(() => AgentRunSchema.parse(invalidDate)).toThrow();
  });

  it('validates AgentStepSchema with tracing, idempotency and compensation pointers', () => {
    const now = new Date().toISOString();
    const step = AgentStepSchema.parse({
      stepId: 'step_run_1_0',
      runId: 'run_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      stepIndex: 0,
      type: 'tool_call',
      title: 'Update contact status',
      capabilityId: 'crm.contact.update',
      capabilityVersion: '1.0.0',
      status: 'completed',
      idempotencyKey: 'idem_run_1_0_hash',
      correlationId: 'corr_xyz_789',
      traceId: 'trace_111',
      spanId: 'span_222',
      actionProposalId: 'prop_999',
      payloadHash: 'a'.repeat(64),
      startedAt: now,
      completedAt: now,
      durationMs: 450,
      input: { contactId: 'con_1', status: 'qualified' },
      output: { success: true },
      outputValidated: true,
      tokensUsed: 120,
      compensatingCapabilityId: 'crm.contact.revert_status',
      compensationStatus: 'not_required',
    });

    expect(step.idempotencyKey).toBe('idem_run_1_0_hash');
    expect(step.outputValidated).toBe(true);
    expect(step.tokensUsed).toBe(120);
  });

  it('validates AgentRuntimeError structured taxonomy and properties (Rule 48)', () => {
    expect(AGENT_RUNTIME_ERROR_CODES).toContain('BUDGET_EXCEEDED');
    expect(AGENT_RUNTIME_ERROR_CODES).toContain('INVALID_STATE_TRANSITION');
    expect(AGENT_RUNTIME_ERROR_CODES).toContain('TERMINAL_STATE_IMMUTABLE');
    expect(AGENT_RUNTIME_ERROR_CODES).toContain('TENANT_SCOPE_VIOLATION');
    expect(AGENT_RUNTIME_ERROR_CODES).toContain('EMERGENCY_DEAD_MAN_PAUSED');

    const err = new AgentRuntimeError({
      code: 'BUDGET_EXCEEDED',
      message: 'Token limit exceeded',
      runId: 'run_123',
      organizationId: 'org_abc',
      details: { limit: 50000, attempted: 52000 },
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AgentRuntimeError);
    expect(err.name).toBe('AgentRuntimeError');
    expect(err.code).toBe('BUDGET_EXCEEDED');
    expect(err.runId).toBe('run_123');
    expect(err.organizationId).toBe('org_abc');
    expect(err.details?.limit).toBe(50000);
    expect(err.message).toContain('[AgentRuntime:BUDGET_EXCEEDED]');
  });

  it('validates CreateAgentRunInputSchema and AgentOutcomeSchema', () => {
    const input = CreateAgentRunInputSchema.parse({
      organizationId: 'org_input_test',
      workspaceId: 'ws_input_test',
      agentPersonaId: 'crm_researcher',
      principalId: 'agent_princ_test',
      authorizingUserId: 'user_auth_test',
      goal: { prompt: 'Find contacts' },
    });

    expect(input.organizationId).toBe('org_input_test');
    expect(input.goal.intent).toBe('custom_goal');
    expect(input.triggerType).toBe('manual');
    expect(input.modelTier).toBe('pro');

    const outcome = AgentOutcomeSchema.parse({
      summary: 'Completed research task',
      findings: ['Found 3 executives'],
      completedAt: new Date().toISOString(),
    });

    expect(outcome.summary).toBe('Completed research task');
    expect(outcome.findings).toHaveLength(1);
    expect(outcome.actionsTaken).toEqual([]);
  });
});
