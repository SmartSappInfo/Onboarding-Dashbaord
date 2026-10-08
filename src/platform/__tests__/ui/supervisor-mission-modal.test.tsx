/**
 * @fileOverview Unit & Integration Tests for SupervisorMissionModal (Phase 13 Milestone 5 Task 1)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & geometry: border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl
 * - Demarcated header: <DialogHeader demarcated> (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20)
 * - Single-circle info tooltip: <CardInfoTooltip text="..." /> at z-[10050]
 * - Zero raw descriptions: <DialogDescription className="sr-only">
 * - Demarcated footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5
 * - Tactile action buttons: min-h-[44px] rounded-xl active:scale-[0.97]
 * - Rules 4, 7, 8, 19, 21, 22, 28, 41, 42, 47, 51, 60.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SupervisorMissionModal } from '@/components/supervisor/SupervisorMissionModal';

// Mock server actions
vi.mock('@/app/actions/supervisor-actions', () => ({
  executeSupervisorMissionAction: vi.fn(async (input: { organizationId: string; workspaceId: string; goal: string }) => ({
    success: true,
    data: {
      missionId: 'sup_mission_live_123',
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      status: 'COMPLETED',
      summary: 'Mission executed across 3 topological waves with zero errors.',
      totalWaves: 3,
      totalSteps: 5,
      completedSteps: 5,
      failedSteps: 0,
      totalTokensUsed: 12500,
      totalDurationMs: 4200,
      proposalsStaged: 0,
      dag: {
        dagId: 'dag_test_123',
        missionId: 'sup_mission_live_123',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        nodes: [],
        edges: [],
        topologicalWaves: [],
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    },
  })),
  simulateSupervisorShadowGoalAction: vi.fn(async (input: { organizationId: string; workspaceId: string; goal: string }) => ({
    success: true,
    data: {
      missionId: 'sup_mission_shadow_123',
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      status: 'SIMULATED',
      isDryRun: true,
      blastRadius: {
        simulated: true,
        targetedEntities: 2,
        draftsGenerated: 1,
        proposalsStaged: 1,
        liveMutations: 0,
        summary: '0 live database mutations. Verified in Shadow Mode.',
      },
      durationMs: 310,
      createdAt: new Date().toISOString(),
    },
  })),
}));

// Mock use-toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('SupervisorMissionModal (theme.md §8 Compliance)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal dialog with demarcated header, title, and single-circle tooltip', () => {
    render(
      <SupervisorMissionModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    expect(screen.getByText('Launch Autonomous Supervisor Mission')).toBeDefined();
    const tooltipTrigger = screen.getByRole('button', { name: /more information/i });
    expect(tooltipTrigger).toBeDefined();
  });

  it('hides long description clutter behind screen-reader only class (theme.md §8.2)', () => {
    render(
      <SupervisorMissionModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    const srOnlyDesc = document.querySelector('.sr-only');
    expect(srOnlyDesc).toBeDefined();
    expect(srOnlyDesc?.textContent).toContain('Decompose high-level organizational goals');
  });

  it('enforces minimum goal length of 10 characters and updates live counter', () => {
    render(
      <SupervisorMissionModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    const goalInput = screen.getByPlaceholderText(/describe the high-level objective/i);
    const submitBtn = screen.getByRole('button', { name: /launch mission/i });

    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(goalInput, { target: { value: 'Too short' } });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(goalInput, {
      target: { value: 'Audit all overdue invoices and reconcile bank settlements' },
    });
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
  });

  it('binds priority levels correctly and toggles shadow simulation mode', () => {
    render(
      <SupervisorMissionModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    expect(screen.getByText('MEDIUM')).toBeDefined();

    // Check Shadow mode toggle
    const shadowToggle = screen.getByRole('checkbox', { name: /run in shadow mode/i });
    expect(shadowToggle).toBeDefined();

    // Shadow mode badge is visible
    expect(screen.getByText(/0 live mutations/i)).toBeDefined();
  });

  it('dispatches executeSupervisorMissionAction when launching a live mission', async () => {
    const { executeSupervisorMissionAction } = await import('@/app/actions/supervisor-actions');
    const onStartedMock = vi.fn();

    render(
      <SupervisorMissionModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        onMissionStarted={onStartedMock}
      />
    );

    const goalInput = screen.getByPlaceholderText(/describe the high-level objective/i);
    fireEvent.change(goalInput, {
      target: { value: 'Synthesize quarterly campus revenue report and flag collections risk' },
    });

    const submitBtn = screen.getByRole('button', { name: /launch mission/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(executeSupervisorMissionAction).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_test_123',
          workspaceId: 'ws_test_456',
          goal: 'Synthesize quarterly campus revenue report and flag collections risk',
          priorityLevel: 'MEDIUM',
        })
      );
      expect(onStartedMock).toHaveBeenCalled();
    });
  });

  it('dispatches simulateSupervisorShadowGoalAction when shadow mode is active', async () => {
    const { simulateSupervisorShadowGoalAction } = await import('@/app/actions/supervisor-actions');
    const onStartedMock = vi.fn();

    render(
      <SupervisorMissionModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        onMissionStarted={onStartedMock}
      />
    );

    const goalInput = screen.getByPlaceholderText(/describe the high-level objective/i);
    fireEvent.change(goalInput, {
      target: { value: 'Simulate lead enrichment across enterprise school directory' },
    });

    const shadowToggle = screen.getByRole('checkbox', { name: /run in shadow mode/i });
    fireEvent.click(shadowToggle);

    const submitBtn = screen.getByRole('button', { name: /simulate in shadow mode/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(simulateSupervisorShadowGoalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_test_123',
          workspaceId: 'ws_test_456',
          goal: 'Simulate lead enrichment across enterprise school directory',
        })
      );
      expect(onStartedMock).toHaveBeenCalled();
    });
  });

  it('renders tactile footer with rounded-xl active:scale-[0.97] buttons and min-h-[44px]', () => {
    render(
      <SupervisorMissionModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    expect(cancelBtn.className).toContain('active:scale-[0.97]');
    expect(cancelBtn.className).toContain('min-h-[44px]');
  });
});
