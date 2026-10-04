/**
 * @fileOverview Test Suite for ToolCallCard Component (Phase 8 Milestone 2)
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first touch targets >= 44px.
 * - Rule 13 & 30: Untrusted reference data containerization.
 * - Rule 20 & 39: Correlation ID & Trace ID badges with copy action.
 * - Rule 22: Truncated SHA-256 hash display.
 * - Rule 27: Compensating capability indicator.
 * - Rule 41: Explainability Standard (WHAT, WHY, EXPECTED CHANGE).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCallCard } from '@/components/runs/ToolCallCard';
import type { AgentStep } from '@/platform/runtime/agent-run-types';

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

    // Check truncated hash presence
    expect(screen.getByText(/e3b0c44298fc/i)).toBeDefined();

    // Check correlation ID presence
    expect(screen.getByText(/corr_test_987/i)).toBeDefined();

    // Trigger copy on correlation ID
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

    // Click accordion toggle to expand input/output details
    const accordionToggle = screen.getByRole('button', { name: /Inspect Arguments & Response Data/i });
    fireEvent.click(accordionToggle);

    const containers = container.querySelectorAll('untrusted_reference_data');
    expect(containers.length).toBeGreaterThan(0);
  });
});
