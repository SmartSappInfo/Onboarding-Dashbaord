/**
 * @fileOverview Test Suite for Agent Runs Mission Control Console (Phase 8 Milestone 2)
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first touch targets >= 44px.
 * - Rule 8 & 47: Anti-IDOR tenant validation.
 * - Rule 21: Awaiting approval badge presence.
 * - Rule 61: Backoffice control plane.
 * - Rule 62: Real-time UI reactivity via SSE.
 * - Rule 69: Strangler Fig redirect backward compatibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RunsClient } from '@/app/admin/intelligence/runs/RunsClient';
import AdminAgentsRedirectPage from '@/app/admin/agents/page';
import AdminRunsRedirectPage from '@/app/admin/runs/page';
import type { AgentRun } from '@/platform/runtime/agent-run-types';

const mocks = vi.hoisted(() => {
  const mockRedirect = vi.fn();
  const runs: AgentRun[] = [
    {
      runId: 'run_exec_001',
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'crm_researcher',
      principalId: 'agent_user_1',
      authorizingUserId: 'user_1',
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
      stateHistory: [],
      childRunIds: [],
      createdAt: '2026-10-04T02:00:00.000Z',
      updatedAt: '2026-10-04T02:00:45.000Z',
    },
    {
      runId: 'run_exec_002',
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_user_2',
      authorizingUserId: 'user_1',
      triggerType: 'scheduled',
      modelTier: 'flash',
      dryRun: false,
      status: 'waiting_for_approval',
      goal: {
        prompt: 'Execute high-value deal discount proposal',
        intent: 'task_execution',
        constraints: [],
      },
      budgets: {
        maxTokens: 30000,
        maxToolCalls: 10,
        maxDurationMs: 60000,
        maxRecordsMutated: 5,
        maxFinancialAmount: 5000,
        maxDelegationDepth: 2,
      },
      budgetUsage: {
        tokensUsed: 8000,
        toolCallsExecuted: 2,
        durationMs: 20000,
        recordsMutated: 0,
        financialAmount: 0,
        currentDelegationDepth: 0,
      },
      currentStepIndex: 2,
      metadata: {
        correlationId: 'corr_test_002',
        traceId: 'trace_test_002',
      },
      stateHistory: [],
      childRunIds: [],
      createdAt: '2026-10-04T02:10:00.000Z',
      updatedAt: '2026-10-04T02:10:30.000Z',
    },
    {
      runId: 'run_exec_003',
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'deal_coach',
      principalId: 'agent_user_3',
      authorizingUserId: 'user_1',
      triggerType: 'reactive_event',
      modelTier: 'flash',
      dryRun: false,
      status: 'completed',
      goal: {
        prompt: 'Normalize enterprise contact phone numbers',
        intent: 'custom_goal',
        constraints: [],
      },
      budgets: {
        maxTokens: 20000,
        maxToolCalls: 5,
        maxDurationMs: 30000,
        maxRecordsMutated: 50,
        maxFinancialAmount: 0,
        maxDelegationDepth: 1,
      },
      budgetUsage: {
        tokensUsed: 4500,
        toolCallsExecuted: 1,
        durationMs: 12000,
        recordsMutated: 42,
        financialAmount: 0,
        currentDelegationDepth: 0,
      },
      currentStepIndex: 2,
      metadata: {
        correlationId: 'corr_test_003',
        traceId: 'trace_test_003',
      },
      stateHistory: [],
      childRunIds: [],
      createdAt: '2026-10-04T01:50:00.000Z',
      updatedAt: '2026-10-04T01:50:12.000Z',
    },
  ];
  return { mockRuns: runs, mockRedirect };
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mocks.mockRedirect(url);
    throw new Error(`NEXT_REDIRECT: ${url}`);
  },
}));

let eventStreamCallback: ((activity: Record<string, unknown>) => void) | null = null;

vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: (options: { onActivity?: (activity: Record<string, unknown>) => void }) => {
    if (options?.onActivity) {
      eventStreamCallback = options.onActivity;
    }
  },
}));

vi.mock('@/app/actions/agent-run-ui-actions', () => ({
  listAgentRunsAction: vi.fn().mockImplementation(async (input: { searchQuery?: string }) => {
    let filtered = [...mocks.mockRuns];
    if (input.searchQuery) {
      const q = input.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.runId.toLowerCase().includes(q) ||
          r.goal.prompt.toLowerCase().includes(q) ||
          r.agentPersonaId.toLowerCase().includes(q)
      );
    }
    return { success: true, data: { runs: filtered, total: filtered.length } };
  }),
  getAgentRunMetricsAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      totalRuns: 3,
      activeRuns: 1,
      waitingApprovals: 1,
      completedRuns: 1,
      failedRuns: 0,
      totalTokensUsed: 25000,
    },
  }),
  getAgentRunDetailsAction: vi.fn().mockImplementation(async (input: { runId: string }) => {
    const found = mocks.mockRuns.find((r) => r.runId === input.runId);
    return {
      success: true,
      data: {
        run: found,
        steps: [
          {
            stepId: 'step_1',
            runId: input.runId,
            organizationId: 'org_acme',
            workspaceId: 'ws_sales',
            stepIndex: 0,
            type: 'planning',
            title: 'Decompose Goal',
            status: 'completed',
            what: 'Decompose',
            why: 'First step',
            expectedStateChange: 'Plan created',
            riskLevel: 'L0_READ',
            idempotencyKey: 'idemp_1',
            correlationId: 'corr_1',
            outputValidated: false,
            tokensUsed: 0,
            compensationStatus: 'not_required',
            startedAt: '2026-10-04T02:00:00.000Z',
          },
        ],
      },
    };
  }),
  cancelAgentRunAction: vi.fn().mockImplementation(async () => ({
    success: true,
    data: { ...mocks.mockRuns[0], status: 'cancelled' },
  })),
}));

describe('RunsClient (Agent Run Mission Control)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventStreamCallback = null;
  });

  it('renders Three-Zone layout with KPI cards, toolbar tabs, and runs table', async () => {
    render(<RunsClient />);

    // Header & KPIs
    expect(screen.getByText('Agent Run Mission Control')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('Total Runs')).toBeDefined();
      expect(screen.getByText('Active Executions')).toBeDefined();
      expect(screen.getByText('Awaiting Approval')).toBeDefined();
      expect(screen.getAllByText('Failed / DLQ').length).toBeGreaterThan(0);
    });

    // Toolbar Tabs
    expect(screen.getByRole('button', { name: /All Runs/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /In-Flight/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Needs Approval/i })).toBeDefined();

    // Table rows
    await waitFor(() => {
      expect(screen.getByText('run_exec_001')).toBeDefined();
      expect(screen.getByText('run_exec_002')).toBeDefined();
      expect(screen.getByText('run_exec_003')).toBeDefined();
    });
  });

  it('filters runs by status tabs', async () => {
    render(<RunsClient />);

    await waitFor(() => {
      expect(screen.getByText('run_exec_001')).toBeDefined();
    });

    // Click Needs Approval tab
    const needsApprovalTab = screen.getByRole('button', { name: /Needs Approval/i });
    fireEvent.click(needsApprovalTab);

    // Only run_exec_002 should remain
    expect(screen.getByText('run_exec_002')).toBeDefined();
    expect(screen.queryByText('run_exec_001')).toBeNull();
    expect(screen.queryByText('run_exec_003')).toBeNull();

    // Click Completed tab
    const completedTab = screen.getByRole('button', { name: /Completed/i });
    fireEvent.click(completedTab);

    expect(screen.getByText('run_exec_003')).toBeDefined();
    expect(screen.queryByText('run_exec_002')).toBeNull();
  });

  it('opens AgentRunDetailDrawer when Inspect button is clicked', async () => {
    render(<RunsClient />);

    await waitFor(() => {
      expect(screen.getByText('run_exec_001')).toBeDefined();
    });

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectButtons[0]);

    // Drawer should open and display run details & steps
    await waitFor(() => {
      expect(screen.getByText('Decompose Goal')).toBeDefined();
    });
  });

  it('re-queries runs when real-time SSE event is received (Rule 62)', async () => {
    const { listAgentRunsAction } = await import('@/app/actions/agent-run-ui-actions');
    render(<RunsClient />);

    await waitFor(() => {
      expect(screen.getByText('run_exec_001')).toBeDefined();
    });

    expect(eventStreamCallback).toBeTypeOf('function');

    // Simulate SSE event from backend
    if (eventStreamCallback) {
      await act(async () => {
        eventStreamCallback!({
          id: 'evt_1',
          eventType: 'agent.run.state_changed',
          details: { runId: 'run_exec_001', toStatus: 'completed' },
        });
      });
    }

    await waitFor(() => {
      // Re-invoked listAgentRunsAction
      expect(listAgentRunsAction).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Strangler Fig Redirects (Rule 69)', () => {
  it('redirects /admin/agents to /admin/intelligence/runs preserving searchParams', async () => {
    mocks.mockRedirect.mockClear();
    try {
      await AdminAgentsRedirectPage({
        searchParams: Promise.resolve({ status: 'running', persona: 'crm_researcher' }),
      });
    } catch {
      // Next.js redirect throws error
    }
    expect(mocks.mockRedirect).toHaveBeenCalledWith(
      '/admin/intelligence/runs?status=running&persona=crm_researcher'
    );
  });

  it('redirects /admin/runs to /admin/intelligence/runs preserving searchParams', async () => {
    mocks.mockRedirect.mockClear();
    try {
      await AdminRunsRedirectPage({
        searchParams: Promise.resolve({}),
      });
    } catch {
      // Next.js redirect throws error
    }
    expect(mocks.mockRedirect).toHaveBeenCalledWith('/admin/intelligence/runs');
  });
});
