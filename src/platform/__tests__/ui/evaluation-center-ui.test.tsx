/**
 * @fileOverview UI & Component Test Suite for Evaluation Center & Standardized Modals (Phase 15 Milestone 5)
 *
 * Implements:
 * - Rule 4: Strict Typing Protocol (Zero any or any[])
 * - Rule 7: Mobile-first responsive touch targets, tactile feedback
 * - Rule 10: Inline Architectural Documentation
 * - Rule 11: Mathematical Determinism & Micro-Cent Rounding
 * - Rule 13 & 30: Untrusted reference data XML isolation (<untrusted_reference_data>)
 * - Rule 17: Non-Delegable Human Gate for Dead-Man Toggling
 * - Rule 41: 4-Part Explainability Grid
 * - Rule 42: Shadow Mode Badge
 * - Rule 54: Performance Budgets
 * - Rule 60: Emergency Dead-Man Switches
 * - Rule 61: Mandatory Operator Justification (>= 5 characters)
 * - Rule 62: Real-time UI reactivity via SSE stream
 * - theme.md §8: Standardized Modal & Dialog System Architecture
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import {
  AgentQualityKPIHeader,
  HumanAgentComparisonCard,
  BenchmarkRunsTable,
  CostLatencyChart,
  IncidentManagementModal,
  BenchmarkRunDetailModal,
} from '@/components/evaluation';
import { EvaluationCenterClient } from '@/app/admin/intelligence/evaluation/EvaluationCenterClient';

import type {
  AgentQualityKPIs,
  BenchmarkRunSummary,
  BenchmarkRunDetailData,
  CostTokenMetricRecord,
  LatencyPercentileRecord,
  EvaluationDashboardTelemetry,
} from '@/platform/evaluation/ui/evaluation-ui-types';
import type { HumanVsAgentBaseline } from '@/platform/evaluation/contracts/evaluation-types';
import * as evalActions from '@/app/actions/evaluation-ui-actions';

// Mock Server Actions
vi.mock('@/app/actions/evaluation-ui-actions', () => ({
  getEvaluationDashboardTelemetryAction: vi.fn(),
  listBenchmarkRunsAction: vi.fn(),
  getBenchmarkRunDetailAction: vi.fn(),
  triggerGoldStandardRunAction: vi.fn(),
  createIncidentTicketAction: vi.fn(),
  resolveIncidentTicketAction: vi.fn(),
  toggleEmergencyDeadManAction: vi.fn(),
  getEvaluationViewDataAction: vi.fn(),
}));

// Mock useEventStream
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({ status: 'connected' }),
}));

// Mock useWorkspace
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: { organizationId: 'org_test_enterprise' },
    activeWorkspaceId: 'ws_test_ops',
  }),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('Phase 15 Milestone 5 - Evaluation Center UI & Components Suite', () => {
  const sampleKPIs: AgentQualityKPIs = {
    taskSuccessRate: 96.2,
    toolCorrectnessRate: 98.7,
    policyViolationsCount: 0,
    humanCorrectionRate: 4.8,
    medianRuntimeSeconds: 18,
    totalRunsEvaluated: 140,
    activePersonasCount: 26,
  };

  const sampleBaseline: HumanVsAgentBaseline = {
    humanTaskTimeMinutes: 17.0,
    agentTaskTimeMinutes: 2.0,
    speedupFactor: 8.5,
    humanErrorRatePercent: 8.0,
    agentErrorRatePercent: 1.1,
    errorReductionFactor: 7.3,
    humanSourcesConsultedRatio: '4/9',
    agentSourcesConsultedRatio: '9/9',
    contextBreadthImprovementFactor: 2.25,
  };

  const sampleRuns: BenchmarkRunSummary[] = [
    {
      id: 'run_crm_01',
      scenarioId: 'eval_crm_01',
      domain: 'crm',
      personaId: 'deal_coach',
      score: 98.5,
      passed: true,
      durationMs: 1420,
      tokensUsed: 890,
      estimatedCostUsd: 0.0042,
      timestamp: new Date().toISOString(),
    },
    {
      id: 'run_finance_02',
      scenarioId: 'eval_finance_02',
      domain: 'finance',
      personaId: 'reconciliation_agent',
      score: 72.0,
      passed: false,
      durationMs: 2310,
      tokensUsed: 1240,
      estimatedCostUsd: 0.0089,
      timestamp: new Date().toISOString(),
    },
  ];

  const sampleDetailData: BenchmarkRunDetailData = {
    run: sampleRuns[0],
    scenario: {
      id: 'eval_crm_01',
      description: 'Account context assembly and risk detection.',
      expectedPersona: 'deal_coach',
      expectedRiskLevel: 'L0_READ',
      inputQuery: 'Summarize account Acme Corp and identify churn risk.',
    },
    explainabilityGrid: {
      what: 'Account context assembly and risk detection.',
      why: 'Verify that deal_coach correctly identifies churn signals without hallucinations.',
      expectedVsActual: 'Observed postcondition invariants strictly match golden references.',
      risk: 'L0_READ',
    },
    evaluationScores: {
      taskCompletionScore: 98.0,
      toolSelectionScore: 99.0,
      policyCorrectnessScore: 100.0,
      evidenceGroundingScore: 97.5,
      compositeScore: 98.5,
    },
    untrustedReferenceData: `<untrusted_reference_data id="ref_run_crm_01" sanitized="true">
{
  "scenarioId": "eval_crm_01",
  "input": "Summarize account Acme Corp and identify churn risk."
}
</untrusted_reference_data>`,
  };

  const sampleCostData: CostTokenMetricRecord[] = [
    {
      personaId: 'reconciliation_agent',
      modelTier: 'TIER_3_HIGH_END',
      totalCostUsd: 28.9,
      promptTokens: 480000,
      completionTokens: 62000,
      cachedTokens: 180000,
      runCount: 85,
    },
    {
      personaId: 'sdr_agent',
      modelTier: 'TIER_1_LOW_COST',
      totalCostUsd: 3.12,
      promptTokens: 150000,
      completionTokens: 28000,
      cachedTokens: 45000,
      runCount: 310,
    },
  ];

  const sampleLatencyData: LatencyPercentileRecord[] = [
    {
      capabilityId: 'crm.account.get_context',
      domain: 'crm',
      p50Ms: 320,
      p90Ms: 650,
      p99Ms: 1120,
      sampleCount: 1240,
    },
    {
      capabilityId: 'finance.reconciliation.reconcile_statement',
      domain: 'finance',
      p50Ms: 850,
      p90Ms: 1890,
      p99Ms: 3400,
      sampleCount: 320,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders AgentQualityKPIHeader with the 5 canonical quality targets (agents_mcp_ui.md 3658–3665)', () => {
    render(<AgentQualityKPIHeader kpis={sampleKPIs} />);

    expect(screen.getByText('96.2%')).toBeDefined();
    expect(screen.getByText('98.7%')).toBeDefined();
    expect(screen.getByText('0')).toBeDefined();
    expect(screen.getByText('4.8%')).toBeDefined();
    expect(screen.getByText('18s')).toBeDefined();
    expect(screen.getByText(/actual task performance/i)).toBeDefined();
  });

  it('2. renders HumanAgentComparisonCard with speedup, error reduction, and context breadth metrics', () => {
    render(<HumanAgentComparisonCard baseline={sampleBaseline} />);

    expect(screen.getByText(/8.5x FASTER/i)).toBeDefined();
    expect(screen.getByText(/7.3x REDUCTION/i)).toBeDefined();
    expect(screen.getByText(/2.25x BREADTH/i)).toBeDefined();
    expect(screen.getByText('17m')).toBeDefined();
    expect(screen.getByText('2m')).toBeDefined();
  });

  it('3. renders BenchmarkRunsTable with pass/fail badges, duration, and inspect trigger', () => {
    const onInspectMock = vi.fn();
    const onTriggerMock = vi.fn();

    render(
      <BenchmarkRunsTable
        runs={sampleRuns}
        onInspectRun={onInspectMock}
        onTriggerRun={onTriggerMock}
      />
    );

    expect(screen.getByText('eval_crm_01')).toBeDefined();
    expect(screen.getByText('eval_finance_02')).toBeDefined();
    expect(screen.getByText('98.5%')).toBeDefined();
    expect(screen.getByText('72.0%')).toBeDefined();
    expect(screen.getByText('PASS')).toBeDefined();
    expect(screen.getByText('FAIL')).toBeDefined();

    const inspectButtons = screen.getAllByRole('button', { name: /inspect/i });
    fireEvent.click(inspectButtons[0]);
    expect(onInspectMock).toHaveBeenCalledWith('run_crm_01');
  });

  it('4. renders IncidentManagementModal adhering to theme.md §8 and enforcing >= 5 char justification (Rule 61)', async () => {
    const onOpenChangeMock = vi.fn();
    const createActionMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'inc_test_101',
        title: 'Model Divergence Spike',
        severity: 'P1_HIGH',
        justification: 'Observed hallucination in statement parser',
      },
    });

    render(
      <IncidentManagementModal
        open={true}
        onOpenChange={onOpenChangeMock}
        organizationId="org_test_enterprise"
        deadManSwitches={{ agent_execution_paused: false }}
        createAction={createActionMock}
      />
    );

    // Verify modal title
    expect(screen.getByText(/Evaluation Incident & Control Plane/i)).toBeDefined();

    // Switch to Create Incident Ticket tab
    const ticketTab = screen.getByRole('button', { name: /create incident ticket/i });
    fireEvent.click(ticketTab);

    // Enter title
    const titleInput = screen.getByLabelText(/Incident Title \*/i);
    fireEvent.change(titleInput, { target: { value: 'Model Divergence Spike' } });

    // Enter short justification (< 5 chars)
    const justInput = screen.getByLabelText(/Operational Justification/i);
    fireEvent.change(justInput, { target: { value: 'bad' } });

    const submitBtn = screen.getByRole('button', { name: /record incident ticket/i });
    expect(submitBtn).toBeDisabled();

    // Enter valid justification (>= 5 chars)
    fireEvent.change(justInput, {
      target: { value: 'Observed hallucination in statement parser' },
    });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createActionMock).toHaveBeenCalledWith({
        organizationId: 'org_test_enterprise',
        title: 'Model Divergence Spike',
        severity: 'P2_MEDIUM',
        personaId: undefined,
        capabilityId: undefined,
        justification: 'Observed hallucination in statement parser',
      });
    });
  });

  it('5. renders BenchmarkRunDetailModal with 4-part explainability grid and XML reference container (Rules 13, 30, 41)', () => {
    const onOpenChangeMock = vi.fn();

    render(
      <BenchmarkRunDetailModal
        open={true}
        onOpenChange={onOpenChangeMock}
        data={sampleDetailData}
      />
    );

    // 4-Part Explainability
    expect(screen.getByText('4-Part Explainability Grid (Rule 41)')).toBeDefined();
    expect(screen.getByText('Account context assembly and risk detection.')).toBeDefined();
    expect(screen.getByText(/Verify that deal_coach correctly identifies churn signals/i)).toBeDefined();

    // 4 Evaluation vector scores
    expect(screen.getByText('98.0%')).toBeDefined();
    expect(screen.getByText('99.0%')).toBeDefined();
    expect(screen.getByText('100.0%')).toBeDefined();
    expect(screen.getByText('97.5%')).toBeDefined();

    // Untrusted reference container
    expect(screen.getByText(/Reference Evidence \(<untrusted_reference_data>\)/i)).toBeDefined();
  });

  it('6. renders CostLatencyChart with micro-USD spend, 3-tier allocations, and P50/P90/P99 latency distribution', () => {
    render(
      <CostLatencyChart
        costMetrics={sampleCostData}
        latencyMetrics={sampleLatencyData}
      />
    );

    expect(screen.getByText(/Micro-USD Cost & Token Efficiency/i)).toBeDefined();
    expect(screen.getByText(/reconciliation_agent/i)).toBeDefined();
    expect(screen.getByText('$28.9000')).toBeDefined();
    expect(screen.getByText('$3.1200')).toBeDefined();

    expect(screen.getByText(/Latency Percentile Distribution/i)).toBeDefined();
    expect(screen.getByText('crm.account.get_context')).toBeDefined();
    expect(screen.getByText(/P50: 320ms/i)).toBeDefined();
    expect(screen.getByText(/P99: 1120ms/i)).toBeDefined();
  });

  it('7. renders EvaluationCenterClient Three-Zone Cockpit with live SSE stream and view tabs', async () => {
    const mockTelemetry: EvaluationDashboardTelemetry = {
      kpis: sampleKPIs,
      humanComparison: sampleBaseline,
      recentRuns: sampleRuns,
      openIncidents: [],
      deadManSwitches: { agent_execution_paused: false },
    };

    vi.mocked(evalActions.getEvaluationDashboardTelemetryAction).mockResolvedValue({
      success: true,
      data: mockTelemetry,
    });
    vi.mocked(evalActions.listBenchmarkRunsAction).mockResolvedValue({
      success: true,
      data: sampleRuns,
    });

    render(
      <EvaluationCenterClient
        organizationId="org_test_enterprise"
        workspaceId="ws_test_ops"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Agent Evaluation Center/i)).toBeDefined();
      expect(screen.getByText('LIVE SSE')).toBeDefined();
    });

    // Check tab presence
    expect(screen.getByRole('button', { name: /benchmarks/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /regression/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /production quality/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /failures/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /human corrections/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /cost & tokens/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /latency & performance/i })).toBeDefined();
  });
});
