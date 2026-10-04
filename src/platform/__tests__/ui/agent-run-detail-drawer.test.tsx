/**
 * @fileOverview Test Suite for AgentRunDetailDrawer Component (Phase 8 Milestone 2)
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first touch targets >= 44px.
 * - Rule 23: Multi-dimensional budget usage indicators.
 * - Rule 26: Cooperative cancellation button and modal confirmation.
 * - theme.md §8: Standardized modal/drawer architecture compliance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentRunDetailDrawer } from '@/components/runs/AgentRunDetailDrawer';
import type { AgentRun, AgentStep } from '@/platform/runtime/agent-run-types';

describe('AgentRunDetailDrawer Component', () => {
  const mockRun: AgentRun = {
    runId: 'run_exec_001',
    organizationId: 'org_acme',
    workspaceId: 'ws_sales',
    agentPersonaId: 'crm_researcher',
    principalId: 'agent_user_123',
    authorizingUserId: 'user_123',
    triggerType: 'manual',
    modelTier: 'pro',
    dryRun: false,
    status: 'executing',
    goal: {
      prompt: 'Identify top accounts at risk of churn in Q4',
      intent: 'research',
      constraints: [],
    },
    budgets: {
      maxTokens: 50000,
      maxToolCalls: 15,
      maxDurationMs: 120000,
      maxRecordsMutated: 25,
      maxFinancialAmount: 0,
      maxDelegationDepth: 3,
    },
    budgetUsage: {
      tokensUsed: 12500,
      toolCallsExecuted: 3,
      durationMs: 45000,
      recordsMutated: 2,
      financialAmount: 0,
      currentDelegationDepth: 1,
    },
    currentStepIndex: 1,
    metadata: {
      correlationId: 'corr_test_001',
      traceId: 'trace_test_001',
    },
    stateHistory: [
      {
        from: 'created',
        to: 'planning',
        timestamp: '2026-10-04T02:00:00.000Z',
        reason: 'Autonomous goal decomposition',
      },
      {
        from: 'planning',
        to: 'executing',
        timestamp: '2026-10-04T02:00:01.000Z',
        reason: 'DAG plan approved',
      },
    ],
    createdAt: '2026-10-04T02:00:00.000Z',
    updatedAt: '2026-10-04T02:00:45.000Z',
    childRunIds: [],
  };

  const mockSteps: AgentStep[] = [
    {
      stepId: 'step_1',
      runId: 'run_exec_001',
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      stepIndex: 0,
      type: 'planning',
      title: 'Synthesize Churn Analysis Plan',
      status: 'completed',
      what: 'Break down churn metrics',
      why: 'Required first step',
      expectedStateChange: 'Plan synthesized',
      riskLevel: 'L0_READ',
      durationMs: 500,
      input: {},
      outputValidated: true,
      tokensUsed: 200,
      compensationStatus: 'not_required',
      idempotencyKey: 'idemp_1',
      correlationId: 'corr_1',
      startedAt: '2026-10-04T02:00:00.000Z',
      completedAt: '2026-10-04T02:00:00.500Z',
    },
    {
      stepId: 'step_2',
      runId: 'run_exec_001',
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      stepIndex: 1,
      type: 'tool_call',
      title: 'Query Churn Signals',
      capabilityId: 'crm.accounts.query_churn_signals',
      status: 'running',
      what: 'Scan usage drops across active enterprise deals',
      why: 'Identifies high-risk accounts',
      expectedStateChange: 'Signals identified',
      riskLevel: 'L0_READ',
      input: {},
      outputValidated: false,
      tokensUsed: 0,
      compensationStatus: 'not_required',
      idempotencyKey: 'idemp_2',
      correlationId: 'corr_2',
      startedAt: '2026-10-04T02:00:01.000Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal header, persona badge, and info tooltip complying with theme.md §8', () => {
    render(
      <AgentRunDetailDrawer
        run={mockRun}
        steps={mockSteps}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getAllByText(/run_exec_001/i).length).toBeGreaterThan(0);
    expect(screen.getByText('crm_researcher')).toBeDefined();
    expect(screen.getByText('Executing')).toBeDefined();
  });

  it('switches between all 4 tabbed panels: Timeline, Context, Tools, Budgets', () => {
    render(
      <AgentRunDetailDrawer
        run={mockRun}
        steps={mockSteps}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    // Tab 1: Timeline
    expect(screen.getByText('Synthesize Churn Analysis Plan')).toBeDefined();

    // Tab 2: Context & Memory
    const contextTab = screen.getByRole('tab', { name: /Context & Memory/i });
    fireEvent.click(contextTab);
    expect(screen.getByText(/Identify top accounts at risk of churn in Q4/i)).toBeDefined();

    // Tab 3: Tools & Audit
    const toolsTab = screen.getByRole('tab', { name: /Tools & Audit/i });
    fireEvent.click(toolsTab);
    expect(screen.getByText('crm.accounts.query_churn_signals')).toBeDefined();

    // Tab 4: Budgets & Cost
    const budgetsTab = screen.getByRole('tab', { name: /Budgets & Cost/i });
    fireEvent.click(budgetsTab);
    expect(screen.getByText(/12,500/i)).toBeDefined(); // Tokens used
    expect(screen.getByText(/50,000/i)).toBeDefined(); // Max tokens
  });

  it('triggers cooperative cancellation workflow when Cancel Run button is clicked (Rule 26)', async () => {
    const onCancelMock = vi.fn().mockResolvedValue(undefined);

    render(
      <AgentRunDetailDrawer
        run={mockRun}
        steps={mockSteps}
        open={true}
        onOpenChange={vi.fn()}
        onCancelRun={onCancelMock}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel Run/i });
    expect(cancelBtn).toBeDefined();

    fireEvent.click(cancelBtn);

    // Confirmation dialog should appear
    expect(screen.getByText(/Are you sure you want to cancel this agent run/i)).toBeDefined();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Cancel/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onCancelMock).toHaveBeenCalledWith('run_exec_001');
    });
  });

  it('hides Cancel Run button if run is already in terminal state', () => {
    const completedRun: AgentRun = {
      ...mockRun,
      status: 'completed',
    };

    render(
      <AgentRunDetailDrawer
        run={completedRun}
        steps={mockSteps}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Cancel Run/i })).toBeNull();
  });
});
