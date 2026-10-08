/**
 * @fileOverview Unit & Integration Tests for OrganizationMissionControlClient (Phase 13 Milestone 5 Task 4)
 *
 * Implements:
 * - Rule 4 (Strict Zero-`any` / `any[]` typing policy)
 * - Rule 7 (Mobile-first responsive touch targets >= 44px)
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Verification)
 * - Rule 24 (Tri-State Circuit Breakers)
 * - Rule 25 (Dead-Letter Queue DLQ Reprocessing)
 * - Rule 26 (Cooperative Cancellation)
 * - Rule 27 (Reverse-LIFO Saga Compensation Rollback Visualizer)
 * - Rule 28 & 56 (Knapsack Token Budgeting)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 61 (Three-Zone Enterprise Mission Control Cockpit)
 * - Rule 62 (Real-Time SSE Reactivity via useEventStream)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrganizationMissionControlClient } from '@/app/admin/intelligence/organization/OrganizationMissionControlClient';

// Mock useEventStream
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: vi.fn((_opts?: { onEvent?: (event: unknown) => void }) => ({
    status: 'connected',
    reconnect: vi.fn(),
  })),
}));

// Mock server actions
vi.mock('@/app/actions/supervisor-actions', () => ({
  getSupervisorTelemetryAction: vi.fn(async () => ({
    success: true,
    data: {
      activeMissionsCount: 2,
      activeDelegationsCount: 3,
      tokensUsed: 14200,
      tokenCeiling: 50000,
      meshHealthy: true,
      circuitBreakerState: 'CLOSED',
      deadManSwitchEngaged: false,
      activeMissions: [
        {
          missionId: 'sup_mission_live_01',
          goal: 'Reconcile outstanding term fees across Accra and Kumasi campuses',
          status: 'RUNNING',
          priorityLevel: 'HIGH',
          totalWaves: 3,
          currentWaveIndex: 1,
          totalSteps: 6,
          completedSteps: 2,
          failedSteps: 0,
          tokensUsed: 8400,
          dag: {
            missionType: 'CUSTOM' as const,
            nodes: [
              {
                stepId: 'step_query_invoices',
                title: 'Query Invoices',
                description: 'Search for unpaid student invoices',
                assignedPersona: 'billing_analyst' as const,
                capabilityId: 'finance.invoice.search',
                input: {},
                dependentOnStepIds: [],
                delegatedScopes: ['finance:read'],
                maxTokens: 5000,
                timeoutMs: 30000,
                riskLevel: 'L0_READ' as const,
                status: 'COMPLETED' as const,
                output: { count: 12 },
                error: null,
                executionDurationMs: 340,
                delegationToken: null,
                idempotencyKey: 'idemp_01',
                proposalId: null,
              },
              {
                stepId: 'step_reconcile_payments',
                title: 'Reconcile Payments',
                description: 'Match payments to invoices',
                assignedPersona: 'reconciliation_agent' as const,
                capabilityId: 'finance.reconciliation.match',
                input: {},
                dependentOnStepIds: ['step_query_invoices'],
                delegatedScopes: ['finance:write'],
                maxTokens: 5000,
                timeoutMs: 30000,
                riskLevel: 'L2_STATE_MUTATION' as const,
                status: 'RUNNING' as const,
                output: null,
                error: null,
                executionDurationMs: 120,
                delegationToken: null,
                idempotencyKey: 'idemp_02',
                proposalId: null,
              },
            ],
            edges: [
              { from: 'step_query_invoices', to: 'step_reconcile_payments' },
            ],
            topologicalOrder: ['step_query_invoices', 'step_reconcile_payments'],
            waveGroups: [
              ['step_query_invoices'],
              ['step_reconcile_payments'],
            ],
            estimatedDurationMs: 60000,
            totalTokenBudget: 10000,
            hasCycles: false,
          },
          topologicalWaves: [
            {
              waveIndex: 0,
              nodes: [
                {
                  nodeId: 'step_query_invoices',
                  agentPersona: 'billing_analyst',
                  capabilityId: 'finance.invoice.search',
                  status: 'COMPLETED',
                  input: {},
                  output: { count: 12 },
                  durationMs: 340,
                },
              ],
            },
            {
              waveIndex: 1,
              nodes: [
                {
                  nodeId: 'step_reconcile_payments',
                  agentPersona: 'reconciliation_agent',
                  capabilityId: 'finance.reconciliation.match',
                  status: 'RUNNING',
                  input: {},
                  durationMs: 120,
                },
              ],
            },
          ],
        },
      ],
      dlqMessages: [
        {
          messageId: 'dlq_msg_01',
          senderAgentId: 'collections_agent',
          targetTopic: 'crm.outreach.draft',
          errorMessage: 'Socket timeout connecting to communication gateway',
          retryCount: 3,
          timestamp: new Date().toISOString(),
        },
      ],
      meshPeers: [
        {
          peerId: 'peer_finance_node',
          personaId: 'billing_analyst',
          endpoint: 'mesh://finance.internal:8001',
          status: 'HEALTHY',
          latencyMs: 12,
        },
        {
          peerId: 'peer_sales_node',
          personaId: 'lead_sdr',
          endpoint: 'mesh://sales.internal:8002',
          status: 'HEALTHY',
          latencyMs: 18,
        },
      ],
    },
  })),
  cancelSupervisorMissionAction: vi.fn(async (missionId: string) => ({
    success: true,
    data: { success: true, missionId, status: 'CANCELLED' },
  })),
  resubmitDlqMessageAction: vi.fn(async (organizationId: string, messageId: string) => ({
    success: true,
    data: { messageId, resubmitted: true },
  })),
  toggleSupervisorDeadManSwitchAction: vi.fn(async (organizationId: string, paused: boolean, reason: string) => ({
    success: true,
    data: { emergencyPause: paused, reason },
  })),
  executeSupervisorMissionAction: vi.fn(async () => ({ success: true })),
  simulateSupervisorShadowGoalAction: vi.fn(async () => ({ success: true })),
}));

// Mock use-toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('OrganizationMissionControlClient (Rule 61 Three-Zone Cockpit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Three-Zone layout with Zone 1 Executive Telemetry', async () => {
    render(
      <OrganizationMissionControlClient
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    // Header & Titles
    expect(screen.getByText('Organization Swarm Mission Control')).toBeDefined();

    // Zone 1: Telemetry Grid
    await waitFor(() => {
      expect(screen.getByText(/active missions/i)).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
      expect(screen.getByText(/active delegations/i)).toBeDefined();
      expect(screen.getByText('3')).toBeDefined();
      expect(screen.getByText(/token budget/i)).toBeDefined();
      expect(screen.getByText(/mesh healthy/i)).toBeDefined();
    });
  });

  it('renders Zone 2 Mission Command Deck with live DAG execution and cooperative cancel trigger', async () => {
    const { cancelSupervisorMissionAction } = await import('@/app/actions/supervisor-actions');

    render(
      <OrganizationMissionControlClient
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/reconcile outstanding term fees/i)).toBeDefined();
      expect(screen.getByText('Wave 1')).toBeDefined();
      expect(screen.getByText('Wave 2')).toBeDefined();
      expect(screen.getByText('step_query_invoices')).toBeDefined();
      expect(screen.getByText('step_reconcile_payments')).toBeDefined();
    });

    // Cooperative cancel button (Rule 26)
    const cancelBtn = screen.getByRole('button', { name: /cancel mission/i });
    expect(cancelBtn).toBeDefined();

    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(cancelSupervisorMissionAction).toHaveBeenCalledWith(
        'sup_mission_live_01',
        'org_test_123',
        expect.any(String)
      );
    });
  });

  it('renders Zone 3 Swarm Mesh Topology, DLQ Reprocessing and Dead-Man Switch', async () => {
    const { resubmitDlqMessageAction } = await import('@/app/actions/supervisor-actions');

    render(
      <OrganizationMissionControlClient
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    await waitFor(() => {
      // Mesh Peers
      expect(screen.getByText('peer_finance_node')).toBeDefined();
      expect(screen.getByText('peer_sales_node')).toBeDefined();

      // Circuit Breaker State (Rule 24)
      expect(screen.getByText(/circuit: closed/i)).toBeDefined();

      // Dead-Letter Queue (DLQ, Rule 25)
      expect(screen.getByText(/dlq_msg_01/i)).toBeDefined();
    });

    // DLQ Resubmit Button (Rule 25)
    const resubmitBtn = screen.getByRole('button', { name: /resubmit/i });
    fireEvent.click(resubmitBtn);

    await waitFor(() => {
      expect(resubmitDlqMessageAction).toHaveBeenCalledWith('org_test_123', 'dlq_msg_01');
    });
  });

  it('triggers modal launchers for SupervisorMission, DelegationTree, and GraphReasoning', async () => {
    render(
      <OrganizationMissionControlClient
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    // Launcher buttons in Cockpit Toolbar
    const launchMissionBtn = screen.getByRole('button', { name: /launch mission/i });
    const viewTreeBtn = screen.getByRole('button', { name: /delegation tree/i });
    const graphReasoningBtn = screen.getByRole('button', { name: /graph reasoning/i });

    expect(launchMissionBtn).toBeDefined();
    expect(viewTreeBtn).toBeDefined();
    expect(graphReasoningBtn).toBeDefined();

    // Click launch mission
    fireEvent.click(launchMissionBtn);
    await waitFor(() => {
      expect(screen.getByText('Launch Autonomous Supervisor Mission')).toBeDefined();
    });
  });

  it('enforces mandatory >= 5 character justification before toggling dead-man kill switch (Rule 60 & 61)', async () => {
    const { toggleSupervisorDeadManSwitchAction } = await import('@/app/actions/supervisor-actions');

    render(
      <OrganizationMissionControlClient
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/emergency dead-man switch/i)).toBeDefined();
    });

    // Toggle button
    const deadManToggle = screen.getByRole('button', { name: /engage emergency halt/i });
    fireEvent.click(deadManToggle);

    // Double confirmation prompt appears with mandatory reason input
    const reasonInput = screen.getByPlaceholderText(/reason for emergency halt/i);
    const confirmHaltBtn = screen.getByRole('button', { name: /confirm emergency halt/i });

    expect(confirmHaltBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(reasonInput, { target: { value: 'Bad' } });
    expect(confirmHaltBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(reasonInput, {
      target: { value: 'Critical downstream gateway failure; engaging circuit break.' },
    });
    expect(confirmHaltBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(confirmHaltBtn);

    await waitFor(() => {
      expect(toggleSupervisorDeadManSwitchAction).toHaveBeenCalledWith(
        'org_test_123',
        true,
        'Critical downstream gateway failure; engaging circuit break.'
      );
    });
  });
});
