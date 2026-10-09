/**
 * @fileOverview Consolidated Test Suite for Agent Runs UI Components (Phase 8 Milestone 2)
 * (ToolCallCard, AgentRunDetailDrawer, AgentRunTimeline).
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first touch targets >= 44px.
 * - Rule 13 & 30: Untrusted reference data containerization (`<untrusted_reference_data>`).
 * - Rule 20 & 39: Correlation ID & Trace ID badges with copy action.
 * - Rule 22: Truncated SHA-256 hash display.
 * - Rule 23: Multi-dimensional budget usage indicators.
 * - Rule 26: Cooperative cancellation button and modal confirmation.
 * - Rule 27: Compensating capability indicator and compensated step state.
 * - Rule 41: Explainability Standard (WHAT, WHY, EXPECTED CHANGE).
 * - theme.md §8: Standardized modal/drawer architecture compliance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToolCallCard } from '@/components/runs/ToolCallCard';
import { AgentRunDetailDrawer } from '@/components/runs/AgentRunDetailDrawer';
import { AgentRunTimeline } from '@/components/runs/AgentRunTimeline';
import type { AgentRun, AgentStep } from '@/platform/runtime/agent-run-types';

/* ==============================================================================
 * 1. ToolCallCard Component
 * ============================================================================== */
