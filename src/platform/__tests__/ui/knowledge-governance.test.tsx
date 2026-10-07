/**
 * @fileOverview Unit & Integration Tests: Knowledge Governance & Control Plane (Phase 11 M5 · T5)
 *
 * Verifies:
 * - Backoffice Governance Client: KPI cards, policies, dead-man switches, incident stream
 * - PolicyConfigPanel: auto-accept slider, quotas, cost ceilings, submission
 * - DeadManSwitchPanel: double-confirmation modal, reason audit requirement, toggle action
 * - Dead-letter queue reprocess trigger via reprocessMeetingPipelineAction
 * - Strict Rule 4 typing (zero any/any[])
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KnowledgeGovernanceClient } from '@/app/admin/intelligence/governance/KnowledgeGovernanceClient';
import type { GovernanceMetricsSummary } from '@/platform/domains/knowledge_memory/contracts/knowledge-ui-types';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_gov_123',
    activeOrganizationId: 'org_gov_456',
  }),
}));

vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: vi.fn(),
}));

const mockGetKnowledgeGovernanceMetricsAction = vi.fn();
const mockUpdateKnowledgeGovernanceConfigAction = vi.fn();
const mockSetKnowledgeKillSwitchAction = vi.fn();
const mockReprocessMeetingPipelineAction = vi.fn();

vi.mock('@/app/actions/knowledge-governance-actions', () => ({
  getKnowledgeGovernanceMetricsAction: (...args: unknown[]) =>
    mockGetKnowledgeGovernanceMetricsAction(...args),
  updateKnowledgeGovernanceConfigAction: (...args: unknown[]) =>
    mockUpdateKnowledgeGovernanceConfigAction(...args),
  setKnowledgeKillSwitchAction: (...args: unknown[]) =>
    mockSetKnowledgeKillSwitchAction(...args),
  reprocessMeetingPipelineAction: (...args: unknown[]) =>
    mockReprocessMeetingPipelineAction(...args),
}));

describe('Knowledge Governance & Control Plane (Phase 11 M5 · T5)', () => {
  const sampleMetrics: GovernanceMetricsSummary = {
    totalPipelines24h: 18,
    activePipelines: 2,
    totalMemoryObjects: 420,
    incidents24h: 3,
    activeKillSwitches: {
      agent_meeting: false,
      agent_knowledge: false,
      capability_retrieval: false,
      draft_messages: false,
      global_halt: false,
    },
    config: {
      autoAcceptThreshold: 0.9,
      quotas: {
        dailyPipelines: 50,
        dailyTranscriptionHours: 10,
        queriesPerHour: 100,
      },
      costCeilingUsd: 500,
      retentionDays: 90,
      allowedModels: ['gemini-2.0-flash', 'gemini-1.5-pro'],
      killSwitches: {
        agent_meeting: false,
        agent_knowledge: false,
        capability_retrieval: false,
        draft_messages: false,
        global_halt: false,
      },
    },
    recentIncidents: [
      {
        incidentId: 'inc_101',
        eventType: 'prompt_injection_attempt',
        severity: 'high',
        sourceId: 'meeting_transcript_99',
        tenantId: 'org_gov_456',
        timestamp: '2026-10-07T14:30:00Z',
        metadata: { pattern: 'ignore previous instructions' },
      },
      {
        incidentId: 'inc_102',
        eventType: 'dlq_failure',
        severity: 'critical',
        sourceId: 'pipe_dlq_404',
        tenantId: 'org_gov_456',
        timestamp: '2026-10-07T14:45:00Z',
        metadata: { reason: 'Audio transcription timed out' },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKnowledgeGovernanceMetricsAction.mockResolvedValue({
      success: true,
      data: sampleMetrics,
    });
    mockUpdateKnowledgeGovernanceConfigAction.mockResolvedValue({
      success: true,
      data: sampleMetrics.config,
    });
    mockSetKnowledgeKillSwitchAction.mockResolvedValue({
      success: true,
      data: { key: 'agent_meeting', enabled: true },
    });
    mockReprocessMeetingPipelineAction.mockResolvedValue({
      success: true,
      data: { reprocessed: true },
    });
  });

  it('renders Governance Control Plane and fetches metrics on mount', async () => {
    render(<KnowledgeGovernanceClient />);

    expect(screen.getByText('Backoffice Governance & Control Plane')).toBeDefined();

    await waitFor(() => {
      expect(mockGetKnowledgeGovernanceMetricsAction).toHaveBeenCalledWith('ws_gov_123');
    });

    // KPI Card values
    expect(screen.getByText('18')).toBeDefined();
    expect(screen.getByText('420')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();

    // Security feed items
    expect(screen.getByText('PROMPT INJECTION ATTEMPT')).toBeDefined();
    expect(screen.getByText('DLQ FAILURE')).toBeDefined();
  });

  it('updates operational policies when form is saved', async () => {
    render(<KnowledgeGovernanceClient />);

    await waitFor(() => {
      expect(screen.getByText('Operational Policies & Feature Toggles')).toBeDefined();
    });

    const dailyPipelinesInput = screen.getByDisplayValue('50');
    fireEvent.change(dailyPipelinesInput, { target: { value: '75' } });

    const saveBtn = screen.getByRole('button', { name: /Save Governance Policies/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateKnowledgeGovernanceConfigAction).toHaveBeenCalledWith(
        'ws_gov_123',
        expect.objectContaining({
          quotas: expect.objectContaining({
            dailyPipelines: 75,
          }),
        })
      );
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Policies updated successfully',
      })
    );
  });

  it('opens double-confirmation dialog when toggling kill switch and executes on reason entry', async () => {
    render(<KnowledgeGovernanceClient />);

    await waitFor(() => {
      expect(screen.getByText('Emergency Dead-Man & Kill Switches (Rule 60)')).toBeDefined();
    });

    // Click kill switch for Meeting Agent
    const killSwitchBtns = screen.getAllByRole('button', { name: /Kill Switch/i });
    fireEvent.click(killSwitchBtns[0]);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Confirm System Halt')).toBeDefined();
    });

    // Enter audit reason
    const reasonInput = screen.getByPlaceholderText(/Suspected prompt injection or model hallucination/i);
    fireEvent.change(reasonInput, { target: { value: 'Isolating adversarial transcript test' } });

    // Confirm Halt
    const confirmBtn = screen.getByRole('button', { name: /Confirm Halt/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSetKnowledgeKillSwitchAction).toHaveBeenCalledWith(
        'ws_gov_123',
        'agent_meeting',
        true,
        'Isolating adversarial transcript test'
      );
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'System halt engaged',
      })
    );
  });

  it('triggers pipeline reprocess action when clicking Reprocess in incident feed', async () => {
    render(<KnowledgeGovernanceClient />);

    await waitFor(() => {
      expect(screen.getByText('DLQ FAILURE')).toBeDefined();
    });

    const reprocessBtn = screen.getByRole('button', { name: /Reprocess/i });
    fireEvent.click(reprocessBtn);

    await waitFor(() => {
      expect(mockReprocessMeetingPipelineAction).toHaveBeenCalledWith(
        'ws_gov_123',
        'pipe_dlq_404'
      );
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Pipeline reprocess triggered',
      })
    );
  });
});
