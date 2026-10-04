/**
 * @fileOverview Test Suite for AgentRunTimeline Component (Phase 8 Milestone 2)
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first touch targets >= 44px.
 * - Rule 13 & 30: Untrusted reference data containerization (`<untrusted_reference_data>`).
 * - Rule 27: Compensated step visual state.
 * - Rule 41: Explainability fields (WHAT, WHY, EXPECTED CHANGE).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentRunTimeline } from '@/components/runs/AgentRunTimeline';
import type { AgentStep } from '@/platform/runtime/agent-run-types';

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

    // Expand first step
    const firstStepToggle = screen.getByRole('button', { name: /Synthesize Execution Plan/i });
    fireEvent.click(firstStepToggle);

    expect(screen.getByText(/Decompose goal into 3 sub-tasks/i)).toBeDefined();
    expect(screen.getByText(/Required before capability dispatch/i)).toBeDefined();
    expect(screen.getByText(/Plan established/i)).toBeDefined();
  });

  it('wraps untrusted step outputs in <untrusted_reference_data> isolation container (Rule 13 & 30)', () => {
    const { container } = render(<AgentRunTimeline steps={mockSteps} />);

    // Expand second step
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