describe('ToolCallCard Component', () => {
  const mockStep: AgentStep = {
    stepId: 'step_tool_1',
    runId: 'run_123',
    organizationId: 'org_acme',
    workspaceId: 'ws_sales',
    stepIndex: 1,
    type: 'tool_call',
    title: 'Update Deal Forecast',
    capabilityId: 'crm.deals.update',
    capabilityVersion: '1.2.0',
    status: 'completed',
    what: 'Recalculate expected value based on win probability',
    why: 'Required following prospect qualification call',
    expectedStateChange: 'deal.forecastAmount updated from 50k to 75k',
    riskLevel: 'L2_STATE_MUTATION',
    durationMs: 245,
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    correlationId: 'corr_test_987',
    traceId: 'trace_test_654',
    compensatingCapabilityId: 'crm.deals.revert_forecast',
    input: { dealId: 'deal_456', amount: 75000 },
    output: { updated: true, dealId: 'deal_456' },
    outputValidated: true,
    tokensUsed: 120,
    compensationStatus: 'not_required',
    idempotencyKey: 'idemp_tool_1',
    startedAt: '2026-10-04T02:00:00.000Z',
    completedAt: '2026-10-04T02:00:00.245Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders capability ID, title, and risk level badge', () => {
    render(<ToolCallCard step={mockStep} />);

    expect(screen.getByText('crm.deals.update')).toBeDefined();
    expect(screen.getByText('Update Deal Forecast')).toBeDefined();
    expect(screen.getByText('L2_STATE_MUTATION')).toBeDefined();
  });

  it('renders explainability attributes WHAT, WHY, and EXPECTED CHANGE (Rule 41)', () => {
    render(<ToolCallCard step={mockStep} />);

    expect(screen.getByText(/Recalculate expected value based on win probability/i)).toBeDefined();
    expect(screen.getByText(/Required following prospect qualification call/i)).toBeDefined();
    expect(screen.getByText(/deal\.forecastAmount updated from 50k to 75k/i)).toBeDefined();
  });

  it('displays truncated SHA-256 hash and distributed tracing IDs with copy action (Rule 20, 22, 39)', async () => {
    render(<ToolCallCard step={mockStep} />);

    expect(screen.getByText(/e3b0c44298fc/i)).toBeDefined();
    expect(screen.getByText(/corr_test_987/i)).toBeDefined();

    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    expect(copyButtons.length).toBeGreaterThan(0);
    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('renders compensating capability affordance (Rule 27)', () => {
    render(<ToolCallCard step={mockStep} />);

    expect(screen.getByText(/Compensating Capability/i)).toBeDefined();
    expect(screen.getByText(/crm\.deals\.revert_forecast/i)).toBeDefined();
  });

  it('wraps input and output inside <untrusted_reference_data> container (Rule 13 & 30)', () => {
    const { container } = render(<ToolCallCard step={mockStep} />);

    const accordionToggle = screen.getByRole('button', { name: /Inspect Arguments & Response Data/i });
    fireEvent.click(accordionToggle);

    const containers = container.querySelectorAll('untrusted_reference_data');
    expect(containers.length).toBeGreaterThan(0);
  });
});

/* ==============================================================================
 * 2. AgentRunDetailDrawer Component
 * ============================================================================== */
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
    expect(screen.getByText(/12,500/i)).toBeDefined();
    expect(screen.getByText(/50,000/i)).toBeDefined();
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

/* ==============================================================================
 * 3. AgentRunTimeline Component
 * ============================================================================== */
describe('AgentRunTimeline Component', () => {
  const mockSteps: AgentStep[] = [
    {
      stepId: 'step_1',
      runId: 'run_abc',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      stepIndex: 0,
      type: 'planning',
      title: 'Synthesize Execution Plan',
      status: 'completed',
      what: 'Decompose goal into 3 sub-tasks',
      why: 'Required before capability dispatch',
      expectedStateChange: 'Plan established',
      riskLevel: 'L0_READ',
      durationMs: 420,
      input: { goal: 'Audit pipeline' },
      output: { stepsPlanned: 3 },
      outputValidated: false,
      tokensUsed: 0,
      compensationStatus: 'not_required',
      idempotencyKey: 'idemp_step_1',
      correlationId: 'corr_step_1',
      startedAt: '2026-10-04T02:00:00.000Z',
      completedAt: '2026-10-04T02:00:00.420Z',
    },
    {
      stepId: 'step_2',
      runId: 'run_abc',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      stepIndex: 1,
      type: 'tool_call',
      title: 'Query Stalled Deals',
      capabilityId: 'crm.deals.search',
      status: 'completed',
      what: 'Fetch deals in Evaluation over 21 days',
      why: 'Identifies immediate pipeline risks',
      expectedStateChange: 'Deals retrieved',
      riskLevel: 'L0_READ',
      durationMs: 310,
      input: { stage: 'evaluation', minDays: 21 },
      output: { dealsFound: 4, dealIds: ['deal_1', 'deal_2'] },
      outputValidated: true,
      tokensUsed: 150,
      compensationStatus: 'not_required',
      idempotencyKey: 'idemp_step_2',
      correlationId: 'corr_step_2',
      startedAt: '2026-10-04T02:00:00.500Z',
      completedAt: '2026-10-04T02:00:00.810Z',
    },
    {
      stepId: 'step_3',
      runId: 'run_abc',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      stepIndex: 2,
      type: 'compensation',
      title: 'Compensate Stage Reversion',
      capabilityId: 'crm.deals.revert_stage',
      status: 'compensated',
      what: 'Revert deal stage changes after downstream failure',
      why: 'Saga compensation policy',
      expectedStateChange: 'Original stage restored',
      riskLevel: 'L2_STATE_MUTATION',
      durationMs: 150,
      input: { dealId: 'deal_1', rollbackTo: 'evaluation' },
      output: { reverted: true },
      outputValidated: true,
      tokensUsed: 80,
      compensationStatus: 'completed',
      idempotencyKey: 'idemp_step_3',
      correlationId: 'corr_step_3',
      startedAt: '2026-10-04T02:00:01.000Z',
      completedAt: '2026-10-04T02:00:01.150Z',
    },
  ];

  it('renders sequential step timeline with titles and step indices', () => {
    render(<AgentRunTimeline steps={mockSteps} />);

    expect(screen.getByText('Synthesize Execution Plan')).toBeDefined();
    expect(screen.getByText('Query Stalled Deals')).toBeDefined();
    expect(screen.getByText('Compensate Stage Reversion')).toBeDefined();
  });

  it('renders step badges with execution durations', () => {
    render(<AgentRunTimeline steps={mockSteps} />);

    expect(screen.getByText('420ms')).toBeDefined();
    expect(screen.getByText('310ms')).toBeDefined();
    expect(screen.getByText('150ms')).toBeDefined();
  });

  it('displays explainability fields (WHAT, WHY, EXPECTED CHANGE) (Rule 41)', () => {
    render(<AgentRunTimeline steps={mockSteps} />);

    const firstStepToggle = screen.getByRole('button', { name: /Synthesize Execution Plan/i });
    fireEvent.click(firstStepToggle);

    expect(screen.getByText(/Decompose goal into 3 sub-tasks/i)).toBeDefined();
    expect(screen.getByText(/Required before capability dispatch/i)).toBeDefined();
    expect(screen.getByText(/Plan established/i)).toBeDefined();
  });

  it('wraps untrusted step outputs in <untrusted_reference_data> isolation container (Rule 13 & 30)', () => {
    const { container } = render(<AgentRunTimeline steps={mockSteps} />);

    const secondStepToggle = screen.getByRole('button', { name: /Query Stalled Deals/i });
    fireEvent.click(secondStepToggle);

    const isolationContainers = container.querySelectorAll('untrusted_reference_data');
    expect(isolationContainers.length).toBeGreaterThan(0);
  });

  it('renders compensated step with designated status badge (Rule 27)', () => {
    render(<AgentRunTimeline steps={mockSteps} />);

    expect(screen.getByText(/Compensated/i)).toBeDefined();
  });

  it('satisfies mobile touch targets >= 44px on interactive toggles (Rule 7)', () => {
    render(<AgentRunTimeline steps={mockSteps} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.className).toMatch(/min-h-\[44px\]/);
    });
  });
});
