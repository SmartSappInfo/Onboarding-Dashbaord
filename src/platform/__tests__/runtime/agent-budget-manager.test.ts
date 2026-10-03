/**
 * @fileOverview Unit & Integration Tests for AgentBudgetManager (Rules 23, 40, 42, 54, 60)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentBudgetManager } from '@/platform/runtime/governance/agent-budget-manager';
import { createMemoryAgentRunStore } from '@/platform/runtime/agent-run-store';
import { GovernanceError } from '@/platform/runtime/governance/governance-types';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('AgentBudgetManager (Rules 23, 40, 42, 54, 60)', () => {
  let runStore: ReturnType<typeof createMemoryAgentRunStore>;
  let budgetManager: AgentBudgetManager;

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
    runStore = createMemoryAgentRunStore();
    budgetManager = new AgentBudgetManager({ runStore });
  });

  it('allows operations within budget and records usage deltas', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Find leads' },
      customBudgets: {
        maxTokens: 10000,
        maxToolCalls: 5,
        maxDurationMs: 60000,
      },
    });

    const check = await budgetManager.checkBudget({
      organizationId: 'org_acme',
      runId: run.runId,
      estimatedTokens: 500,
      toolCalls: 1,
    });

    expect(check.allowed).toBe(true);

    const updated = await budgetManager.recordUsage({
      organizationId: 'org_acme',
      runId: run.runId,
      delta: {
        tokensUsed: 650,
        toolCallsExecuted: 1,
        durationMs: 1200,
        recordsMutated: 0,
        financialAmount: 0,
      },
    });

    expect(updated.tokensUsed).toBe(650);
    expect(updated.toolCallsExecuted).toBe(1);
  });

  it('fails closed and throws BUDGET_EXCEEDED when token ceiling is breached', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Find leads' },
      customBudgets: {
        maxTokens: 1000,
      },
    });

    await budgetManager.recordUsage({
      organizationId: 'org_acme',
      runId: run.runId,
      delta: {
        tokensUsed: 950,
        toolCallsExecuted: 1,
        durationMs: 500,
        recordsMutated: 0,
        financialAmount: 0,
      },
    });

    await expect(
      budgetManager.checkOrThrow({
        organizationId: 'org_acme',
        runId: run.runId,
        estimatedTokens: 100, // 950 + 100 = 1050 > 1000
      })
    ).rejects.toThrowError(GovernanceError);
  });

  it('supports dry-run mode without committing usage to run store (Rule 42)', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Find leads' },
      customBudgets: { maxTokens: 5000 },
    });

    const updated = await budgetManager.recordUsage({
      organizationId: 'org_acme',
      runId: run.runId,
      delta: {
        tokensUsed: 800,
        toolCallsExecuted: 1,
        durationMs: 500,
        recordsMutated: 0,
        financialAmount: 0,
      },
      dryRun: true,
    });

    // Returned usage reflects delta for simulation
    expect(updated.tokensUsed).toBe(800);

    // But actual stored usage in runStore remains 0
    const persisted = await runStore.getRun('org_acme', run.runId);
    expect(persisted?.budgetUsage.tokensUsed).toBe(0);
  });

  it('fails closed when emergency dead-man switch is tripped (Rule 60)', async () => {
    setGovernanceDeadManStateForTests(true);

    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Find leads' },
    });

    await expect(
      budgetManager.checkBudget({
        organizationId: 'org_acme',
        runId: run.runId,
      })
    ).rejects.toThrowError(GovernanceError);
  });

  it('evaluates all budget dimensions: tool calls, duration, records mutated, financial amount, delegation depth', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Multi-dim checks' },
      customBudgets: {
        maxToolCalls: 2,
        maxDurationMs: 5000,
        maxRecordsMutated: 5,
        maxFinancialAmount: 100,
        maxDelegationDepth: 2,
      },
    });

    // Breach tool calls
    const check1 = await budgetManager.checkBudget({
      organizationId: 'org_acme',
      runId: run.runId,
      toolCalls: 3,
    });
    expect(check1.allowed).toBe(false);
    expect(check1.breachedDimensions).toContain('toolCalls (3 > 2)');

    // Breach duration
    const check2 = await budgetManager.checkBudget({
      organizationId: 'org_acme',
      runId: run.runId,
      estimatedDurationMs: 6000,
    });
    expect(check2.allowed).toBe(false);
    expect(check2.breachedDimensions).toContain('durationMs (6000 > 5000)');

    // Breach records mutated
    const check3 = await budgetManager.checkBudget({
      organizationId: 'org_acme',
      runId: run.runId,
      recordsMutated: 10,
    });
    expect(check3.allowed).toBe(false);
    expect(check3.breachedDimensions).toContain('recordsMutated (10 > 5)');

    // Breach financial amount
    const check4 = await budgetManager.checkBudget({
      organizationId: 'org_acme',
      runId: run.runId,
      financialAmount: 200,
    });
    expect(check4.allowed).toBe(false);
    expect(check4.breachedDimensions).toContain('financialAmount (200 > 100)');

    // Breach delegation depth
    const check5 = await budgetManager.checkBudget({
      organizationId: 'org_acme',
      runId: run.runId,
      delegationDepth: 3,
    });
    expect(check5.allowed).toBe(false);
    expect(check5.breachedDimensions).toContain('delegationDepth (3 > 2)');
  });
});
