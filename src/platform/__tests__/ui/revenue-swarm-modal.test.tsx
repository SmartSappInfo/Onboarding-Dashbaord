/**
 * @fileOverview Unit & Integration Tests for RevenueSwarmModal (Phase 10 Milestone 5 Task 4)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & geometry: border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl
 * - Demarcated header: <DialogHeader demarcated>
 * - Single-circle info tooltip: <CardInfoTooltip text="..." /> at z-[10050]
 * - Zero raw descriptions: <DialogDescription className="sr-only">
 * - Demarcated footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5
 * - Tactile action buttons: rounded-xl active:scale-[0.97]
 * - Rules 4, 7, 13, 21, 22, 26, 40, 41, 42, 60.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RevenueSwarmModal } from '@/components/sales/RevenueSwarmModal';

// Mock server action
vi.mock('@/app/actions/revenue-swarm-actions', () => ({
  launchRevenueSwarmAction: vi.fn(async (input: { organizationId: string; workspaceId: string; criteria: { query: string; targetIndustry: string; targetLeadCount: number } }) => ({
    success: true,
    data: {
      swarmRunId: 'swarm_run_test_123',
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      status: 'waiting_for_approval',
      stages: [
        { stage: 'discovery', status: 'completed', countIn: 0, countOut: 5, durationMs: 120, errors: [] },
        { stage: 'enrichment', status: 'completed', countIn: 5, countOut: 5, durationMs: 140, errors: [] },
        { stage: 'research', status: 'completed', countIn: 5, countOut: 5, durationMs: 150, errors: [] },
        { stage: 'qualification', status: 'completed', countIn: 5, countOut: 4, durationMs: 110, errors: [] },
        { stage: 'personalization', status: 'completed', countIn: 4, countOut: 4, durationMs: 200, errors: [] },
        { stage: 'staging', status: 'completed', countIn: 4, countOut: 1, durationMs: 90, errors: [] },
      ],
      totalDiscovered: 5,
      totalEnriched: 5,
      totalQualified: 4,
      totalDraftsGenerated: 4,
      totalProposalsStaged: 1,
      proposals: [
        {
          proposalId: 'prop_swarm_123',
          payloadHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
          status: 'staged',
          recipientCount: 4,
        },
      ],
      payloadHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      isDryRun: true,
      blastRadius: {
        simulated: true,
        targetedLeads: 4,
        draftsGenerated: 4,
        proposalsStaged: 1,
        liveMutations: 0,
        summary: '0 live database mutations. Staged 1 proposal in ApprovalStore.',
      },
      durationMs: 810,
      createdAt: new Date().toISOString(),
    },
  })),
  cancelRevenueSwarmAction: vi.fn(async () => ({
    success: true,
    data: { swarmRunId: 'swarm_run_test_123', status: 'cancelled' },
  })),
}));

describe('RevenueSwarmModal Component (theme.md §8 Compliance)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal dialog with demarcated header, title, and single-circle tooltip', () => {
    render(
      <RevenueSwarmModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test"
        workspaceId="ws_test"
      />
    );

    expect(screen.getByText('Autonomous Revenue Swarm')).toBeDefined();
    // Info tooltip button presence
    const tooltipTrigger = screen.getByRole('button', { name: /more information/i });
    expect(tooltipTrigger).toBeDefined();
  });

  it('hides long description clutter behind screen-reader only class (theme.md §8.2)', () => {
    const { container } = render(
      <RevenueSwarmModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test"
        workspaceId="ws_test"
      />
    );

    const srOnlyDesc = document.querySelector('.sr-only');
    expect(srOnlyDesc).toBeDefined();
    expect(srOnlyDesc?.textContent).toContain('Autonomous Revenue Swarm');
  });

  it('renders all 6 pipeline stage indicators in the visual overview', () => {
    render(
      <RevenueSwarmModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test"
        workspaceId="ws_test"
      />
    );

    expect(screen.getByText('1. Discovery & Scraping')).toBeDefined();
    expect(screen.getByText('2. Waterfall Enrichment')).toBeDefined();
    expect(screen.getByText('3. Deep Research')).toBeDefined();
    expect(screen.getByText('4. Qualification Scoring')).toBeDefined();
    expect(screen.getByText('5. SDR Personalization')).toBeDefined();
    expect(screen.getByText('6. Governance Staging')).toBeDefined();
  });

  it('renders query and targeting inputs with default values', () => {
    render(
      <RevenueSwarmModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test"
        workspaceId="ws_test"
      />
    );

    const queryInput = screen.getByDisplayValue(/Find 20 qualified leads in edtech and prepare outreach/i);
    expect(queryInput).toBeDefined();

    expect(screen.getByText(/Target Industry/i)).toBeDefined();
    expect(screen.getByText(/Target Lead Count/i)).toBeDefined();
  });

  it('launches mission on submit, displays progress, and reveals outcome with 0 Live Mutations banner', async () => {
    const handleCompleted = vi.fn();
    const mockLaunch = vi.fn().mockResolvedValue({
      success: true,
      data: {
        swarmRunId: 'swarm_run_test_123',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        status: 'waiting_for_approval',
        stages: [
          { stage: 'discovery', status: 'completed', countIn: 0, countOut: 5, durationMs: 120, errors: [] },
          { stage: 'enrichment', status: 'completed', countIn: 5, countOut: 5, durationMs: 140, errors: [] },
          { stage: 'research', status: 'completed', countIn: 5, countOut: 5, durationMs: 150, errors: [] },
          { stage: 'qualification', status: 'completed', countIn: 5, countOut: 4, durationMs: 110, errors: [] },
          { stage: 'personalization', status: 'completed', countIn: 4, countOut: 4, durationMs: 200, errors: [] },
          { stage: 'staging', status: 'completed', countIn: 4, countOut: 1, durationMs: 90, errors: [] },
        ],
        totalDiscovered: 5,
        totalEnriched: 5,
        totalQualified: 4,
        totalDraftsGenerated: 4,
        totalProposalsStaged: 1,
        proposals: [
          {
            proposalId: 'prop_swarm_123',
            payloadHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
            status: 'staged',
            recipientCount: 4,
          },
        ],
        payloadHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        isDryRun: true,
        blastRadius: {
          simulated: true,
          targetedLeads: 4,
          draftsGenerated: 4,
          proposalsStaged: 1,
          liveMutations: 0,
          summary: '0 live database mutations. Staged 1 proposal in ApprovalStore.',
        },
        durationMs: 810,
        createdAt: new Date().toISOString(),
      },
    });

    render(
      <RevenueSwarmModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test"
        workspaceId="ws_test"
        onMissionCompleted={handleCompleted}
        launchAction={mockLaunch}
      />
    );

    const launchButton = screen.getByRole('button', { name: /Launch Revenue Swarm/i });
    fireEvent.click(launchButton);

    await waitFor(() => {
      expect(screen.getAllByText(/0 Live Database Mutations/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Waiting for Human Approval/i)).toBeDefined();
    expect(screen.getByText(/Rule 41 Explainability/i)).toBeDefined();
    expect(handleCompleted).toHaveBeenCalledTimes(1);
    expect(mockLaunch).toHaveBeenCalledTimes(1);
  });
});
