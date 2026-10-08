/**
 * @fileOverview UI & Component Test Suite for Verification Cockpit & Standardized Modals (Phase 14 Milestone 5)
 *
 * Implements:
 * - Rule 4: Strict Typing Protocol (Zero any or any[])
 * - Rule 7: Mobile-first responsive touch targets, tactile feedback
 * - Rule 10: Inline Architectural Documentation
 * - Rule 17: Non-Delegable Human Gate for Circuit Resets
 * - Rule 21: Formal 6-Step Loop Verification Inspector
 * - Rule 24: Dynamic Circuit Breakers & Shadow Mode Indicators
 * - Rule 61: Three-Zone Mission Control Cockpit
 * - theme.md §8: Standardized Modal & Dialog System Architecture
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ExecutionInspectorModal,
  CircuitResetModal,
  AgentHealthKPIHeader,
  AgentHealthTable,
} from '@/components/verification';
import { AgentHealthClient } from '@/app/admin/intelligence/health/AgentHealthClient';
import type { AgentHealthScorecard } from '@/platform/verification/health/health-types';
import type { ExecutionInspectorData } from '@/platform/verification/ui/verification-ui-types';
import * as healthActions from '@/app/actions/agent-health-actions';

// Mock Server Actions
vi.mock('@/app/actions/agent-health-actions', () => ({
  listAgentHealthScorecardsAction: vi.fn(),
  resetAgentCircuitBreakerAction: vi.fn(),
  getAgentHealthScorecardAction: vi.fn(),
  evaluateDiscrepancyAction: vi.fn(),
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

describe('Phase 14 Milestone 5 - Verification Cockpit & UI Suite', () => {
  const sampleScorecards: AgentHealthScorecard[] = [
    {
      personaId: 'collections_agent',
      organizationId: 'org_test_enterprise',
      workspaceId: 'ws_test_ops',
      healthScore: 92,
      status: 'HEALTHY',
      circuitState: 'CLOSED',
      successRate: 98,
      failureRate: 2,
      recoveryRate: 90,
      totalExecutions: 100,
      successfulExecutions: 98,
      failedExecutions: 2,
      consecutiveFailures: 0,
      toolErrorsCount: 1,
      avgDurationMs: 450,
      tokenCostUSD: 1.25,
      updatedAt: new Date().toISOString(),
      lastTrippedAt: null,
      trippedReason: null,
      degradationMode: 'NONE',
    },
    {
      personaId: 'billing_analyst',
      organizationId: 'org_test_enterprise',
      workspaceId: 'ws_test_ops',
      healthScore: 45,
      status: 'TRIPPED',
      circuitState: 'OPEN',
      successRate: 50,
      failureRate: 50,
      recoveryRate: 10,
      totalExecutions: 40,
      successfulExecutions: 20,
      failedExecutions: 20,
      consecutiveFailures: 3,
      toolErrorsCount: 6,
      avgDurationMs: 1200,
      tokenCostUSD: 3.4,
      updatedAt: new Date().toISOString(),
      lastTrippedAt: new Date().toISOString(),
      trippedReason: 'SLA consecutive errors limit breached',
      degradationMode: 'SHADOW_MODE',
    },
  ];

  const sampleInspectorData: ExecutionInspectorData = {
    executionId: 'exec_test_901',
    runId: 'run_test_01',
    personaId: 'billing_analyst',
    capabilityId: 'finance.billing.generate_invoice',
    status: 'SHADOW_MODE',
    plan: {
      goal: 'Generate monthly subscription billing batch',
      rationale: 'Autonomous scheduled billing execution run',
      personaId: 'billing_analyst',
      riskLevel: 'L2_STATE_MUTATION',
      budgetTokens: 4000,
    },
    actions: [
      {
        stepId: 'step_1',
        capabilityId: 'finance.invoice.create',
        inputPayload: { customerId: 'cust_42', amount: 1500 },
        executedAt: new Date().toISOString(),
        status: 'SUCCESS',
      },
    ],
    predict: {
      predictedStateChange: { invoiceStatus: 'DRAFT', amount: 1500 },
      expectedVersion: 2,
      stateHash: 'b'.repeat(64),
    },
    execute: {
      output: { invoiceId: 'inv_42', status: 'DRAFT' },
      durationMs: 420,
      tokensUsed: 890,
      liveWritesCount: 0,
    },
    verify: {
      result: {
        executionId: 'exec_test_901',
        capabilityId: 'finance.billing.generate_invoice',
        overallStatus: 'FAIL',
        assertionsCount: 1,
        passedCount: 0,
        failedCount: 1,
        durationMs: 80,
        timestamp: new Date().toISOString(),
        assertions: [
          {
            assertionId: 'assert_amount_positive',
            ruleName: 'finance:positive_amount',
            targetResource: 'Invoice',
            targetId: 'inv_42',
            severity: 'CRITICAL',
            status: 'FAILED',
            errorMessage: 'Simulated SLA postcondition variance',
            evaluatedAt: new Date().toISOString(),
            evidence: { amount: 1500 },
          },
        ],
      },
      versionResult: {
        isCurrent: true,
        resourceId: 'inv_42',
        resourceType: 'Invoice',
        expectedVersion: 2,
        actualVersion: 2,
        driftDetected: false,
        violationType: 'NONE',
        message: 'Version matches expected',
        capturedAt: new Date().toISOString(),
      },
    },
    compensate: {
      required: true,
      executed: true,
      status: 'SUCCESS',
      compensatingSteps: [
        {
          stepId: 'comp_1',
          capabilityId: 'finance.invoice.void',
          status: 'SUCCESS',
        },
      ],
      dlqEnqueued: false,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(healthActions.listAgentHealthScorecardsAction).mockResolvedValue({
      success: true,
      data: sampleScorecards,
    });
  });

  // ==========================================================================
  // TEST 1: Zone 1 Executive KPI Header
  // ==========================================================================
  describe('AgentHealthKPIHeader Component', () => {
    it('calculates and renders fleet-wide average health and circuit counts correctly', () => {
      render(<AgentHealthKPIHeader scorecards={sampleScorecards} />);

      // Average health: (92 + 45) / 2 = 68.5 -> 69
      expect(screen.getByText('69')).toBeDefined();

      // Active agents: 1 healthy out of 2 total (0 degraded)
      expect(screen.getByText(/\/ 2 healthy/i)).toBeDefined();
      expect(screen.getByText(/All healthy personas normal/i)).toBeDefined();

      // Tripped count
      expect(screen.getByText(/quarantined in shadow mode/i)).toBeDefined();

      // Success rate average: (98 + 50) / 2 = 74%
      expect(screen.getByText('74%')).toBeDefined();
    });
  });

  // ==========================================================================
  // TEST 2: Zone 3 Agent Health Table
  // ==========================================================================
  describe('AgentHealthTable Component', () => {
    it('renders persona rows, status badges, and triggers inspect/reset callbacks', () => {
      const onInspect = vi.fn();
      const onReset = vi.fn();

      render(
        <AgentHealthTable
          scorecards={sampleScorecards}
          onInspectPersona={onInspect}
          onResetPersona={onReset}
          statusFilter="ALL"
          domainFilter="ALL"
          searchQuery=""
        />
      );

      // Verify persona names
      expect(screen.getByText('Collections Agent')).toBeDefined();
      expect(screen.getByText('Billing Analyst')).toBeDefined();

      // Verify circuit badges
      expect(screen.getByText('CLOSED (Healthy)')).toBeDefined();
      expect(screen.getByText('OPEN (Tripped)')).toBeDefined();
      expect(screen.getByText('Shadow Mode (0 writes)')).toBeDefined();

      // Click Inspect button for first persona
      const inspectButtons = screen.getAllByRole('button', { name: /inspect/i });
      fireEvent.click(inspectButtons[0]);
      expect(onInspect).toHaveBeenCalledWith(sampleScorecards[0]);

      // Click Reset button for tripped persona
      const resetButtons = screen.getAllByRole('button', { name: /reset/i });
      fireEvent.click(resetButtons[1]);
      expect(onReset).toHaveBeenCalledWith(sampleScorecards[1]);
    });
  });

  // ==========================================================================
  // TEST 3: CircuitResetModal Component (theme.md §8 & Rule 17)
  // ==========================================================================
  describe('CircuitResetModal Component', () => {
    it('enforces mandatory justification >= 5 characters and triggers reset action', async () => {
      const onResetSuccess = vi.fn();
      const mockResetAction = vi.fn().mockResolvedValue({
        success: true,
        data: {
          ...sampleScorecards[1],
          circuitState: 'HALF_OPEN',
          consecutiveFailures: 0,
        },
      });

      render(
        <CircuitResetModal
          open={true}
          onOpenChange={vi.fn()}
          scorecard={sampleScorecards[1]}
          organizationId="org_test_enterprise"
          workspaceId="ws_test_ops"
          onResetSuccess={onResetSuccess}
          resetAction={mockResetAction}
        />
      );

      // Verify modal content
      expect(screen.getByText('Reset Circuit Breaker')).toBeDefined();
      expect(screen.getByText('Persona: billing_analyst')).toBeDefined();

      // Reset button should be disabled when justification < 5 chars
      const submitButton = screen.getByRole('button', { name: /confirm circuit reset/i });
      expect(submitButton).toHaveProperty('disabled', true);

      // Enter short text (3 chars)
      const textarea = screen.getByPlaceholderText(/explain why this circuit breaker is safe to reset/i);
      fireEvent.change(textarea, { target: { value: 'Fix' } });
      expect(submitButton).toHaveProperty('disabled', true);

      // Enter valid text (>= 5 chars)
      fireEvent.change(textarea, { target: { value: 'Database pool latency restored and verified.' } });
      expect(submitButton).toHaveProperty('disabled', false);

      // Submit form
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockResetAction).toHaveBeenCalledWith(
          expect.objectContaining({
            organizationId: 'org_test_enterprise',
            workspaceId: 'ws_test_ops',
            personaId: 'billing_analyst',
            justification: 'Database pool latency restored and verified.',
          })
        );
        expect(onResetSuccess).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // TEST 4: ExecutionInspectorModal Component (theme.md §8 & 6-Zone Stepper)
  // ==========================================================================
  describe('ExecutionInspectorModal Component', () => {
    it('renders 6-zone stepper navigation and displays zone details', () => {
      render(
        <ExecutionInspectorModal
          open={true}
          onOpenChange={vi.fn()}
          data={sampleInspectorData}
        />
      );

      // Verify Stepper Zones
      expect(screen.getByText('1. Plan')).toBeDefined();
      expect(screen.getByText('2. Actions')).toBeDefined();
      expect(screen.getByText('3. Predict')).toBeDefined();
      expect(screen.getByText('4. Execute')).toBeDefined();
      expect(screen.getByText('5. Verify')).toBeDefined();
      expect(screen.getByText('6. Compensate')).toBeDefined();

      // Plan details displayed
      expect(screen.getByText('Generate monthly subscription billing batch')).toBeDefined();
      expect(screen.getByText('L2_STATE_MUTATION')).toBeDefined();

      // Switch to Actions Zone
      fireEvent.click(screen.getByText('2. Actions'));
      expect(screen.getByText('finance.invoice.create')).toBeDefined();

      // Switch to Predict Zone
      fireEvent.click(screen.getByText('3. Predict'));
      expect(screen.getByText(/predicted state invariants/i)).toBeDefined();
      expect(screen.getByText(/expected version: v2/i)).toBeDefined();

      // Switch to Verify Zone
      fireEvent.click(screen.getByText('5. Verify'));
      expect(screen.getByText('finance:positive_amount')).toBeDefined();
      expect(screen.getByText('Simulated SLA postcondition variance')).toBeDefined();

      // Switch to Compensate Zone
      fireEvent.click(screen.getByText('6. Compensate'));
      expect(screen.getByText(/finance\.invoice\.void/i)).toBeDefined();
    });
  });

  // ==========================================================================
  // TEST 5: Three-Zone Operations Cockpit (AgentHealthClient)
  // ==========================================================================
  describe('AgentHealthClient Component', () => {
    it('mounts Three-Zone Cockpit and renders telemetry data and search filtering', async () => {
      render(<AgentHealthClient />);

      // Verify Header
      expect(screen.getByText('Agent Health & Verification Cockpit')).toBeDefined();
      expect(screen.getByText('SSE LIVE')).toBeDefined();

      // Wait for scorecards to load
      await waitFor(() => {
        expect(screen.getByText('Collections Agent')).toBeDefined();
        expect(screen.getByText('Billing Analyst')).toBeDefined();
      });

      // Filter by domain "Finance"
      const financeButton = screen.getByRole('button', { name: 'Finance' });
      fireEvent.click(financeButton);
      expect(screen.getByText('Collections Agent')).toBeDefined();
      expect(screen.getByText('Billing Analyst')).toBeDefined();

      // Filter by search query
      const searchInput = screen.getByPlaceholderText(/search persona id or name/i);
      fireEvent.change(searchInput, { target: { value: 'collections' } });

      await waitFor(() => {
        expect(screen.getByText('Collections Agent')).toBeDefined();
      });
    });
  });
});
